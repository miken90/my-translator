/**
 * SessionManager — transcript persistence, periodic auto-save/temp-flush,
 * crash recovery, copy/export, AI summary persistence, and the saved-
 * sessions browser (list/open/copy/export/summarize/Q&A).
 *
 * CLAUDE.md invariant: sessionLog (owned by TranscriptUI) is never trimmed;
 * clearSession() is only called here after a successful final save.
 */

const SUMMARIZE_BTN_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';

export class SessionManager {
    constructor({ transcriptUI, invoke, settingsManager, aiSummary, sessionQA, showToast, showView, getSessionMeta }) {
        this.transcriptUI = transcriptUI;
        this.invoke = invoke;
        this.settingsManager = settingsManager;
        this.aiSummary = aiSummary;
        this.sessionQA = sessionQA;
        this._showToast = showToast || (() => {});
        this._showView = showView || (() => {});
        this._getSessionMeta = getSessionMeta || (() => ({}));

        this._autoSaveTimer = null;
        this._currentSessionText = null;
        this._currentSessionFilename = null;
        this._currentSessionHasSummary = false;
        this._isSummarizing = false;
        this._summarizeController = null;
        this._isAsking = false;
        this._qaController = null;
        this._pendingRecoveryContent = null;
    }

    // ─── Event Binding ──────────────────────────────────────

    bindEvents() {
        // Sessions button
        document.getElementById('btn-sessions').addEventListener('click', () => {
            this._showView('sessions');
        });

        // Back from sessions
        document.getElementById('btn-sessions-back').addEventListener('click', () => {
            this._cancelSummarize();
            this._resetQA();
            this._showView('overlay');
        });

        // Back from session viewer to session list
        document.getElementById('btn-session-back-to-list').addEventListener('click', () => {
            document.getElementById('sessions-list-panel').style.display = '';
            document.getElementById('session-viewer').style.display = 'none';
            const summarySection = document.getElementById('session-summary-section');
            if (summarySection) summarySection.style.display = 'none';
            this._currentSessionText = null;
            this._currentSessionFilename = null;
            this._cancelSummarize();
            this._resetQA();
        });

        // Copy session content (loaded past session)
        document.getElementById('btn-session-copy').addEventListener('click', async () => {
            const content = document.getElementById('session-viewer-content')?.textContent || '';
            if (content) {
                await navigator.clipboard.writeText(content);
                this._showToast('Copied to clipboard', 'success');
            }
        });

        // Export loaded past session
        document.getElementById('btn-session-export')?.addEventListener('click', () => {
            const format = document.getElementById('select-session-export-format')?.value || 'md';
            this.exportViewedSession(format);
        });

        // Export live/overlay session — format comes from Settings → Display
        // (the toolbar select was removed; the Export button remembers the
        // last chosen format via settingsManager persistence).
        document.getElementById('btn-export')?.addEventListener('click', () => {
            const format = this.settingsManager.get().export_format || 'md';
            this.exportSession(format);
        });

        // Open saved transcripts folder (kept for Finder access)
        document.getElementById('btn-open-transcripts')?.addEventListener('click', async () => {
            try {
                await this.invoke('open_transcript_dir');
            } catch (err) {
                this._showToast('Failed to open folder: ' + err, 'error');
            }
        });

        // Summarize/regenerate session with AI
        document.getElementById('btn-session-summarize')?.addEventListener('click', () => {
            this.summarizeSession();
        });

        // Crash recovery dialog
        document.getElementById('btn-recovery-recover')?.addEventListener('click', () => {
            this.recoverPendingTranscript();
        });
        document.getElementById('btn-recovery-discard')?.addEventListener('click', () => {
            this.discardPendingTranscript();
        });

        // Q&A
        document.getElementById('btn-qa-ask')?.addEventListener('click', () => this._askQuestion());
        document.getElementById('input-qa-question')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._askQuestion();
            }
        });
    }

    _cancelSummarize() {
        if (this._summarizeController) { this._summarizeController.abort(); this._summarizeController = null; }
        this._isSummarizing = false;
    }

    // ─── Transcript Persistence ───────────────────────────────

    formatDuration(ms) {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}m ${sec}s`;
    }

    async saveTranscriptFile() {
        const meta = this._getSessionMeta();
        const startMs = meta.recordingStartTime || Date.now();
        const durationMs = Date.now() - startMs;
        const duration = this.formatDuration(durationMs);

        // Use session metadata captured at start()
        const sourceLang = meta.sessionSourceLang || document.getElementById('select-source-lang')?.value || 'auto';
        const targetLang = meta.sessionTargetLang || document.getElementById('select-target-lang')?.value || 'vi';
        const mode = meta.sessionMode || 'one_way';

        const content = this.transcriptUI.getFullSessionText({
            model: 'Soniox Cloud API',
            sourceLang,
            targetLang,
            duration,
            mode,
            audioSource: meta.currentSource,
        });

        if (!content) return false;

        try {
            const path = await this.invoke('save_transcript', { content });
            const filename = path.split('/').pop();
            this._showToast(`Saved: ${filename}`, 'success');
            return true;
        } catch (err) {
            console.error('Failed to save transcript:', err);
            this._showToast('Failed to save transcript', 'error');
            return false;
        }
    }

    // Final save on stop — use full sessionLog (not trimmed display buffer).
    // clearSession() only runs after a successful save (CLAUDE.md invariant).
    async finalizeSession() {
        if (!this.transcriptUI.hasSessionContent()) return;
        const saved = await this.saveTranscriptFile();
        if (saved) {
            this.transcriptUI.clearSession();
            this.cleanupTempTranscript(); // Remove temp file after final save
        }
    }

    // ─── Periodic Auto-Save ───────────────────────────────────

    startAutoSave() {
        this.stopAutoSave();
        const FLUSH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
        this._autoSaveTimer = setInterval(() => this.flushTempTranscript(), FLUSH_INTERVAL_MS);
    }

    stopAutoSave() {
        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer);
            this._autoSaveTimer = null;
        }
    }

    async flushTempTranscript() {
        if (!this.transcriptUI.hasSessionContent()) return;
        const meta = this._getSessionMeta();
        const content = this.transcriptUI.getFullSessionText({
            model: 'Soniox Cloud API',
            sourceLang: meta.sessionSourceLang,
            targetLang: meta.sessionTargetLang,
            duration: this.formatDuration(Date.now() - (meta.recordingStartTime || Date.now())),
            mode: meta.sessionMode,
            audioSource: meta.currentSource,
        });
        if (!content) return;
        try {
            await this.invoke('save_transcript_temp', { content });
        } catch (err) {
            console.error('[AutoSave] Failed to flush temp transcript:', err);
        }
    }

    async cleanupTempTranscript() {
        try {
            await this.invoke('delete_transcript_temp');
        } catch (err) {
            // ignore — file may not exist
        }
    }

    // ─── Crash Recovery ───────────────────────────────────────

    // Call once at app startup. A leftover _recording.md means a previous
    // session ended without a graceful stop() (crash/kill) — offer to
    // recover it into a proper saved session, or discard it.
    async checkForOrphanTempTranscript() {
        let content;
        try {
            content = await this.invoke('read_transcript', { filename: '_recording.md' });
        } catch {
            return; // no orphan temp file — normal startup
        }
        if (!content || !content.trim()) {
            await this.cleanupTempTranscript();
            return;
        }
        this._pendingRecoveryContent = content;
        const dialog = document.getElementById('recovery-dialog');
        if (dialog) dialog.style.display = 'flex';
    }

    async recoverPendingTranscript() {
        if (!this._pendingRecoveryContent) return;
        try {
            const path = await this.invoke('save_transcript', { content: this._pendingRecoveryContent });
            const filename = path.split(/[\\/]/).pop();
            this._showToast(`Recovered: ${filename}`, 'success');
        } catch (err) {
            this._showToast('Failed to recover transcript: ' + err, 'error');
        } finally {
            await this.cleanupTempTranscript();
            this._pendingRecoveryContent = null;
            this._hideRecoveryDialog();
        }
    }

    async discardPendingTranscript() {
        await this.cleanupTempTranscript();
        this._pendingRecoveryContent = null;
        this._hideRecoveryDialog();
    }

    _hideRecoveryDialog() {
        const dialog = document.getElementById('recovery-dialog');
        if (dialog) dialog.style.display = 'none';
    }

    // ─── Copy / Export ─────────────────────────────────────────

    // Export the live/active session — always from sessionLog, never the
    // trimmed display buffer (existing invariant).
    async exportSession(format) {
        const meta = this._getSessionMeta();
        const content = this.transcriptUI.getExportText(format, {
            duration: this.formatDuration(Date.now() - (meta.recordingStartTime || Date.now())),
            sourceLang: meta.sessionSourceLang,
            targetLang: meta.sessionTargetLang,
        });
        if (!content) {
            this._showToast('Nothing to export yet', 'info');
            return;
        }
        await this._exportContent(content, format);
    }

    // Export a previously-saved session loaded in the sessions view. Reuses
    // the already-saved content (which itself was originally serialized
    // from sessionLog at save time); per-entry timestamps aren't available
    // post-hoc for old sessions (only session-level date/time/duration).
    async exportViewedSession(format) {
        if (!this._currentSessionText) {
            this._showToast('Nothing to export yet', 'info');
            return;
        }
        const content = format === 'txt' ? this._toPlainText(this._currentSessionText) : this._currentSessionText;
        await this._exportContent(content, format);
    }

    async _exportContent(content, format) {
        try {
            const path = await this.invoke('export_transcript', { content, extension: format });
            const filename = path.split(/[\\/]/).pop();
            this._showToast(`Exported: ${filename}`, 'success');
        } catch (err) {
            this._showToast('Failed to export: ' + err, 'error');
        }
    }

    // The saved session format's only markdown syntax is "**...**" bold
    // headers and "> " blockquote prefixes (see TranscriptUI methods) —
    // strip exactly those, nothing more.
    _toPlainText(mdContent) {
        return mdContent
            .split('\n')
            .map(line => line.replace(/^>\s?/, '').replace(/\*\*(.+?)\*\*/g, '$1'))
            .join('\n');
    }

    // ─── Session History ───────────────────────────────────

    async showSessions() {
        const listEl = document.getElementById('sessions-list');
        const listPanel = document.getElementById('sessions-list-panel');
        const viewer = document.getElementById('session-viewer');

        if (listPanel) listPanel.style.display = '';
        if (viewer) viewer.style.display = 'none';
        if (!listEl) return;

        listEl.innerHTML = '<div class="sessions-loading">Loading...</div>';

        try {
            const sessions = await this.invoke('list_transcripts');
            if (sessions.length === 0) {
                listEl.innerHTML = '<div class="sessions-empty">No saved sessions yet.</div>';
                return;
            }

            listEl.innerHTML = sessions.map(s => {
                const meta = this.parseSessionMeta(s);
                return `<div class="session-item" data-filename="${this._escAttr(s.filename)}">
                    <div class="session-item-date">${meta.date}</div>
                    <div class="session-item-meta">
                        <span class="session-item-time">${meta.time}</span>
                        ${meta.duration ? `<span class="session-item-duration">${meta.duration}</span>` : ''}
                        ${meta.langPair ? `<span class="session-item-langs">${meta.langPair}</span>` : ''}
                    </div>
                    <div class="session-item-size">${this.formatBytes(s.size_bytes)}</div>
                </div>`;
            }).join('');

            listEl.querySelectorAll('.session-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.openSession(item.dataset.filename);
                });
            });
        } catch (err) {
            listEl.innerHTML = `<div class="sessions-empty">Error: ${err}</div>`;
        }
    }

    async openSession(filename) {
        const listPanel = document.getElementById('sessions-list-panel');
        const viewer = document.getElementById('session-viewer');
        const title = document.getElementById('session-viewer-title');
        const content = document.getElementById('session-viewer-content');
        const summarySection = document.getElementById('session-summary-section');
        const originalEl = document.getElementById('session-summary-original');
        const translatedEl = document.getElementById('session-summary-translated');

        if (listPanel) listPanel.style.display = 'none';
        if (viewer) viewer.style.display = '';
        if (title) title.textContent = filename.replace('.md', '').replace('_', ' ');
        if (content) content.textContent = 'Loading...';
        if (summarySection) summarySection.style.display = 'none';
        this._currentSessionText = null;
        this._currentSessionFilename = filename;
        this._resetQA();

        try {
            const text = await this.invoke('read_transcript', { filename });
            if (content) content.textContent = text;
            this._currentSessionText = text;

            const existingSummary = this._parseExistingSummary(text);
            this._currentSessionHasSummary = !!existingSummary;
            if (existingSummary) {
                if (summarySection) summarySection.style.display = '';
                this._renderSummaryResult(originalEl, translatedEl, existingSummary);
            }
        } catch (err) {
            if (content) content.textContent = `Error loading session: ${err}`;
        }

        this._updateSummarizeButtonLabel();

        // Enable/disable AI-dependent controls (summarize + Q&A) based on config
        const s = this.settingsManager.get();
        const configured = !!(s.ai_endpoint && s.ai_api_key && s.ai_model);
        const summarizeBtn = document.getElementById('btn-session-summarize');
        if (summarizeBtn) {
            summarizeBtn.disabled = !configured;
            summarizeBtn.title = configured ? 'Summarize with AI' : 'Configure AI in Settings first';
        }
        const qaAskBtn = document.getElementById('btn-qa-ask');
        const qaInput = document.getElementById('input-qa-question');
        const qaHint = document.getElementById('qa-hint');
        if (qaAskBtn) qaAskBtn.disabled = !configured;
        if (qaInput) qaInput.disabled = !configured;
        if (qaHint) qaHint.style.display = configured ? 'none' : '';
    }

    async summarizeSession() {
        if (this._isSummarizing) return;
        const s = this.settingsManager.get();
        if (!s.ai_endpoint || !s.ai_api_key || !s.ai_model) {
            this._showToast('Configure AI settings first (Settings → AI tab)', 'error');
            return;
        }
        if (!this._currentSessionText || !this._currentSessionFilename) return;

        const btn = document.getElementById('btn-session-summarize');
        const section = document.getElementById('session-summary-section');
        const originalEl = document.getElementById('session-summary-original');
        const translatedEl = document.getElementById('session-summary-translated');

        this._isSummarizing = true;
        this._summarizeController = new AbortController();
        if (btn) { btn.disabled = true; btn.textContent = 'Summarizing...'; }
        if (section) section.style.display = '';
        if (originalEl) originalEl.textContent = 'Generating summary...';
        if (translatedEl) translatedEl.textContent = '';

        try {
            const result = await this.aiSummary.summarize(this._currentSessionText, {
                endpoint: s.ai_endpoint,
                apiKey: s.ai_api_key,
                model: s.ai_model,
                signal: this._summarizeController.signal,
            });

            this._renderSummaryResult(originalEl, translatedEl, result);

            // Persist: never let a save failure corrupt the transcript —
            // update_transcript writes temp + atomic rename. A failure here
            // leaves the on-disk file untouched; the user still sees the
            // freshly generated summary and can retry.
            try {
                const summarySection = this.aiSummary.formatSummarySection({ ...result, model: s.ai_model });
                const updatedContent = this.aiSummary.upsertSummarySection(this._currentSessionText, summarySection);
                await this.invoke('update_transcript', { filename: this._currentSessionFilename, content: updatedContent });
                this._currentSessionText = updatedContent;
                this._currentSessionHasSummary = true;
                this._showToast('Summary saved to session', 'success');
            } catch (persistErr) {
                console.error('Failed to persist summary:', persistErr);
                this._showToast('Summary generated but failed to save to session file', 'error');
            }
        } catch (err) {
            if (originalEl) originalEl.textContent = `Error: ${err.message}`;
            if (translatedEl) translatedEl.textContent = '';
            this._showToast(`Summary failed: ${err.message}`, 'error');
        } finally {
            this._isSummarizing = false;
            if (btn) btn.disabled = false;
            this._updateSummarizeButtonLabel();
        }
    }

    _renderSummaryResult(originalEl, translatedEl, result) {
        if (originalEl) {
            originalEl.innerHTML = '';
            const origLabel = document.createElement('strong');
            origLabel.textContent = 'Original';
            const origText = document.createElement('p');
            origText.textContent = result.original;
            originalEl.append(origLabel, origText);
        }
        if (translatedEl) {
            translatedEl.innerHTML = '';
            const transLabel = document.createElement('strong');
            transLabel.textContent = 'Translated';
            const transText = document.createElement('p');
            transText.textContent = result.translated;
            translatedEl.append(transLabel, transText);
        }
    }

    _updateSummarizeButtonLabel() {
        const btn = document.getElementById('btn-session-summarize');
        if (!btn) return;
        btn.innerHTML = `${SUMMARIZE_BTN_ICON} ${this._currentSessionHasSummary ? 'Regenerate' : 'Summary'}`;
    }

    // Extract an existing "## AI Summary" section's Original/Translated text
    // (mirrors aiSummary.formatSummarySection's exact layout).
    _parseExistingSummary(text) {
        const idx = text.indexOf('## AI Summary');
        if (idx === -1) return null;
        const section = text.slice(idx);
        const originalMatch = section.match(/\*\*Original\*\*\s*\n+([\s\S]*?)\n+\*\*Translated\*\*/);
        const translatedMatch = section.match(/\*\*Translated\*\*\s*\n+([\s\S]*?)(?:\n##|$)/);
        if (!originalMatch) return null;
        return {
            original: originalMatch[1].trim(),
            translated: translatedMatch ? translatedMatch[1].trim() : '',
        };
    }

    parseSessionMeta(session) {
        // created_at format: "2026-03-27 10:21:05"
        const parts = (session.created_at || '').split(' ');
        const date = parts[0] || '';
        const time = parts[1] ? parts[1].slice(0, 5) : '';
        return { date, time, duration: '', langPair: '' };
    }

    formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    _escAttr(str) {
        return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ─── Transcript Q&A ─────────────────────────────────────

    // No history persistence beyond the session file (KISS) — messages
    // live only in the DOM for the current sessions-view visit.
    async _askQuestion() {
        const input = document.getElementById('input-qa-question');
        const question = input?.value?.trim();
        if (!question || this._isAsking) return;

        const s = this.settingsManager.get();
        if (!s.ai_endpoint || !s.ai_api_key || !s.ai_model) {
            this._appendQAMessage('system', 'Configure AI settings first (Settings → AI tab) to use transcript Q&A.');
            return;
        }
        if (!this._currentSessionText) return;

        this._appendQAMessage('user', question);
        if (input) input.value = '';

        this._isAsking = true;
        this._qaController = new AbortController();
        const askBtn = document.getElementById('btn-qa-ask');
        if (askBtn) askBtn.disabled = true;
        const answerEl = this._appendQAMessage('assistant', 'Thinking...');

        try {
            const answer = await this.sessionQA.ask(question, this._currentSessionText, {
                endpoint: s.ai_endpoint,
                apiKey: s.ai_api_key,
                model: s.ai_model,
                signal: this._qaController.signal,
            });
            if (answerEl) answerEl.textContent = answer || '(empty response)';
        } catch (err) {
            if (answerEl) answerEl.textContent = `Error: ${err.message}`;
        } finally {
            this._isAsking = false;
            if (askBtn) askBtn.disabled = false;
        }
    }

    _appendQAMessage(role, text) {
        const list = document.getElementById('qa-messages');
        if (!list) return null;
        const msgEl = document.createElement('div');
        msgEl.className = `qa-message qa-message-${role}`;
        msgEl.textContent = text;
        list.appendChild(msgEl);
        list.scrollTop = list.scrollHeight;
        return msgEl;
    }

    _resetQA() {
        this._cancelAsk();
        const list = document.getElementById('qa-messages');
        if (list) list.innerHTML = '';
        const input = document.getElementById('input-qa-question');
        if (input) input.value = '';
    }

    _cancelAsk() {
        if (this._qaController) { this._qaController.abort(); this._qaController = null; }
        this._isAsking = false;
    }
}
