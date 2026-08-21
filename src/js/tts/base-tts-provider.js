/**
 * BaseTTSProvider — shared lifecycle for the 4 TTS providers.
 *
 * Two families share this base:
 *  - "connect-once, synthesize-per-chunk" providers (Edge, Google, WebSpeech):
 *    use the built-in text queue (`speak()` -> `_processQueue()` -> subclass'
 *    `_synthesize(text)`, one chunk at a time, awaited in order).
 *  - "persistent connection" providers (ElevenLabs' WebSocket): manage their
 *    own send/flush queue but reuse `_scheduleReconnect()`/`_resetReconnect()`
 *    for the shared auto-reconnect policy, plus `disconnect()`/`_setStatus()`.
 */

export class BaseTTSProvider {
    constructor() {
        this.isConnected = false;

        // Callbacks — same interface across all providers
        this.onAudioChunk = null;   // (base64Audio, isFinal) => void
        this.onError = null;        // (errorMsg) => void
        this.onStatusChange = null; // (status) => void — 'connecting'|'connected'|'disconnected'|'error'

        // Shared pull-based text queue (connect-once-style providers)
        this._queue = [];
        this._isSpeaking = false;

        // Shared reconnect policy (persistent-connection-style providers)
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 3;
    }

    // ─── Shared text queue (connect-once providers) ─────────

    speak(text) {
        if (!text?.trim()) return;
        this._queue.push(text.trim());
        if (!this._isSpeaking) {
            this._processQueue();
        }
    }

    async _processQueue() {
        if (this._queue.length === 0) {
            this._isSpeaking = false;
            return;
        }
        this._isSpeaking = true;
        const text = this._queue.shift();
        await this._synthesize(text);
        this._processQueue();
    }

    // Subclasses using the shared queue implement this: perform the TTS call
    // for one chunk of text, firing onAudioChunk/onError. Must not throw.
    async _synthesize(_text) {
        throw new Error('_synthesize() not implemented');
    }

    // ─── Shared reconnect policy (persistent-connection providers) ────

    // Returns true if a reconnect was scheduled, false if retries are exhausted
    // (in which case it already reports disconnected/error via the callbacks).
    _scheduleReconnect(connectFn) {
        if (this._reconnectAttempts < this._maxReconnectAttempts) {
            this._reconnectAttempts++;
            const delay = this._reconnectAttempts * 2000;
            setTimeout(() => connectFn(), delay);
            return true;
        }
        this._setStatus('disconnected');
        this.onError?.('TTS disconnected after max retries');
        return false;
    }

    _resetReconnect() {
        this._reconnectAttempts = 0;
    }

    // ─── Shared lifecycle ─────────────────────────────────

    disconnect() {
        this._queue = [];
        this._isSpeaking = false;
        this.isConnected = false;
        this._resetReconnect();
        this._setStatus('disconnected');
    }

    _setStatus(status) {
        this.onStatusChange?.(status);
    }

    // Shared helper for REST-based providers (adds a request timeout via AbortController)
    async _fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }
}
