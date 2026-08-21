// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TranscriptUI } from '../../src/js/ui.js';

describe('TranscriptUI segment/translation pairing', () => {
  let ui;

  beforeEach(() => {
    const container = document.createElement('div');
    ui = new TranscriptUI(container);
  });

  it('assigns monotonic unique ids to each addOriginal call', () => {
    ui.addOriginal('hello');
    ui.addOriginal('world');
    expect(ui.segments[0].id).not.toBe(ui.segments[1].id);
    expect(ui.segments[1].id).toBeGreaterThan(ui.segments[0].id);
  });

  it('addOriginal pushes a matching entry into both segments and sessionLog', () => {
    ui.addOriginal('hello', 'A', 'en');
    expect(ui.segments).toHaveLength(1);
    expect(ui.sessionLog).toHaveLength(1);
    expect(ui.segments[0].id).toBe(ui.sessionLog[0].id);
    expect(ui.segments[0].status).toBe('original');
    expect(ui.segments[0].speaker).toBe('A');
    expect(ui.segments[0].language).toBe('en');
  });

  it('addTranslation pairs to the most recently added pending original (LIFO)', () => {
    ui.addOriginal('first original');
    ui.addOriginal('second original');
    ui.addTranslation('translation for second');

    expect(ui.segments[0].status).toBe('original');
    expect(ui.segments[0].translation).toBeNull();
    expect(ui.segments[1].status).toBe('translated');
    expect(ui.segments[1].translation).toBe('translation for second');
  });

  it('mirrors the pairing update into sessionLog by matching id', () => {
    ui.addOriginal('only original');
    ui.addTranslation('its translation');

    const logSeg = ui.sessionLog[0];
    expect(logSeg.status).toBe('translated');
    expect(logSeg.translation).toBe('its translation');
  });

  it('creates an orphan translated segment when no pending original exists', () => {
    ui.addTranslation('orphan translation');

    expect(ui.segments).toHaveLength(1);
    expect(ui.segments[0].status).toBe('translated');
    expect(ui.segments[0].original).toBe('');
    expect(ui.segments[0].translation).toBe('orphan translation');
    expect(ui.sessionLog).toHaveLength(1);
    expect(ui.sessionLog[0].translation).toBe('orphan translation');
  });

  it('does not re-pair a translation to an already-translated segment', () => {
    ui.addOriginal('a');
    ui.addTranslation('a-translated');
    ui.addTranslation('should orphan, a is already translated');

    // First segment stays paired with its own translation.
    expect(ui.segments[0].translation).toBe('a-translated');
    // Second call finds no pending original -> creates a new orphan segment.
    expect(ui.segments).toHaveLength(2);
    expect(ui.segments[1].original).toBe('');
    expect(ui.segments[1].translation).toBe('should orphan, a is already translated');
  });
});
