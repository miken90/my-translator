/**
 * SessionState — explicit state machine for the recording session lifecycle.
 * Idle -> Connecting -> Listening -> Stopping -> Idle
 *
 * Replaces the old `isRunning`/`isStarting` boolean cluster in App: `isRunning`
 * (button/toggle semantics) is now the derived getter `sessionState === LISTENING`,
 * and `isStarting`'s re-entrancy guard is `isToggleBlocked(sessionState)`.
 */

export const SessionState = Object.freeze({
    IDLE: 'idle',
    CONNECTING: 'connecting',
    LISTENING: 'listening',
    STOPPING: 'stopping',
});

// A start or stop is already in flight — block a re-entrant start/stop toggle.
export function isToggleBlocked(state) {
    return state === SessionState.CONNECTING || state === SessionState.STOPPING;
}
