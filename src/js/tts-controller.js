/**
 * TTSController — provider selection, on/off toggle, and callback wiring
 * for the 3 TTS providers driven by the audioPlayer (edge, google, elevenlabs).
 */

export class TTSController {
    constructor({ settingsManager, audioPlayer, showToast, showView, providers, isSessionRunning }) {
        this.settingsManager = settingsManager;
        this.audioPlayer = audioPlayer;
        this._showToast = showToast || (() => {});
        this._showView = showView || (() => {});
        this.providers = providers; // { edge, google, elevenlabs }
        this._isSessionRunning = isSessionRunning || (() => false);
        this.ttsEnabled = false;  // TTS runtime toggle
    }

    // ─── Event Binding ──────────────────────────────────────

    bindEvents() {
        document.getElementById('btn-tts').addEventListener('click', () => {
            this.toggle();
        });
    }

    // Single-pass loop wiring both callbacks (replaces the old double loop)
    wireCallbacks(onError) {
        for (const tts of Object.values(this.providers)) {
            tts.onAudioChunk = (base64Audio) => {
                this.audioPlayer.enqueue(base64Audio);
            };
            tts.onError = (error) => {
                console.error('[TTS]', error);
                onError(error);
            };
        }
    }

    // ─── TTS Control ──────────────────────────────────────

    getActive() {
        const settings = this.settingsManager.get();
        const provider = settings.tts_provider || 'edge';
        if (provider === 'elevenlabs') return this.providers.elevenlabs;
        if (provider === 'google') return this.providers.google;
        return this.providers.edge;
    }

    configure(tts, settings) {
        const provider = settings.tts_provider || 'edge';
        if (provider === 'elevenlabs') {
            tts.configure({
                apiKey: settings.elevenlabs_api_key,
                voiceId: settings.tts_voice_id || '21m00Tcm4TlvDq8ikWAM',
            });
        } else if (provider === 'google') {
            const voice = settings.google_tts_voice || 'vi-VN-Chirp3-HD-Aoede';
            const langCode = voice.replace(/-Chirp3.*/, '');
            tts.configure({
                apiKey: settings.google_tts_api_key,
                voice: voice,
                languageCode: langCode,
                speakingRate: settings.google_tts_speed || 1.0,
            });
        } else {
            tts.configure({
                voice: settings.edge_tts_voice || 'vi-VN-HoaiMyNeural',
                speed: settings.edge_tts_speed !== undefined ? settings.edge_tts_speed : 20,
            });
        }
    }

    toggle() {
        const settings = this.settingsManager.get();
        const provider = settings.tts_provider || 'edge';

        // Block TTS in two-way mode to prevent audio feedback loop
        const translationType = document.getElementById('select-translation-type')?.value;
        if (translationType === 'two_way') {
            this._showToast('TTS is disabled in two-way mode to prevent audio loop', 'error');
            return;
        }

        // Check API key for premium providers
        if (provider === 'elevenlabs' && !settings.elevenlabs_api_key) {
            this._showToast('Add ElevenLabs API key in Settings → TTS', 'error');
            this._showView('settings');
            return;
        }
        if (provider === 'google' && !settings.google_tts_api_key) {
            this._showToast('Add Google TTS API key in Settings → TTS', 'error');
            this._showView('settings');
            return;
        }

        this.ttsEnabled = !this.ttsEnabled;
        this.updateButton();

        const tts = this.getActive();

        if (this.ttsEnabled) {
            this.configure(tts, settings);
            if (this._isSessionRunning()) {
                tts.connect();
                this.audioPlayer.resume();
            }
            const label = { edge: 'Edge TTS (Free)', google: 'Google Chirp 3 HD', elevenlabs: 'ElevenLabs' }[provider] || provider;
            this._showToast(`TTS narration ON 🔊 (${label})`, 'success');
        } else {
            tts.disconnect();
            this.audioPlayer.stop();
            this._showToast('TTS narration OFF 🔇', 'success');
        }
    }

    // Called from App.start() once a session is confirmed to begin
    onSessionStart(settings) {
        if (!this.ttsEnabled) return;
        const tts = this.getActive();
        this.configure(tts, settings);
        tts.connect();
        this.audioPlayer.resume();
    }

    // Called from App.stop() — matches pre-refactor behavior of only
    // disconnecting the elevenlabs/edge providers (google is REST, stateless).
    disconnectKnownProviders() {
        this.providers.elevenlabs.disconnect();
        this.providers.edge.disconnect();
        this.audioPlayer.stop();
    }

    updateButton() {
        const btn = document.getElementById('btn-tts');
        const iconOff = document.getElementById('icon-tts-off');
        const iconOn = document.getElementById('icon-tts-on');
        const isTwoWay = document.getElementById('select-translation-type')?.value === 'two_way';

        if (btn) {
            btn.classList.toggle('active', this.ttsEnabled);
            btn.classList.toggle('disabled', isTwoWay);
            btn.title = isTwoWay ? 'TTS disabled in two-way mode' : 'Toggle TTS (Ctrl+T)';
        }
        if (iconOff) iconOff.style.display = this.ttsEnabled ? 'none' : 'block';
        if (iconOn) iconOn.style.display = this.ttsEnabled ? 'block' : 'none';
    }

    speakIfEnabled(text) {
        if (this.ttsEnabled && text?.trim()) {
            this.getActive().speak(text);
        }
    }

    // Cross-module effect of switching translation type: two-way mode force-disables
    // TTS (to prevent audio feedback loop) and the button always refreshes to match.
    handleTranslationTypeChange(type) {
        if (type === 'two_way' && this.ttsEnabled) {
            this.ttsEnabled = false;
            this.getActive().disconnect();
            this.audioPlayer.stop();
        }
        this.updateButton();
    }

    // TTS is always OFF on app start — user must toggle on each session
    resetForAppStart() {
        this.ttsEnabled = false;
        this.updateButton();
    }
}
