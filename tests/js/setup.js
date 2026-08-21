import { vi } from 'vitest';

// Several app modules dereference `window.__TAURI__.core` at module top level
// (settings.js, edge-tts.js, app.js) and construct singletons at import time
// (soniox.js, settings.js). Stub the Tauri global before any test module
// imports app code — do not restructure app code to make it testable here.
export const invokeMock = vi.fn();

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {};
}
globalThis.window.__TAURI__ = {
  core: { invoke: invokeMock },
  window: { getCurrentWindow: () => ({}) },
};
