// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../../src/js/session-manager.js';

function makeTranscriptUI({ hasSessionContent = true, sessionText = 'some content' } = {}) {
  return {
    hasSessionContent: vi.fn(() => hasSessionContent),
    getFullSessionText: vi.fn(() => sessionText),
    clearSession: vi.fn(),
  };
}

describe('SessionManager.formatDuration', () => {
  it('formats whole minutes and seconds', () => {
    const sm = new SessionManager({});
    expect(sm.formatDuration(0)).toBe('0m 0s');
    expect(sm.formatDuration(65_000)).toBe('1m 5s');
    expect(sm.formatDuration(3_661_000)).toBe('61m 1s');
  });

  it('truncates (floors) sub-second durations', () => {
    const sm = new SessionManager({});
    expect(sm.formatDuration(59_999)).toBe('0m 59s');
  });
});

describe('SessionManager.formatBytes', () => {
  const sm = new SessionManager({});

  it('formats bytes under 1KB as bytes', () => {
    expect(sm.formatBytes(500)).toBe('500 B');
  });

  it('formats KB range with one decimal', () => {
    expect(sm.formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats MB range with one decimal', () => {
    expect(sm.formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('SessionManager.parseSessionMeta', () => {
  const sm = new SessionManager({});

  it('splits date and truncates time to HH:MM', () => {
    const meta = sm.parseSessionMeta({ created_at: '2026-03-27 10:21:05' });
    expect(meta.date).toBe('2026-03-27');
    expect(meta.time).toBe('10:21');
  });

  it('handles a missing created_at gracefully', () => {
    const meta = sm.parseSessionMeta({});
    expect(meta.date).toBe('');
    expect(meta.time).toBe('');
  });
});

describe('SessionManager.saveTranscriptFile', () => {
  let invoke;

  beforeEach(() => {
    invoke = vi.fn();
  });

  it('builds session text from getSessionMeta and saves via invoke', async () => {
    const transcriptUI = makeTranscriptUI();
    invoke.mockResolvedValueOnce('/path/to/2026-03-27_10-21.md');
    const showToast = vi.fn();

    const sm = new SessionManager({
      transcriptUI,
      invoke,
      showToast,
      getSessionMeta: () => ({
        recordingStartTime: Date.now() - 5000,
        sessionSourceLang: 'ja',
        sessionTargetLang: 'vi',
        sessionMode: 'one_way',
        currentSource: 'system',
      }),
    });

    const ok = await sm.saveTranscriptFile();

    expect(ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('save_transcript', { content: 'some content' });
    expect(transcriptUI.getFullSessionText).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLang: 'ja', targetLang: 'vi', mode: 'one_way', audioSource: 'system' })
    );
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Saved:'), 'success');
  });

  it('returns false without calling invoke when there is no content to save', async () => {
    const transcriptUI = makeTranscriptUI({ sessionText: null });
    const sm = new SessionManager({ transcriptUI, invoke, getSessionMeta: () => ({}) });

    const ok = await sm.saveTranscriptFile();

    expect(ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('returns false and toasts an error when invoke rejects', async () => {
    const transcriptUI = makeTranscriptUI();
    invoke.mockRejectedValueOnce(new Error('disk full'));
    const showToast = vi.fn();
    const sm = new SessionManager({ transcriptUI, invoke, showToast, getSessionMeta: () => ({}) });

    const ok = await sm.saveTranscriptFile();

    expect(ok).toBe(false);
    expect(showToast).toHaveBeenCalledWith('Failed to save transcript', 'error');
  });
});

describe('SessionManager.finalizeSession — CLAUDE.md invariant', () => {
  it('clears the session log only after a successful save', async () => {
    const transcriptUI = makeTranscriptUI();
    const invoke = vi.fn().mockResolvedValueOnce('/path.md').mockResolvedValueOnce(undefined);
    const sm = new SessionManager({ transcriptUI, invoke, showToast: vi.fn(), getSessionMeta: () => ({}) });

    await sm.finalizeSession();

    expect(transcriptUI.clearSession).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('delete_transcript_temp');
  });

  it('does not clear the session log when the save fails', async () => {
    const transcriptUI = makeTranscriptUI();
    const invoke = vi.fn().mockRejectedValueOnce(new Error('disk full'));
    const sm = new SessionManager({ transcriptUI, invoke, showToast: vi.fn(), getSessionMeta: () => ({}) });

    await sm.finalizeSession();

    expect(transcriptUI.clearSession).not.toHaveBeenCalled();
  });

  it('does nothing when there is no session content', async () => {
    const transcriptUI = makeTranscriptUI({ hasSessionContent: false });
    const invoke = vi.fn();
    const sm = new SessionManager({ transcriptUI, invoke, getSessionMeta: () => ({}) });

    await sm.finalizeSession();

    expect(invoke).not.toHaveBeenCalled();
    expect(transcriptUI.clearSession).not.toHaveBeenCalled();
  });
});
