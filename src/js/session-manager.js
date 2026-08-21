/**
 * SessionManager — transcript persistence, periodic auto-save/temp-flush,
 * and the saved-sessions browser (list/open/copy/AI-summarize).
 *
 * CLAUDE.md invariant: sessionLog (owned by TranscriptUI) is never trimmed;
 * clearSession() is only called here after a successful final save.
 */

export class SessionManager {
    constructor({ transcriptUI, invoke, settingsManager, aiSummary, showToast, showView, getSessionMeta }) {
        this.transcriptUI = transcriptUI;
        this.invoke = invoke;
        this.settingsManager = settingsManager;
        this.aiSummary = aiSummary;
        this._showToast = showToast || (() => {});
        this._showView = showView || (() => {});
        this._getSessionMeta = getSessionMeta || (() => ({}));

        this._autoSaveTimer = null;
        this._currentSessionText = null;
        this._isSummarizing = false;
        this._summarizeController = null;
    }

    // ─── Event Binding ──────────────────────────────────────

    bindEvents() {
        // Sessions button
        document.getElementById('btn-sessions').addEventListener('click', () => {
            this._showView('sessions');
        });

        // Back from sessions
        document.getElementById('btn-sessions-back').addEventListener('click', () => {
            // Cancel any in-flight summary request when leaving sessions view
            this._cancelSummarize();
            this._showView('overlay');
        });

        // Back from session viewer to session list
        document.getElementById('btn-session-back-to-list').addEventListener('click', () => {
            document.getElementById('sessions-list-panel').style.display = '';
            document.getElementById('session-viewer').style.display = 'none';
            const summarySection = document.getElementById('session-summary-section');
            if (summarySection) summarySection.style.display = 'none';
            this._currentSessionText = null;
            // Cancel any in-flight summary request
            this._cancelSummarize();
        });

        // Copy session content
        document.getElementById('btn-session-copy').addEventListener('click', async () => {
            const content = document.getElementById('session-viewer-content')?.textContent || '';
            if (content) {
                await navigator.clipboard.writeText(content);
                this._showToast('Copied to clipboard', 'success');
            }
        });

        // Open saved transcripts folder (kept for Finder access)
        document.getElementById('btn-open-transcripts')?.addEventListener('click', async () => {
            try {
                await this.invoke('open_transcript_dir');
            } catch (err) {
                this._showToast('Failed to open folder: ' + err, 'error');
            }
        });

        // Summarize session with AI
        document.getElementById('btn-session-summarize')?.addEventListener('click', () => {
            this.summarizeSession();
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

        if (listPanel) listPanel.style.display = 'none';
        if (viewer) viewer.style.display = '';
        if (title) title.textContent = filename.replace('.md', '').replace('_', ' ');
        if (content) content.textContent = 'Loading...';
        if (summarySection) summarySection.style.display = 'none';
        this._currentSessionText = null;

        try {
            const text = await this.invoke('read_transcript', { filename });
            if (content) content.textContent = text;
            this._currentSessionText = text;
        } catch (err) {
            if (content) content.textContent = `Error loading session: ${err}`;
        }

        // Enable/disable summary button based on AI config
        const s = this.settingsManager.get();
        const summarizeBtn = document.getElementById('btn-session-summarize');
        if (summarizeBtn) {
            const configured = !!(s.ai_endpoint && s.ai_api_key && s.ai_model);
            summarizeBtn.disabled = !configured;
            summarizeBtn.title = configured ? 'Summarize with AI' : 'Configure AI in Settings first';
        }
    }

    async summarizeSession() {
        if (this._isSummarizing) return;
        const s = this.settingsManager.get();
        if (!s.ai_endpoint || !s.ai_api_key || !s.ai_model) {
            this._showToast('Configure AI settings first (Settings → AI tab)', 'error');
            return;
        }
        if (!this._currentSessionText) return;

        const btn = document.getElementById('btn-session-summarize');
        const section = document.getElementById('session-summary-section');
        const originalEl = document.getElementById('session-summary-original');
        const translatedEl = document.getElementById('session-summary-translated');

        // Loading state
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
        } catch (err) {
            if (originalEl) originalEl.textContent = `Error: ${err.message}`;
            if (translatedEl) translatedEl.textContent = '';
            this._showToast(`Summary failed: ${err.message}`, 'error');
        } finally {
            this._isSummarizing = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Summary`;
            }
        }
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
}
