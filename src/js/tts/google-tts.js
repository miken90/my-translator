/**
 * Google Cloud TTS (Chirp 3 HD) — Frontend module
 * Direct REST API call from JS, no backend needed.
 * Returns base64 audio, played via audioPlayer.
 */

import { BaseTTSProvider } from './base-tts-provider.js';

const GOOGLE_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const REQUEST_TIMEOUT_MS = 10000;

// Voice map: target language → default Chirp 3 HD voice
const VOICE_MAP = {
    'vi': { code: 'vi-VN', name: 'vi-VN-Chirp3-HD-Aoede' },
    'en': { code: 'en-US', name: 'en-US-Chirp3-HD-Kore' },
    'ja': { code: 'ja-JP', name: 'ja-JP-Chirp3-HD-Aoede' },
    'ko': { code: 'ko-KR', name: 'ko-KR-Chirp3-HD-Aoede' },
    'zh': { code: 'zh-CN', name: 'cmn-CN-Chirp3-HD-Aoede' },
    'fr': { code: 'fr-FR', name: 'fr-FR-Chirp3-HD-Aoede' },
    'de': { code: 'de-DE', name: 'de-DE-Chirp3-HD-Aoede' },
    'es': { code: 'es-ES', name: 'es-ES-Chirp3-HD-Aoede' },
};

class GoogleTTS extends BaseTTSProvider {
    constructor() {
        super();
        this.apiKey = '';
        this.voice = 'vi-VN-Chirp3-HD-Aoede';
        this.languageCode = 'vi-VN';
        this.speakingRate = 1.0;
    }

    configure({ apiKey, voice, languageCode, speakingRate }) {
        if (apiKey) this.apiKey = apiKey;
        if (voice) this.voice = voice;
        if (languageCode) this.languageCode = languageCode;
        if (speakingRate !== undefined) this.speakingRate = speakingRate;
    }

    /**
     * Auto-select voice based on target language
     */
    setTargetLanguage(lang) {
        const mapping = VOICE_MAP[lang];
        if (mapping) {
            this.languageCode = mapping.code;
            this.voice = mapping.name;
        }
    }

    connect() {
        if (!this.apiKey) {
            this.onError?.('Google TTS API key is missing');
            return;
        }
        this.isConnected = true;
        this._setStatus('connected');
        console.log('[Google TTS] Ready (Chirp 3 HD)');
    }

    async _synthesize(text) {
        const startTime = performance.now();

        try {
            const response = await this._fetchWithTimeout(`${GOOGLE_TTS_ENDPOINT}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text },
                    voice: {
                        languageCode: this.languageCode,
                        name: this.voice,
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: this.speakingRate,
                    },
                }),
            }, REQUEST_TIMEOUT_MS);

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                const msg = err.error?.message || `HTTP ${response.status}`;
                throw new Error(msg);
            }

            const data = await response.json();
            const elapsed = performance.now() - startTime;
            console.log(`[Google TTS] Audio received in ${elapsed.toFixed(0)}ms`);

            if (data.audioContent && this.onAudioChunk) {
                this.onAudioChunk(data.audioContent, true);
            }
        } catch (err) {
            console.error('[Google TTS] Error:', err);
            let msg = err.name === 'AbortError' ? 'request timed out' : err.message;
            if (msg.includes('blocked')) {
                msg = 'API blocked — enable "Cloud Text-to-Speech API" in Google Cloud Console';
            }
            this.onError?.(`Google TTS: ${msg}`);
        }
    }
}

export const googleTTS = new GoogleTTS();
export { VOICE_MAP as GOOGLE_VOICE_MAP };
