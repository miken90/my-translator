/**
 * Edge TTS via Rust — Frontend module
 * Calls Rust backend to proxy Edge TTS WebSocket (avoids browser header limitations).
 * Returns base64 MP3 audio, played via audioPlayer.
 */

import { BaseTTSProvider } from './base-tts-provider.js';

const { invoke } = window.__TAURI__.core;

class EdgeTTSRust extends BaseTTSProvider {
    constructor() {
        super();
        this.voice = 'vi-VN-HoaiMyNeural';
        this.speed = 20; // percentage: +20% default
    }

    configure({ voice, speed }) {
        if (voice) this.voice = voice;
        if (speed !== undefined) this.speed = speed;
    }

    connect() {
        this.isConnected = true;
        this._setStatus('connected');
        console.log('[Edge TTS] Ready via Rust proxy');
    }

    async _synthesize(text) {
        const startTime = performance.now();

        try {
            const base64Audio = await invoke('edge_tts_speak', {
                text: text,
                voice: this.voice,
                rate: this.speed,
            });

            const elapsed = performance.now() - startTime;
            console.log(`[Edge TTS] Audio received in ${elapsed.toFixed(0)}ms`);

            if (this.onAudioChunk) {
                this.onAudioChunk(base64Audio, true);
            }
        } catch (err) {
            console.error('[Edge TTS] Error:', err);
            this.onError?.(`Edge TTS: ${err}`);
        }
    }
}

export const edgeTTSRust = new EdgeTTSRust();
