// @vitest-environment jsdom
//
// Bug: stopping a session left the "Listening..." indicator on screen
// forever whenever no content had arrived yet (App.stop() never called
// anything to remove it, and hasContent() counted the stray indicator
// itself as "content", so even a later start() would skip re-adding it).
// TranscriptUI.stopListening() is the stop-path fix app.js now delegates to.
import { describe, it, expect, beforeEach } from 'vitest';
import { TranscriptUI } from '../../src/js/ui.js';

describe('TranscriptUI.stopListening — stop-path indicator cleanup', () => {
  let ui;

  beforeEach(() => {
    const container = document.createElement('div');
    ui = new TranscriptUI(container);
  });

  it('drops to the placeholder when stopped with no transcript content', () => {
    ui.showListening();
    expect(ui.container.querySelector('.listening-indicator')).not.toBeNull();

    ui.stopListening();

    expect(ui.container.querySelector('.listening-indicator')).toBeNull();
    expect(ui.container.querySelector('.transcript-placeholder')).not.toBeNull();
  });

  it('a subsequent showListening() after stopListening() re-adds the indicator (not permanently stuck)', () => {
    ui.showListening();
    ui.stopListening();

    ui.showListening();

    expect(ui.container.querySelector('.listening-indicator')).not.toBeNull();
  });

  it('removes only the indicator and keeps segments when content already arrived', () => {
    ui.addOriginal('hello');
    ui.addTranslation('xin chao');
    expect(ui.hasSegments()).toBe(true);

    // Simulate a stray indicator surviving alongside real content.
    const indicator = document.createElement('div');
    indicator.className = 'listening-indicator';
    ui.container.appendChild(indicator);

    ui.stopListening();

    expect(ui.container.querySelector('.listening-indicator')).toBeNull();
    expect(ui.container.querySelector('.transcript-placeholder')).toBeNull();
    expect(ui.segments.length).toBe(1);
  });
});
