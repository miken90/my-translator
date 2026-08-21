/**
 * updateStatusIndicator — reflects Soniox connection status in the overlay's status dot/text
 */
export function updateStatusIndicator(status) {
    const dot = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');

    dot.className = 'status-dot';
    text.className = 'status-text';

    switch (status) {
        case 'connecting':
            dot.classList.add('connecting');
            text.classList.add('connecting');
            text.textContent = 'Connecting...';
            break;
        case 'connected':
            dot.classList.add('connected');
            text.classList.add('connected');
            text.textContent = 'Listening';
            break;
        case 'disconnected':
            dot.classList.add('disconnected');
            text.textContent = 'Ready';
            break;
        case 'error':
            dot.classList.add('error');
            text.classList.add('error');
            text.textContent = 'Error';
            break;
    }
}

let _elapsedTimerId = null;

// Elapsed-time readout next to the status text ("● 12:34") while recording.
export function startElapsedTimer(startTime) {
    stopElapsedTimer();
    const el = document.getElementById('status-elapsed');
    if (!el || !startTime) return;
    const tick = () => { el.textContent = _formatElapsed(Date.now() - startTime); };
    tick();
    _elapsedTimerId = setInterval(tick, 1000);
}

export function stopElapsedTimer() {
    if (_elapsedTimerId) {
        clearInterval(_elapsedTimerId);
        _elapsedTimerId = null;
    }
    const el = document.getElementById('status-elapsed');
    if (el) el.textContent = '';
}

function _formatElapsed(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
