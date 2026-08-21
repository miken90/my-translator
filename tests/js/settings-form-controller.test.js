// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsFormController } from '../../src/js/settings-form-controller.js';

// Minimal fixture covering only the DOM ids populateForm() touches.
function mountSettingsFormFixture() {
  document.body.innerHTML = `
    <input id="input-api-key" />
    <select id="select-source-lang"><option value="auto">auto</option></select>
    <select id="select-target-lang"><option value="vi">vi</option></select>
    <select id="select-translation-mode"><option value="soniox">soniox</option></select>
    <select id="select-translation-type"><option value="one_way">one_way</option><option value="two_way">two_way</option></select>
    <select id="select-lang-a"><option value="ja">ja</option></select>
    <select id="select-lang-b"><option value="vi">vi</option></select>
    <input id="check-strict-lang" type="checkbox" />
    <input id="range-endpoint-delay" type="range" min="500" max="3000" step="100" />
    <span id="endpoint-delay-value"></span>
    <input type="radio" name="audio-source" value="system" />
    <input id="range-opacity" />
    <span id="opacity-value"></span>
    <input id="range-font-size" />
    <span id="font-size-value"></span>
    <input id="range-max-lines" />
    <span id="max-lines-value"></span>
    <select id="select-export-format"><option value="md">md</option><option value="txt">txt</option></select>
    <div id="context-general-list"></div>
    <textarea id="input-context-terms"></textarea>
    <textarea id="input-context-text"></textarea>
    <div id="translation-terms-list"></div>
    <input id="input-elevenlabs-key" />
    <select id="select-tts-voice"><option value="21m00Tcm4TlvDq8ikWAM">v</option></select>
    <select id="select-edge-voice"><option value="vi-VN-HoaiMyNeural">v</option></select>
    <input id="range-edge-speed" />
    <span id="edge-speed-value"></span>
    <input id="input-google-tts-key" />
    <select id="select-google-voice"><option value="vi-VN-Chirp3-HD-Aoede">v</option></select>
    <input id="range-google-speed" />
    <span id="google-speed-value"></span>
    <select id="select-tts-provider"><option value="edge">edge</option></select>
    <input id="input-ai-endpoint" />
    <input id="input-ai-api-key" />
    <input id="input-ai-model" />
  `;
}

describe('SettingsFormController.populateForm — endpoint_delay migration', () => {
  beforeEach(() => {
    mountSettingsFormFixture();
  });

  it('migrates the old 3000ms default to 1500ms and persists it', () => {
    const save = vi.fn();
    const settingsManager = {
      get: () => ({ endpoint_delay: 3000 }),
      save,
    };
    const controller = new SettingsFormController({ settingsManager });

    controller.populateForm();

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ endpoint_delay: 1500 }));
    expect(document.getElementById('range-endpoint-delay').value).toBe('1500');
    expect(document.getElementById('endpoint-delay-value').textContent).toBe('1.5s');
  });

  it('leaves a non-default endpoint_delay untouched', () => {
    const save = vi.fn();
    const settingsManager = {
      get: () => ({ endpoint_delay: 2000 }),
      save,
    };
    const controller = new SettingsFormController({ settingsManager });

    controller.populateForm();

    expect(save).not.toHaveBeenCalled();
    expect(document.getElementById('range-endpoint-delay').value).toBe('2000');
  });

  it('defaults to 1500ms when no endpoint_delay is set at all', () => {
    const save = vi.fn();
    const settingsManager = {
      get: () => ({}),
      save,
    };
    const controller = new SettingsFormController({ settingsManager });

    controller.populateForm();

    expect(save).not.toHaveBeenCalled();
    expect(document.getElementById('range-endpoint-delay').value).toBe('1500');
  });
});

describe('SettingsFormController — export_format round trip', () => {
  beforeEach(() => {
    mountSettingsFormFixture();
  });

  it('populateForm sets the select from a saved export_format', () => {
    const settingsManager = { get: () => ({ export_format: 'txt' }), save: vi.fn() };
    const controller = new SettingsFormController({ settingsManager });

    controller.populateForm();

    expect(document.getElementById('select-export-format').value).toBe('txt');
  });

  it('populateForm defaults the select to md when export_format is absent', () => {
    const settingsManager = { get: () => ({}), save: vi.fn() };
    const controller = new SettingsFormController({ settingsManager });

    controller.populateForm();

    expect(document.getElementById('select-export-format').value).toBe('md');
  });

  it('saveFromForm persists the select value as export_format', async () => {
    const settingsManager = { get: () => ({}), save: vi.fn() };
    const controller = new SettingsFormController({ settingsManager });
    document.getElementById('select-export-format').value = 'txt';

    await controller.saveFromForm();

    expect(settingsManager.save).toHaveBeenCalledWith(expect.objectContaining({ export_format: 'txt' }));
  });
});
