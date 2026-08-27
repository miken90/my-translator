/**
 * Transcript UI — card-based display with speaker diarization
 *
 * Design: Each utterance renders as a card with original + translation stacked.
 * - Cards: subtle background, rounded corners
 * - Original text: dimmed, above translation
 * - Translation: primary color with left accent border
 * - Provisional text: dimmed card
 * - Speaker labels: shown when speaker changes
 * - Language badges: shown when detected language changes
 * - Timestamps: right-aligned in card header
 *
 * Rendering is delegated to CardRenderer (keyed incremental DOM) so an
 * unrelated provisional-text update never touches already-settled cards.
 */

import { CardRenderer } from './transcript-card-renderer.js';

export class TranscriptUI {
    constructor(container) {
        this.container = container;
        this.contentEl = null;
        this.maxChars = 1200;
        this.fontSize = 16;
        // Language code of the rendered translation text (one-way mode only —
        // two-way mode's direction varies per segment, so this stays null and
        // no lang attribute is set). Used for the seg-translation `lang` attr
        // (design-spec.md §6 a11y note).
        this.targetLang = null;
        this._nextSegId = 1; // Monotonic counter for unique segment IDs

        // Segments: each has { id, original, translation, status, speaker, language, confidence }
        this.segments = [];
        // sessionLog: parallel array — never trimmed, holds complete session history
        this.sessionLog = [];
        this.provisionalText = '';
        this.provisionalSpeaker = null;
        this.provisionalLanguage = null;
        this.currentSpeaker = null; // Track current speaker to detect changes
        this.currentLanguage = null; // Track current language to detect changes
        this.lastConfidence = null; // Last confidence score from Soniox

        this._cardRenderer = new CardRenderer(null);

        // Provisional updates are coalesced through requestAnimationFrame —
        // rapid successive setProvisional/clearProvisional calls (Soniox can
        // emit these many times per second) collapse into a single render
        // per frame. addOriginal/addTranslation (finalized content) always
        // render synchronously, unaffected by this.
        this._provisionalRafId = null;

        // Crash-safe logging: fired every 20 finalized segments (in addition
        // to session-manager's own 2-minute timer) so at most ~20 utterances
        // are lost if the app crashes mid-session. Wired by the caller (see
        // app.js) to session-manager's temp-flush — ui.js has no Tauri
        // access of its own.
        this.onSegmentFlushDue = null; // () => {}
        this._flushEverySegments = 20;
    }

    /**
     * Update display settings
     */
    configure({ maxLines, fontSize, fontColor, targetLang }) {
        if (maxLines !== undefined) this.maxChars = maxLines * 160;
        if (fontSize !== undefined) {
            this.fontSize = fontSize;
            this.container.style.setProperty('--transcript-font-size', `${fontSize}px`);
        }
        if (fontColor !== undefined) {
            this.fontColor = fontColor;
            this.container.style.setProperty('--transcript-font-color', fontColor);
        }
        if (targetLang !== undefined) this.targetLang = targetLang;
    }

    /**
     * Add finalized original text (pending translation)
     */
    addOriginal(text, speaker, language) {
        this._removeListening();
        const segId = this._nextSegId++;
        const seg = {
            id: segId,
            original: text,
            translation: null,
            status: 'original',
            speaker: speaker || null,
            language: language || null,
            confidence: this.lastConfidence,
            createdAt: Date.now(),
        };
        this.segments.push(seg);
        // Also push a separate copy to sessionLog (never trimmed)
        this.sessionLog.push({
            id: segId,
            original: text,
            translation: null,
            status: 'original',
            speaker: speaker || null,
            language: language || null,
            confidence: this.lastConfidence,
            createdAt: seg.createdAt,
        });
        if (speaker) this.currentSpeaker = speaker;
        if (language) this.currentLanguage = language;
        this._cleanupStaleOriginals();
        this._render();
        this._maybeFlushBySegmentCount();
    }

    /**
     * Apply translation to the most recent untranslated segment (LIFO).
     * Soniox emits translation for the PREVIOUS segment before the current original,
     * so the correct target is the newest pending original, not the oldest.
     */
    addTranslation(text) {
        let seg = null;
        for (let i = this.segments.length - 1; i >= 0; i--) {
            if (this.segments[i].status === 'original') {
                seg = this.segments[i];
                break;
            }
        }
        if (seg) {
            seg.translation = text;
            seg.status = 'translated';
            // Mirror update in sessionLog: find matching entry by unique id
            const logSeg = this.sessionLog.find(
                s => s.status === 'original' && s.id === seg.id
            );
            if (logSeg) {
                logSeg.translation = text;
                logSeg.status = 'translated';
            }
        } else {
            // No pending original in the (possibly trimmed) display buffer —
            // e.g. a late translation arriving after its original was already
            // trimmed/expired. Existing behavior: record it as a standalone
            // entry so the translation is never lost from sessionLog, even
            // though there's nothing to visually pair it with.
            const newSeg = {
                original: '',
                translation: text,
                status: 'translated',
                speaker: null,
                createdAt: Date.now(),
            };
            this.segments.push(newSeg);
            this.sessionLog.push({ ...newSeg });
            this._maybeFlushBySegmentCount();
        }
        this._render();
    }

    /**
     * Update provisional (in-progress) text. Coalesced via requestAnimationFrame.
     */
    setProvisional(text, speaker, language) {
        this._removeListening();
        this.provisionalText = text;
        this.provisionalSpeaker = speaker || null;
        this.provisionalLanguage = language || null;
        this._scheduleProvisionalRender();
    }

    /**
     * Clear provisional text. Coalesced the same as setProvisional — it's
     * the same transient-display stream, just clearing it.
     */
    clearProvisional() {
        this.provisionalText = '';
        this.provisionalSpeaker = null;
        this.provisionalLanguage = null;
        this._scheduleProvisionalRender();
    }

    _scheduleProvisionalRender() {
        if (this._provisionalRafId !== null) return; // already scheduled this frame
        this._provisionalRafId = requestAnimationFrame(() => {
            this._provisionalRafId = null;
            this._render();
        });
    }

    /**
     * Check if there is any content to display
     */
    hasContent() {
        return this.segments.length > 0 || this.provisionalText ||
            !!this.container.querySelector('.listening-indicator');
    }

    /**
     * Show placeholder state
     */
    showPlaceholder() {
        this.container.innerHTML = `
      <div class="transcript-placeholder">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        <p>Press ▶ to start translating</p>
        <p class="shortcut-hint">Ctrl+Enter</p>
      </div>
    `;
        this.segments = [];
        // sessionLog is NOT cleared here — use clearSession() explicitly after saving
        this.provisionalText = '';
        this.provisionalSpeaker = null;
        this.provisionalLanguage = null;
        this.currentSpeaker = null;
        this.currentLanguage = null;
        this.lastConfidence = null;
        this.contentEl = null;
        this._resetCardTracking();
    }

    /**
     * Show listening state
     */
    showListening() {
        // Remove existing indicators first (prevent duplicates)
        this.container.querySelectorAll('.listening-indicator').forEach(el => el.remove());

        const placeholder = this.container.querySelector('.transcript-placeholder');
        if (placeholder) placeholder.remove();

        this._ensureContent();

        const indicator = document.createElement('div');
        indicator.className = 'listening-indicator';
        indicator.innerHTML = `
            <div class="listening-waves">
                <span></span><span></span><span></span><span></span><span></span>
            </div>
            <p>Listening...</p>
        `;
        this.contentEl.appendChild(indicator);
    }

    /**
     * Show status message in transcript area (e.g. loading model)
     */
    showStatusMessage(message) {
        this._ensureContent();
        let statusEl = this.contentEl.querySelector('.pipeline-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.className = 'pipeline-status';
            statusEl.style.cssText = 'text-align:center; padding:8px; color:rgba(255,255,255,0.5); font-size:13px;';
            this.contentEl.appendChild(statusEl);
        }
        statusEl.textContent = message;
    }

    /**
     * Remove status message
     */
    removeStatusMessage() {
        if (this.contentEl) {
            const statusEl = this.contentEl.querySelector('.pipeline-status');
            if (statusEl) statusEl.remove();
        }
    }

    /**
     * Get full session text as plain text (from sessionLog, never trimmed)
     */
    getFullPlainText() {
        let lines = [];
        for (const seg of this.sessionLog) {
            if (seg.original) lines.push(seg.original);
            if (seg.translation) lines.push(seg.translation);
            if (seg.original || seg.translation) lines.push('');
        }
        if (this.provisionalText) lines.push(this.provisionalText);
        return lines.join('\n').trim();
    }

    /**
     * Check if there are segments to save
     */
    hasSegments() {
        return this.segments.length > 0;
    }

    /**
     * Check if sessionLog has content (full session, not display buffer)
     */
    hasSessionContent() {
        return this.sessionLog.length > 0;
    }

    /**
     * Get full session text from sessionLog (never trimmed).
     * Returns formatted markdown with all segments.
     */
    getFullSessionText(metadata = {}) {
        if (this.sessionLog.length === 0) return null;

        const lines = [];

        // YAML frontmatter
        lines.push('---');
        const now = new Date();
        lines.push(`date: ${now.toISOString().slice(0, 10)}`);
        lines.push(`time: ${now.toTimeString().slice(0, 8)}`);
        if (metadata.duration) lines.push(`duration: ${metadata.duration}`);
        if (metadata.sourceLang) lines.push(`source_lang: ${metadata.sourceLang}`);
        if (metadata.targetLang) lines.push(`target_lang: ${metadata.targetLang}`);
        if (metadata.mode) lines.push(`mode: ${metadata.mode}`);
        if (metadata.audioSource) lines.push(`audio_source: ${metadata.audioSource}`);
        if (metadata.model) lines.push(`model: ${metadata.model}`);
        lines.push(`segments: ${this.sessionLog.length}`);
        lines.push('---');
        lines.push('');

        // Transcript entries
        for (const seg of this.sessionLog) {
            if (seg.speaker) lines.push(`**Speaker ${seg.speaker}:**`);
            if (seg.original) lines.push(`> ${seg.original}`);
            if (seg.translation) lines.push(seg.translation);
            lines.push('');
        }

        return lines.join('\n').trim();
    }

    /**
     * Export text for the live/active session, from sessionLog (never the
     * trimmed display buffer) — distinct from getFullSessionText() in that
     * every entry carries its own timestamp (export's whole point). Format
     * controls markdown syntax: 'md' keeps bold headers and blockquote
     * prefixes, 'txt' is plain text.
     */
    getExportText(format, metadata = {}) {
        if (this.sessionLog.length === 0) return null;

        const lines = [];
        lines.push('---');
        const now = new Date();
        lines.push(`date: ${now.toISOString().slice(0, 10)}`);
        lines.push(`time: ${now.toTimeString().slice(0, 8)}`);
        if (metadata.duration) lines.push(`duration: ${metadata.duration}`);
        if (metadata.sourceLang) lines.push(`source_lang: ${metadata.sourceLang}`);
        if (metadata.targetLang) lines.push(`target_lang: ${metadata.targetLang}`);
        lines.push(`segments: ${this.sessionLog.length}`);
        lines.push('---');
        lines.push('');

        for (const seg of this.sessionLog) {
            const ts = seg.createdAt
                ? new Date(seg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                : '';
            const speakerPart = seg.speaker ? ` Speaker ${seg.speaker}` : '';
            const header = `[${ts}]${speakerPart}`.trim();
            if (ts || speakerPart) lines.push(format === 'md' ? `**${header}**` : header);
            if (seg.original) lines.push(format === 'md' ? `> ${seg.original}` : seg.original);
            if (seg.translation) lines.push(seg.translation);
            lines.push('');
        }

        return lines.join('\n').trim();
    }

    /**
     * Clear session log (call after saving)
     */
    clearSession() {
        this.sessionLog = [];
    }

    /**
     * Clear display buffer only (segments array).
     * sessionLog is NOT cleared — use clearSession() explicitly.
     */
    clear() {
        this.container.innerHTML = '';
        this.segments = [];
        this.provisionalText = '';
        this.provisionalSpeaker = null;
        this.provisionalLanguage = null;
        this.currentSpeaker = null;
        this.currentLanguage = null;
        this.lastConfidence = null;
        this.contentEl = null;
        this._resetCardTracking();
    }

    /**
     * Update confidence score
     */
    setConfidence(confidence) {
        this.lastConfidence = confidence;
    }

    // ─── Internal ──────────────────────────────────────────

    _resetCardTracking() {
        if (this._provisionalRafId !== null) {
            cancelAnimationFrame(this._provisionalRafId);
            this._provisionalRafId = null;
        }
        this._cardRenderer.reset();
    }

    _ensureContent() {
        if (!this.contentEl) {
            this.container.innerHTML = '';
            this.contentEl = document.createElement('div');
            this.contentEl.className = 'transcript-flow';
            this.container.appendChild(this.contentEl);
            this._cardRenderer.setContentEl(this.contentEl);
        }
    }

    _removeListening() {
        const indicator = this.container.querySelector('.listening-indicator');
        if (indicator) indicator.remove();
    }

    _render() {
        this._ensureContent();
        this._trimSegments();
        this._cardRenderer.render(this.segments, {
            text: this.provisionalText,
            speaker: this.provisionalSpeaker,
            language: this.provisionalLanguage,
        }, this.targetLang);
        this._smartScroll(this.container.parentElement || this.container);
    }

    _smartScroll(el) {
        const isNearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 100;
        if (isNearBottom) {
            el.scrollTop = el.scrollHeight;
        }
    }

    /**
     * Single forward pass: walk segments once, dropping 'translated' entries
     * (in encounter order, skipping over pending 'original' ones) while the
     * running total stays over maxChars and more than 2 segments remain.
     * Equivalent to the old repeated findIndex+splice loop, without the
     * repeated O(n) scans.
     */
    _trimSegments() {
        let totalLen = 0;
        for (const seg of this.segments) {
            totalLen += (seg.translation || seg.original || '').length;
        }
        if (totalLen <= this.maxChars) return;

        const kept = [];
        let currentLen = totalLen;
        let currentCount = this.segments.length;

        for (const seg of this.segments) {
            const canRemove = seg.status === 'translated' && currentLen > this.maxChars && currentCount > 2;
            if (canRemove) {
                currentLen -= (seg.translation || seg.original || '').length;
                currentCount -= 1;
                continue;
            }
            kept.push(seg);
        }

        this.segments = kept;
    }

    /**
     * Mark stale original segments that never received translation.
     * - > 10s: mark as stale (dimmed display, still matchable)
     * - > 60s: remove from display buffer (safety valve for long meetings)
     */
    _cleanupStaleOriginals() {
        const now = Date.now();
        const STALE_MS = 10000;    // 10 seconds — mark as stale
        const EXPIRED_MS = 60000;  // 60 seconds — remove from display

        this.segments = this.segments.filter(seg => {
            if (seg.status !== 'original') return true;
            const age = now - seg.createdAt;
            if (age > EXPIRED_MS) return false; // safety valve: drop very old pending
            if (age > STALE_MS) seg.isStale = true;
            return true;
        });
    }

    /**
     * Crash-safe logging: every 20 finalized segments, ask the caller to
     * flush the temp transcript now (in addition to session-manager's
     * regular 2-minute timer), bounding the worst-case loss on a crash.
     */
    _maybeFlushBySegmentCount() {
        if (this.sessionLog.length > 0 && this.sessionLog.length % this._flushEverySegments === 0) {
            this.onSegmentFlushDue?.();
        }
    }
}
