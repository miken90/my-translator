import { describe, it, expect } from 'vitest';
import { SessionState, isToggleBlocked } from '../../src/js/session-state.js';

describe('SessionState', () => {
  it('defines exactly the four lifecycle states', () => {
    expect(Object.keys(SessionState).sort()).toEqual(['CONNECTING', 'IDLE', 'LISTENING', 'STOPPING']);
  });

  it('is frozen (no accidental mutation of the enum)', () => {
    expect(Object.isFrozen(SessionState)).toBe(true);
  });
});

describe('isToggleBlocked', () => {
  it('blocks a re-entrant toggle while connecting or stopping', () => {
    expect(isToggleBlocked(SessionState.CONNECTING)).toBe(true);
    expect(isToggleBlocked(SessionState.STOPPING)).toBe(true);
  });

  it('allows toggling while idle or listening', () => {
    expect(isToggleBlocked(SessionState.IDLE)).toBe(false);
    expect(isToggleBlocked(SessionState.LISTENING)).toBe(false);
  });
});
