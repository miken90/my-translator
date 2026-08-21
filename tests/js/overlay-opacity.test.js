// @vitest-environment jsdom
//
// The overlay's opacity setting must reach the DOM as the `--overlay-opacity`
// custom property, never as element opacity. Element opacity on #overlay-view is
// a *group* operation: it flattens the whole subtree, so the transcript and the
// toolbar fade along with the panel. The CSS drives `#overlay-view::after` (the
// background layer) from this property instead, leaving content at full strength.
//
// jsdom does not render, so this asserts the wiring, not the appearance — a
// regression back to `style.opacity` is exactly what it catches.
import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { App } from '../../src/js/app.js';

// _applySettings() also refreshes the source buttons, which are read without a
// guard. Everything else it touches is optional or already guarded.
function buildDom() {
  document.body.innerHTML = `
    <div id="overlay-view"></div>
    <button id="btn-source-system"></button>
    <button id="btn-source-mic"></button>
    <button id="btn-source-both"></button>
  `;
}

describe('overlay opacity wiring', () => {
  let app;
  let overlayView;

  beforeEach(() => {
    buildDom();
    app = new App();
    overlayView = document.getElementById('overlay-view');
  });

  it('sets the opacity setting as the --overlay-opacity custom property', () => {
    app._applySettings({ overlay_opacity: 0.42 });

    expect(overlayView.style.getPropertyValue('--overlay-opacity')).toBe('0.42');
  });

  it('never sets element opacity on #overlay-view', () => {
    app._applySettings({ overlay_opacity: 0.42 });

    // The whole point of the phase: group opacity would fade text too.
    expect(overlayView.style.opacity).toBe('');
  });

  it('falls back to 0.85 when the setting is absent', () => {
    app._applySettings({});

    expect(overlayView.style.getPropertyValue('--overlay-opacity')).toBe('0.85');
  });

  it('tracks the full slider range, including the 20% floor and 100% ceiling', () => {
    for (const value of [0.2, 0.5, 0.85, 1]) {
      app._applySettings({ overlay_opacity: value });

      expect(overlayView.style.getPropertyValue('--overlay-opacity')).toBe(String(value));
      expect(overlayView.style.opacity).toBe('');
    }
  });
});
