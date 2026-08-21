import { describe, it, expect, beforeEach } from 'vitest';
import { invokeMock } from './setup.js';
import { settingsManager } from '../../src/js/settings.js';

// settings.js dereferences window.__TAURI__.core at module top level and
// captures `invoke` by reference at import time, so tests control behavior
// via the shared `invokeMock` from setup.js rather than reassigning
// window.__TAURI__.core.invoke.

describe('settingsManager.load', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('falls back to hardcoded defaults when the backend returns an empty object', async () => {
    invokeMock.mockResolvedValueOnce({});
    const settings = await settingsManager.load();

    expect(settings.source_language).toBe('auto');
    expect(settings.target_language).toBe('vi');
    expect(settings.audio_source).toBe('system');
    expect(settings.tts_provider).toBe('edge');
    expect(settings.translation_mode).toBe('soniox');
  });

  it('merges backend values over defaults', async () => {
    invokeMock.mockResolvedValueOnce({ font_size: 22, soniox_api_key: 'sk-test' });
    const settings = await settingsManager.load();

    expect(settings.font_size).toBe(22);
    expect(settings.soniox_api_key).toBe('sk-test');
    expect(settings.target_language).toBe('vi'); // untouched default preserved
  });

  it('preserves unknown fields the backend returns beyond the known schema', async () => {
    invokeMock.mockResolvedValueOnce({ future_field: 'xyz' });
    const settings = await settingsManager.load();

    expect(settings.future_field).toBe('xyz');
  });

  it('falls back to defaults when the backend call rejects', async () => {
    invokeMock.mockRejectedValueOnce(new Error('ipc failure'));
    const settings = await settingsManager.load();

    expect(settings.source_language).toBe('auto');
    expect(settings.tts_provider).toBe('edge');
  });
});

describe('settingsManager.save', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('merges new values into current settings and persists via invoke', async () => {
    invokeMock.mockResolvedValueOnce({}); // load baseline
    await settingsManager.load();
    invokeMock.mockResolvedValueOnce(undefined); // save_settings succeeds

    const ok = await settingsManager.save({ font_size: 30 });

    expect(ok).toBe(true);
    expect(settingsManager.get().font_size).toBe(30);
    expect(invokeMock).toHaveBeenLastCalledWith(
      'save_settings',
      expect.objectContaining({ newSettings: expect.objectContaining({ font_size: 30 }) })
    );
  });

  it('rethrows and leaves settings unchanged when the backend call rejects', async () => {
    invokeMock.mockResolvedValueOnce({});
    await settingsManager.load();
    const before = settingsManager.get();

    invokeMock.mockRejectedValueOnce(new Error('disk full'));
    await expect(settingsManager.save({ font_size: 99 })).rejects.toThrow('disk full');

    expect(settingsManager.get()).toEqual(before);
  });
});

describe('settingsManager.get', () => {
  it('returns a shallow copy, not the internal settings reference', () => {
    const a = settingsManager.get();
    const b = settingsManager.get();
    expect(a).not.toBe(b);
    expect(a).not.toBe(settingsManager.settings);

    a.font_size = -1;
    expect(settingsManager.get().font_size).not.toBe(-1);
  });
});

describe('settingsManager.onChange', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('notifies subscribers after load and after save', async () => {
    const seen = [];
    const unsubscribe = settingsManager.onChange((s) => seen.push(s));

    invokeMock.mockResolvedValueOnce({ font_size: 40 });
    await settingsManager.load();
    expect(seen).toHaveLength(1);
    expect(seen[0].font_size).toBe(40);

    invokeMock.mockResolvedValueOnce(undefined);
    await settingsManager.save({ font_size: 41 });
    expect(seen).toHaveLength(2);
    expect(seen[1].font_size).toBe(41);

    unsubscribe();
    invokeMock.mockResolvedValueOnce({ font_size: 42 });
    await settingsManager.load();
    expect(seen).toHaveLength(2); // no further notifications after unsubscribe
  });
});
