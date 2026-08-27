/**
 * App — main application controller
 * Wires together: settings, UI, Soniox client, and audio capture
 */

import { settingsManager } from './settings.js';
import { TranscriptUI } from './ui.js';
import { sonioxClient } from './soniox.js';
import { elevenLabsTTS } from './tts/elevenlabs-tts.js';
import { googleTTS } from './tts/google-tts.js';
import { edgeTTSRust } from './tts/edge-tts.js';
import { audioPlayer } from './audio-player.js';
import { aiSummary } from './ai-summary.js';
import { sessionQA } from './session-qa.js';
import { WindowManager } from './window-manager.js';
import { SettingsFormController } from './settings-form-controller.js';
import { SessionManager } from './session-manager.js';
import { TTSController } from './tts-controller.js';
import { SessionState, isToggleBlocked } from './session-state.js';
import { showToast } from './toast.js';
import { updateStatusIndicator, startElapsedTimer, stopElapsedTimer } from './status-indicator.js';
import { initHeaderMenu } from './header-menus.js';

const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

const SOURCE_BUTTONS = [['btn-source-system', 'system'], ['btn-source-mic', 'microphone'], ['btn-source-both', 'both']];

// Leading split-button icon + aria-label per source (Meet mic-device pattern —
// the button shown before the ▾ chevron reflects the current selection).
const SOURCE_ICON_HTML = {
    system: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    microphone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    both: '<svg width="14" height="12" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="9 6 5 9 2 9 2 15 5 15 9 18 9 6"/><path d="M12.5 9.5a3 3 0 0 1 0 5"/><path d="M20 4a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0v-5A2.5 2.5 0 0 0 20 4z"/><path d="M25 10v1.5a5 5 0 0 1-10 0V10"/></svg>',
};
const SOURCE_LABELS = { system: 'System Audio', microphone: 'Microphone', both: 'System + Mic' };

export class App {
    constructor() {
        this.sessionState = SessionState.IDLE;
        this.currentSource = 'system'; // 'system' | 'microphone' | 'both'
        this.translationMode = 'soniox';
        this.transcriptUI = null;
        this.appWindow = getCurrentWindow();
        this.recordingStartTime = null;
        this.sessionStartTime = null;  // Session start timestamp (new Date())
        this.sessionSourceLang = 'auto';
        this.sessionTargetLang = 'vi';
        this.sessionMode = 'one_way';
        this._autoSaveTimer = null; // Periodic auto-save interval
        this.windowManager = new WindowManager(this.appWindow, {
            showToast: (msg, type) => this._showToast(msg, type),
        });
        this.ttsController = new TTSController({
            settingsManager,
            audioPlayer,
            showToast: (msg, type) => this._showToast(msg, type),
            showView: (view) => this._showView(view),
            providers: { edge: edgeTTSRust, google: googleTTS, elevenlabs: elevenLabsTTS },
            isSessionRunning: () => this.isRunning,
        });
        this.settingsFormController = new SettingsFormController({
            settingsManager,
            appWindow: this.appWindow,
            showToast: (msg, type) => this._showToast(msg, type),
            showView: (view) => this._showView(view),
            onTranslationTypeChange: (type) => this.ttsController.handleTranslationTypeChange(type),
            getTranscriptUI: () => this.transcriptUI,
        });
        this.sessionManager = new SessionManager({
            transcriptUI: null, // set once TranscriptUI is created in init()
            invoke,
            settingsManager,
            aiSummary,
            sessionQA,
            showToast: (msg, type) => this._showToast(msg, type),
            showView: (view) => this._showView(view),
            getSessionMeta: () => ({
                recordingStartTime: this.recordingStartTime,
                sessionSourceLang: this.sessionSourceLang,
                sessionTargetLang: this.sessionTargetLang,
                sessionMode: this.sessionMode,
                currentSource: this.currentSource,
            }),
        });
    }

    // Derived getter — true only while a session is actually connected/listening.
    // Kept for readability at existing call sites (was a plain boolean field).
    get isRunning() {
        return this.sessionState === SessionState.LISTENING;
    }

    async init() {
        // Load settings
        await settingsManager.load();

        // Init transcript UI
        const transcriptContainer = document.getElementById('transcript-content');
        this.transcriptUI = new TranscriptUI(transcriptContainer);
        this.sessionManager.transcriptUI = this.transcriptUI;
        // Crash-safe logging: flush the temp transcript every 20 segments,
        // in addition to session-manager's own 2-minute timer.
        this.transcriptUI.onSegmentFlushDue = () => this.sessionManager.flushTempTranscript();

        // Apply saved settings to UI
        this._applySettings(settingsManager.get());

        // Bind event listeners
        this._bindEvents();
        this.settingsFormController.bindEvents();
        this.sessionManager.bindEvents();
        this.ttsController.bindEvents();
        this.windowManager.bindEvents({ stopSession: () => this.stop() });

        // Startup crash recovery: an orphan _recording.md means the previous
        // session ended without a graceful stop() (crash/kill).
        await this.sessionManager.checkForOrphanTempTranscript();

        // Bind keyboard shortcuts
        this._bindKeyboardShortcuts();

        // Subscribe to settings changes
        settingsManager.onChange((settings) => this._applySettings(settings));

        // Init audio player for TTS
        audioPlayer.init();

        // Wire TTS audio/error callbacks for providers that use audioPlayer
        this.ttsController.wireCallbacks((error) => this._showToast(error, 'error'));

        this._initAboutTab();

        console.log('🌐 My Translator v0.5.0 initialized');
    }

    // ─── Event Binding ──────────────────────────────────────

    _bindEvents() {
        // Settings button
        document.getElementById('btn-settings').addEventListener('click', () => {
            this._showView('settings');
        });

        // Back from settings
        document.getElementById('btn-back').addEventListener('click', () => {
            this._showView('overlay');
        });

        // Start/Stop button
        document.getElementById('btn-start').addEventListener('click', () => {
            this._handleStartStopToggle();
        });

        // Header popovers: mic split-button's source menu + ⋯ overflow menu
        this._sourceMenu = initHeaderMenu({
            triggers: [document.getElementById('btn-source-current'), document.getElementById('btn-source-menu-toggle')],
            menuEl: document.getElementById('menu-source'),
            ariaOwner: document.getElementById('btn-source-menu-toggle'),
        });
        this._overflowMenu = initHeaderMenu({
            triggers: [document.getElementById('btn-overflow-toggle')],
            menuEl: document.getElementById('menu-overflow'),
        });

        // Source buttons (now rows inside the source menu)
        SOURCE_BUTTONS.forEach(([id, source]) => {
            document.getElementById(id).addEventListener('click', () => {
                this._setSource(source);
                this._sourceMenu.close();
            });
        });

        // Clear button — clears display only (session continues for save purposes)
        document.getElementById('btn-clear').addEventListener('click', async () => {
            this.transcriptUI.clear();
            this.transcriptUI.showPlaceholder();
            this._overflowMenu.close();
        });

        // Copy transcript button
        document.getElementById('btn-copy').addEventListener('click', async () => {
            const text = this.transcriptUI.getFullPlainText();
            if (text) {
                await navigator.clipboard.writeText(text);
                this._showToast('Copied to clipboard', 'success');
            } else {
                this._showToast('Nothing to copy', 'info');
            }
            this._overflowMenu.close();
        });

        // Wire Soniox callbacks
        sonioxClient.onOriginal = (text, speaker, language) => {
            this.transcriptUI.addOriginal(text, speaker, language);
        };

        sonioxClient.onTranslation = (text) => {
            this.transcriptUI.addTranslation(text);
            this.ttsController.speakIfEnabled(text);
        };

        sonioxClient.onProvisional = (text, speaker, language) => {
            if (text) {
                this.transcriptUI.setProvisional(text, speaker, language);
            } else {
                this.transcriptUI.clearProvisional();
            }
        };

        sonioxClient.onStatusChange = (status) => {
            this._updateStatus(status);
        };

        sonioxClient.onError = (error) => {
            this._showToast(error, 'error');
        };

        sonioxClient.onConfidence = (avgConfidence) => {
            this.transcriptUI.setConfidence(avgConfidence);
        };
    }

    // ─── Keyboard Shortcuts ─────────────────────────────────

    // Cmd/Ctrl + <key> shortcuts, dispatched from a lookup table (Escape is
    // handled separately below since it doesn't need the modifier key).
    _keyboardShortcutActions() {
        return {
            'Enter': () => this._handleStartStopToggle(),
            ',': () => this._showView('settings'),
            '1': () => this._setSource('system'),
            '2': () => this._setSource('microphone'),
            '3': () => this._setSource('both'),
            't': () => this.ttsController.toggle(),
            'm': () => this.appWindow.minimize(),
            'p': () => this.windowManager.togglePin(),
            'd': () => this.windowManager.toggleCompact(),
            // Overflow-menu actions (design-spec.md §5 — Ctrl+C/E hints shown
            // in the ⋯ menu).
            'c': () => document.getElementById('btn-copy').click(),
            'e': () => document.getElementById('btn-export').click(),
        };
    }

    _isOverlayActive() {
        return document.getElementById('overlay-view').classList.contains('active');
    }

    _bindKeyboardShortcuts() {
        const actions = this._keyboardShortcutActions();
        // Shortcuts gated on the overlay view being active — the sessions
        // view has its own copy/export controls, and its
        // session-content-scroll allows real text selection, so Ctrl+C
        // there must stay native selection-copy instead of being
        // preventDefault()-ed away.
        const overlayOnlyKeys = new Set(['c', 'e']);
        document.addEventListener('keydown', (e) => {
            // Ignore when typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Escape: Go back to overlay / close settings
            if (e.key === 'Escape') {
                e.preventDefault();
                const settingsVisible = document.getElementById('settings-view').classList.contains('active');
                if (settingsVisible) {
                    this._showView('overlay');
                }
                return;
            }

            if (!(e.metaKey || e.ctrlKey)) return;
            const action = actions[e.key];
            if (!action) return;
            if (overlayOnlyKeys.has(e.key) && !this._isOverlayActive()) return;
            e.preventDefault();
            action();
        });
    }

    // ─── Views ──────────────────────────────────────────────

    _showView(view) {
        document.getElementById('overlay-view').classList.toggle('active', view === 'overlay');
        document.getElementById('settings-view').classList.toggle('active', view === 'settings');
        document.getElementById('sessions-view').classList.toggle('active', view === 'sessions');

        if (view === 'settings') {
            this.settingsFormController.populateForm();
        }
        if (view === 'sessions') {
            this.sessionManager.showSessions();
        }
    }

    // ─── Apply Settings ────────────────────────────────────

    _applySettings(settings) {
        // Update overlay opacity. This drives `#overlay-view::after` (the background
        // layer) via a custom property, NOT element opacity — element opacity is a
        // group operation that fades the transcript and controls along with the panel.
        const overlayView = document.getElementById('overlay-view');
        overlayView.style.setProperty('--overlay-opacity', settings.overlay_opacity || 0.85);

        // Update transcript UI
        if (this.transcriptUI) {
            // lang attr on translated text: only meaningful in one-way mode,
            // where every translation shares one target language. Two-way
            // mode's direction varies per segment, so it's left unset.
            const isOneWay = (settings.translation_type || 'one_way') === 'one_way';
            this.transcriptUI.configure({
                maxLines: settings.max_lines || 5,
                fontSize: settings.font_size || 16,
                targetLang: isOneWay ? (settings.target_language || 'vi') : null,
            });
        }

        // Update current source button states
        this.currentSource = settings.audio_source || 'system';
        this._updateSourceButtons();

        // TTS is always OFF on app start — user must toggle on each session
        this.ttsController.resetForAppStart();
    }

    // ─── Source Control ────────────────────────────────────

    _setSource(source) {
        const wasRunning = this.isRunning;
        const labels = { system: 'System Audio', microphone: 'Microphone', both: 'System + Mic' };
        const label = labels[source] || source;

        // If currently running, restart with new source
        if (wasRunning) {
            this.stop().then(() => {
                this.currentSource = source;
                this._updateSourceButtons();
                this._showToast(`Switched to ${label}`, 'success');
                this.start();
            });
        } else {
            this.currentSource = source;
            this._updateSourceButtons();
            this._showToast(`Source: ${label}`, 'success');
        }
    }

    _updateSourceButtons() {
        SOURCE_BUTTONS.forEach(([id, source]) => {
            const isSelected = this.currentSource === source;
            const btn = document.getElementById(id);
            btn.classList.toggle('active', isSelected);
            btn.setAttribute('aria-checked', String(isSelected));
        });

        // Split-button leading icon reflects the current source (Meet
        // mic-device chevron pattern) — swaps glyph + label, never the
        // menu's own check marks (handled above via aria-checked).
        const current = document.getElementById('btn-source-current');
        if (current) {
            const label = SOURCE_LABELS[this.currentSource] || this.currentSource;
            current.innerHTML = SOURCE_ICON_HTML[this.currentSource] || SOURCE_ICON_HTML.system;
            current.setAttribute('aria-label', `Audio source: ${label}`);
        }
    }

    // ─── Start/Stop ────────────────────────────────────────

    // Single entry point for the start/stop button and its keyboard shortcut.
    // `CONNECTING` guards re-entrancy while start() is in flight (was `isStarting`);
    // `STOPPING` additionally guards a toggle click while stop() is tearing down.
    async _handleStartStopToggle() {
        if (isToggleBlocked(this.sessionState)) return;
        try {
            if (this.sessionState === SessionState.LISTENING) {
                await this.stop();
            } else {
                this.sessionState = SessionState.CONNECTING;
                await this.start();
                if (this.sessionState === SessionState.CONNECTING) {
                    // start() returned early (e.g. missing API key) without reaching LISTENING
                    this.sessionState = SessionState.IDLE;
                }
            }
        } catch (err) {
            console.error('[App] Start/Stop error:', err);
            this._showToast(`Error: ${err}`, 'error');
            this.sessionState = SessionState.IDLE;
            this._updateStartButton();
            this._updateStatus('error');
        }
    }

    async start() {
        const settings = settingsManager.get();
        this.translationMode = settings.translation_mode || 'soniox';
        console.log('[App] start() called, translation_mode:', this.translationMode, 'settings:', JSON.stringify(settings));

        // Check Soniox API key only for cloud mode
        if (this.translationMode === 'soniox' && !settings.soniox_api_key) {
            this._showToast('Soniox API key is required. Add it in Settings.', 'error');
            this._showView('settings');
            return;
        }

        // Check ElevenLabs key only if TTS is enabled AND provider is elevenlabs
        if (this.ttsController.ttsEnabled && settings.tts_provider === 'elevenlabs' && !settings.elevenlabs_api_key) {
            this._showToast('TTS is ON but ElevenLabs API key is missing. Add it in Settings or disable TTS.', 'error');
            this._showView('settings');
            return;
        }

        this.sessionState = SessionState.LISTENING;
        this._updateStartButton();
        if (!this.recordingStartTime) this.recordingStartTime = Date.now();
        startElapsedTimer(this.recordingStartTime);

        // Record session metadata for auto-save
        if (!this.sessionStartTime) {
            this.sessionStartTime = new Date();
            const translationType = settings.translation_type || 'one_way';
            this.sessionMode = translationType;
            if (translationType === 'two_way') {
                this.sessionSourceLang = settings.language_a || 'ja';
                this.sessionTargetLang = settings.language_b || 'vi';
            } else {
                this.sessionSourceLang = settings.source_language || 'auto';
                this.sessionTargetLang = settings.target_language || 'vi';
            }
        }

        // Clear transcript only if nothing is showing
        if (!this.transcriptUI.hasContent()) {
            this.transcriptUI.showListening();
        } else {
            this.transcriptUI.clearProvisional();
        }

        await this._startSonioxMode(settings);

        // Start TTS if enabled
        this.ttsController.onSessionStart(settings);

        // Start periodic auto-save (every 2 min)
        this.sessionManager.startAutoSave();
    }

    async _startSonioxMode(settings) {
        // Connect to Soniox
        console.log('[App] Connecting to Soniox...');
        this._updateStatus('connecting');
        sonioxClient.connect({
            apiKey: settings.soniox_api_key,
            sourceLanguage: settings.source_language,
            targetLanguage: settings.target_language,
            customContext: settings.custom_context,
            translationType: settings.translation_type || 'one_way',
            languageA: settings.language_a,
            languageB: settings.language_b,
            languageHintsStrict: settings.language_hints_strict || false,
            endpointDelay: settings.endpoint_delay || 1500,
        });

        // Start audio capture — Rust batches audio every 100ms, JS just forwards
        try {
            let audioChunkCount = 0;

            const channel = new window.__TAURI__.core.Channel();
            channel.onmessage = (pcmData) => {
                audioChunkCount++;
                if (audioChunkCount <= 3 || audioChunkCount % 50 === 0) {
                    console.log(`[Audio] Batch #${audioChunkCount}, size:`, pcmData?.length || 0);
                }
                // Forward batched audio to Soniox
                const bytes = new Uint8Array(pcmData);
                sonioxClient.sendAudio(bytes.buffer);
            };

            console.log('[App] Starting audio capture, source:', this.currentSource);
            await invoke('start_capture', {
                source: this.currentSource,
                channel: channel,
            });
            console.log('[App] Audio capture started successfully');
        } catch (err) {
            console.error('Failed to start audio capture:', err);
            this._showToast(`Audio error: ${err}`, 'error');
            await this.stop();
        }
    }

    async stop() {
        this.sessionState = SessionState.STOPPING;
        this._updateStartButton();
        stopElapsedTimer();

        // Stop audio capture
        try {
            await invoke('stop_capture');
        } catch (err) {
            console.error('Failed to stop audio capture:', err);
        }

        // Disconnect Soniox
        sonioxClient.disconnect();

        // Keep transcript visible — don't clear. Retire the transient
        // "Listening..." indicator (stop() never removed it before — if no
        // content ever arrived it would sit there forever, blocking even
        // the next start() from restoring it, since hasContent() counted
        // the stray indicator itself as "content").
        this.transcriptUI.clearProvisional();
        this.transcriptUI.stopListening();

        // Stop TTS
        this.ttsController.disconnectKnownProviders();

        // Stop periodic auto-save
        this.sessionManager.stopAutoSave();

        // Final save on stop — use full sessionLog (not trimmed display buffer)
        await this.sessionManager.finalizeSession();

        this.sessionState = SessionState.IDLE;

        // Reset session tracking
        this.sessionStartTime = null;
        this.recordingStartTime = null;
    }

    _updateStartButton() {
        const btn = document.getElementById('btn-start');
        const iconPlay = document.getElementById('icon-play');
        const iconStop = document.getElementById('icon-stop');

        btn.classList.toggle('recording', this.isRunning);
        iconPlay.style.display = this.isRunning ? 'none' : 'block';
        iconStop.style.display = this.isRunning ? 'block' : 'none';
    }

    // ─── Status ────────────────────────────────────────────

    _updateStatus(status) {
        updateStatusIndicator(status);
    }

    // ─── Toast ─────────────────────────────────────────────

    _initAboutTab() {
        // GitHub links
        [['link-github', 'https://github.com/phuc-nt/my-translator'],
         ['link-issues', 'https://github.com/phuc-nt/my-translator/issues']].forEach(([id, url]) => {
            document.getElementById(id)?.addEventListener('click', (e) => {
                e.preventDefault();
                window.__TAURI__?.opener?.openUrl(url);
            });
        });

        // Running version — left as "—" (placeholder in the HTML) on failure,
        // never a hardcoded/stale string.
        window.__TAURI__?.app?.getVersion?.().then((version) => {
            const el = document.getElementById('about-version');
            if (el && version) el.textContent = `v${version}`;
        }).catch((err) => {
            console.error('Failed to read app version:', err);
        });
    }

    _showToast(message, type = 'success') {
        showToast(message, type);
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
