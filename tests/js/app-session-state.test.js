// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setup.js';
import { App } from '../../src/js/app.js';
import { SessionState } from '../../src/js/session-state.js';

// These tests exercise _handleStartStopToggle()'s orchestration in isolation from
// network/DOM-heavy leaf methods (start/stop/_showToast/etc are stubbed) — the same
// technique Phase 2's tests use for settings.js: verify the transition logic itself,
// not the I/O it eventually triggers.
describe('App session state machine', () => {
  let app;

  beforeEach(() => {
    app = new App();
  });

  it('starts in Idle', () => {
    expect(app.sessionState).toBe(SessionState.IDLE);
    expect(app.isRunning).toBe(false);
  });

  it('isRunning getter reflects Listening only', () => {
    for (const state of Object.values(SessionState)) {
      app.sessionState = state;
      expect(app.isRunning).toBe(state === SessionState.LISTENING);
    }
  });

  it('blocks a re-entrant toggle while Connecting', async () => {
    app.sessionState = SessionState.CONNECTING;
    app.start = vi.fn();
    app.stop = vi.fn();

    await app._handleStartStopToggle();

    expect(app.start).not.toHaveBeenCalled();
    expect(app.stop).not.toHaveBeenCalled();
    expect(app.sessionState).toBe(SessionState.CONNECTING);
  });

  it('blocks a re-entrant toggle while Stopping', async () => {
    app.sessionState = SessionState.STOPPING;
    app.start = vi.fn();
    app.stop = vi.fn();

    await app._handleStartStopToggle();

    expect(app.start).not.toHaveBeenCalled();
    expect(app.stop).not.toHaveBeenCalled();
  });

  it('calls stop() when Listening', async () => {
    app.sessionState = SessionState.LISTENING;
    app.stop = vi.fn(async () => { app.sessionState = SessionState.IDLE; });
    app.start = vi.fn();

    await app._handleStartStopToggle();

    expect(app.stop).toHaveBeenCalledTimes(1);
    expect(app.start).not.toHaveBeenCalled();
  });

  it('moves Idle -> Connecting -> Listening when start() succeeds', async () => {
    app.sessionState = SessionState.IDLE;
    const seenDuringStart = [];
    app.start = vi.fn(async () => {
      seenDuringStart.push(app.sessionState); // should already be Connecting
      app.sessionState = SessionState.LISTENING;
    });

    await app._handleStartStopToggle();

    expect(seenDuringStart).toEqual([SessionState.CONNECTING]);
    expect(app.sessionState).toBe(SessionState.LISTENING);
  });

  it('falls back to Idle when start() returns early without reaching Listening', async () => {
    app.sessionState = SessionState.IDLE;
    app.start = vi.fn(async () => { /* simulates a validation early-return, e.g. missing API key */ });

    await app._handleStartStopToggle();

    expect(app.start).toHaveBeenCalledTimes(1);
    expect(app.sessionState).toBe(SessionState.IDLE);
  });

  it('recovers to Idle and surfaces the error when start() throws', async () => {
    app.sessionState = SessionState.IDLE;
    app._showToast = vi.fn();
    app._updateStartButton = vi.fn();
    app._updateStatus = vi.fn();
    app.start = vi.fn(async () => { throw new Error('boom'); });

    await app._handleStartStopToggle();

    expect(app.sessionState).toBe(SessionState.IDLE);
    expect(app._showToast).toHaveBeenCalledWith(expect.stringContaining('boom'), 'error');
    expect(app._updateStatus).toHaveBeenCalledWith('error');
  });

  it('recovers to Idle and surfaces the error when stop() throws', async () => {
    app.sessionState = SessionState.LISTENING;
    app._showToast = vi.fn();
    app._updateStartButton = vi.fn();
    app._updateStatus = vi.fn();
    app.stop = vi.fn(async () => { throw new Error('teardown failed'); });

    await app._handleStartStopToggle();

    expect(app.sessionState).toBe(SessionState.IDLE);
    expect(app._showToast).toHaveBeenCalledWith(expect.stringContaining('teardown failed'), 'error');
  });
});
