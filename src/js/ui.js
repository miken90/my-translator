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
 */

export class TranscriptUI {
    constructor(container) {
        this.container = container;
        this.contentEl = null;
        this.maxChars = 1200;
        this.fontSize = 16;
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
    }

    /**
     * Update display settings
     */
    configure({ maxLines, fontSize, fontColor }) {
        if (maxLines !== undefined) this.maxChars = maxLines * 160;
        if (fontSize !== undefined) {
            this.fontSize = fontSize;
            this.container.style.setProperty('--transcript-font-size', `${fontSize}px`);
        }
        if (fontColor !== undefined) {
            this.fontColor = fontColor;
            this.container.style.setProperty('--transcript-font-color', fontColor);
        }
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
            const newSeg = {
                original: '',
                translation: text,
                status: 'translated',
                speaker: null,
                createdAt: Date.now(),
            };
            this.segments.push(newSeg);
            this.sessionLog.push({ ...newSeg });
        }
        this._render();
    }

    /**
     * Update provisional (in-progress) text
     */
    setProvisional(text, speaker, language) {
        this._removeListening();
        this.provisionalText = text;
        this.provisionalSpeaker = speaker || null;
        this.provisionalLanguage = language || null;
        this._render();
    }

    /**
     * Clear provisional text
     */
    clearProvisional() {
        this.provisionalText = '';
        this.provisionalSpeaker = null;
        this.provisionalLanguage = null;
        this._render();
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
        <p class="shortcut-hint">⌘ Enter</p>
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
    }

    /**
     * Update confidence score
     */
    setConfidence(confidence) {
        this.lastConfidence = confidence;
    }

    // ─── Internal ──────────────────────────────────────────

    _ensureContent() {
        if (!this.contentEl) {
            this.container.innerHTML = '';
            this.contentEl = document.createElement('div');
            this.contentEl.className = 'transcript-flow';
            this.container.appendChild(this.contentEl);
        }
    }

    _removeListening() {
        const indicator = this.container.querySelector('.listening-indicator');
        if (indicator) indicator.remove();
    }

    _render() {
        this._ensureContent();
        this._trimSegments();
        this._renderCards();
    }

    _renderCards() {
        let html = '';
        let lastRenderedSpeaker = null;
        let lastRenderedLang = null;

        for (const seg of this.segments) {
            const showSpeaker = seg.speaker && seg.speaker !== lastRenderedSpeaker;
            const showLang = seg.language && seg.language !== lastRenderedLang;

            if (showSpeaker) lastRenderedSpeaker = seg.speaker;
            if (showLang) lastRenderedLang = seg.language;

            const time = this._formatTime(seg.createdAt);

            // Card header (only if speaker or language changed)
            let headerHtml = '';
            if (showSpeaker || showLang) {
                headerHtml = '<div class="seg-header">';
                if (showSpeaker) headerHtml += `<span class="speaker-label">Speaker ${seg.speaker}</span>`;
                if (showLang) headerHtml += `<span class="lang-badge">${this._langEmoji(seg.language)}</span>`;
                headerHtml += `<span class="seg-time">${time}</span>`;
                headerHtml += '</div>';
            }

            if (seg.status === 'translated' && seg.translation) {
                const confidenceClass = (seg.confidence !== null && seg.confidence < 0.7) ? ' low-confidence' : '';
                html += `<div class="seg-card">`;
                html += headerHtml;
                html += `<div class="seg-original">${this._esc(seg.original || '')}</div>`;
                html += `<div class="seg-translation${confidenceClass}">${this._esc(seg.translation)}</div>`;
                html += `</div>`;
            } else if (seg.status === 'original' && seg.original) {
                const staleClass = seg.isStale ? ' seg-stale' : '';
                html += `<div class="seg-card${staleClass}">`;
                html += headerHtml;
                if (seg.isStale) {
                    html += `<div class="seg-original seg-stale-text">${this._esc(seg.original)}</div>`;
                } else {
                    html += `<div class="seg-original">${this._esc(seg.original)}</div>`;
                    html += `<div class="seg-translation pending">...</div>`;
                }
                html += `</div>`;
            }
        }

        // Provisional text (currently being recognized)
        if (this.provisionalText) {
            let provHeader = '';
            if (this.provisionalSpeaker && this.provisionalSpeaker !== lastRenderedSpeaker) {
                provHeader += `<span class="speaker-label">Speaker ${this.provisionalSpeaker}</span>`;
            }
            if (this.provisionalLanguage && this.provisionalLanguage !== lastRenderedLang) {
                provHeader += `<span class="lang-badge">${this._langEmoji(this.provisionalLanguage)}</span>`;
            }
            if (provHeader) provHeader = `<div class="seg-header">${provHeader}</div>`;

            html += `<div class="seg-card seg-provisional-card">`;
            html += provHeader;
            html += `<div class="seg-provisional">${this._esc(this.provisionalText)}</div>`;
            html += `</div>`;
        }

        this.contentEl.innerHTML = html;
        this._smartScroll(this.container.parentElement || this.container);
    }

    _formatTime(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    _smartScroll(el) {
        const isNearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 100;
        if (isNearBottom) {
            el.scrollTop = el.scrollHeight;
        }
    }

    _trimSegments() {
        let totalLen = 0;
        for (const seg of this.segments) {
            totalLen += (seg.translation || seg.original || '').length;
        }
        while (totalLen > this.maxChars && this.segments.length > 2) {
            // Only trim translated segments — never remove pending originals
            const removeIdx = this.segments.findIndex(s => s.status === 'translated');
            if (removeIdx === -1) break; // all pending, don't trim

            const [removed] = this.segments.splice(removeIdx, 1);
            totalLen -= (removed.translation || removed.original || '').length;
        }
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

    _esc(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get language flag emoji + code
     */
    _langEmoji(langCode) {
        const flags = {
            'en': '🇬🇧', 'ja': '🇯🇵', 'ko': '🇰🇷', 'zh': '🇨🇳',
            'vi': '🇻🇳', 'fr': '🇫🇷', 'de': '🇩🇪', 'es': '🇪🇸',
            'th': '🇹🇭', 'id': '🇮🇩', 'pt': '🇵🇹', 'ru': '🇷🇺',
            'ar': '🇸🇦', 'hi': '🇮🇳', 'it': '🇮🇹', 'nl': '🇳🇱',
            'pl': '🇵🇱', 'tr': '🇹🇷', 'sv': '🇸🇪', 'da': '🇩🇰',
            'no': '🇳🇴', 'fi': '🇫🇮', 'el': '🇬🇷', 'cs': '🇨🇿',
            'ro': '🇷🇴', 'hu': '🇭🇺', 'uk': '🇺🇦', 'he': '🇮🇱',
            'ms': '🇲🇾', 'tl': '🇵🇭', 'bn': '🇧🇩', 'ta': '🇱🇰',
        };
        const flag = flags[langCode] || '🌐';
        return `${flag} ${langCode.toUpperCase()}`;
    }
}
