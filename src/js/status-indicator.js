/**
 * updateStatusIndicator — reflects Soniox connection status in the overlay's status dot/text
 */
export function updateStatusIndicator(status) {
    const dot = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');

    dot.className = 'status-dot';

    switch (status) {
        case 'connecting':
            dot.classList.add('connecting');
            text.textContent = 'Connecting...';
            break;
        case 'connected':
            dot.classList.add('connected');
            text.textContent = 'Listening';
            break;
        case 'disconnected':
            dot.classList.add('disconnected');
            text.textContent = 'Ready';
            break;
        case 'error':
            dot.classList.add('error');
            text.textContent = 'Error';
            break;
    }
}
