// @vitest-environment jsdom
//
// Phase 4 (interaction-state normalization) added ARIA wiring with zero prior
// test coverage — no existing test referenced any toolbar id
// (grep -n "btn-tts|btn-pin|btn-compact|btn-source" tests/js/*.js was empty).
// This asserts the two APG patterns: aria-pressed tracks the .active class on
// each independent toggle, and the source radiogroup keeps aria-checked on
// exactly one button.
import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { WindowManager } from '../../src/js/window-manager.js';
import { TTSController } from '../../src/js/tts-controller.js';
import { App } from '../../src/js/app.js';

describe('pin toggle', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="drag-region"></div>
      <div id="overlay-view"></div>
      <button id="btn-pin" class="icon-btn active" aria-pressed="true"></button>
      <button id="btn-compact" class="icon-btn" aria-pressed="false"></button>
    `;
  });

  it('sets both the .active class and aria-pressed when pin is toggled off then on', async () => {
    const appWindow = { setAlwaysOnTop: async () => {} };
    const wm = new WindowManager(appWindow, {});
    const btn = document.getElementById('btn-pin');

    await wm.togglePin(); // starts pinned (true) -> false
    expect(btn.classList.contains('active')).toBe(false);
    expect(btn.getAttribute('aria-pressed')).toBe('false');

    await wm.togglePin(); // false -> true
    expect(btn.classList.contains('active')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('sets both the .active class and aria-pressed when compact is toggled, and gives it the active state pin/TTS already have', () => {
    const wm = new WindowManager({ setAlwaysOnTop: async () => {} }, {});
    const btn = document.getElementById('btn-compact');

    wm.toggleCompact();
    expect(btn.classList.contains('active')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    wm.toggleCompact();
    expect(btn.classList.contains('active')).toBe(false);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('tts toggle', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-tts" class="tts-action-btn" aria-pressed="false"></button>
      <svg id="icon-tts-off"></svg>
      <svg id="icon-tts-on" style="display:none"></svg>
    `;
  });

  it('sets both the .active class and aria-pressed to match ttsEnabled', () => {
    const tts = new TTSController({});
    const btn = document.getElementById('btn-tts');

    tts.ttsEnabled = true;
    tts.updateButton();
    expect(btn.classList.contains('active')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    tts.ttsEnabled = false;
    tts.updateButton();
    expect(btn.classList.contains('active')).toBe(false);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('disables the button (removing it from tab order) in two-way mode instead of using pointer-events', () => {
    document.body.innerHTML += `
      <select id="select-translation-type"><option value="two_way" selected>two_way</option></select>
    `;
    const tts = new TTSController({});
    tts.updateButton();

    const btn = document.getElementById('btn-tts');
    expect(btn.disabled).toBe(true);
  });
});

describe('source picker radiogroup', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="overlay-view"></div>
      <button id="btn-source-system" class="source-btn active" role="radio" aria-checked="true"></button>
      <button id="btn-source-mic" class="source-btn" role="radio" aria-checked="false"></button>
      <button id="btn-source-both" class="source-btn" role="radio" aria-checked="false"></button>
    `;
  });

  it('sets aria-checked on exactly one of the three source buttons', () => {
    const app = new App();
    app.currentSource = 'microphone';

    app._updateSourceButtons();

    const states = ['btn-source-system', 'btn-source-mic', 'btn-source-both'].map(
      (id) => document.getElementById(id).getAttribute('aria-checked')
    );
    expect(states).toEqual(['false', 'true', 'false']);
  });
});
