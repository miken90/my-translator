// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TranscriptUI } from '../../src/js/ui.js';

describe('TranscriptUI trimming and staleness invariants', () => {
  let ui;

  beforeEach(() => {
    const container = document.createElement('div');
    ui = new TranscriptUI(container);
  });

  it('trims translated segments from the display buffer once maxChars is exceeded, keeping at least 2', () => {
    ui.configure({ maxLines: 1 }); // maxChars = 1 * 160 = 160
    const long = 'x'.repeat(100);

    for (let i = 0; i < 5; i++) {
      ui.addOriginal(long);
      ui.addTranslation(long);
    }

    // 5 translated segments of 100 chars each (500 total) far exceeds 160 -> trimmed down to the floor of 2.
    expect(ui.segments.length).toBe(2);
    expect(ui.segments.every(s => s.status === 'translated')).toBe(true);
  });

  it('never trims sessionLog while segments trims at maxChars', () => {
    ui.configure({ maxLines: 1 }); // maxChars = 160
    const long = 'x'.repeat(100);

    for (let i = 0; i < 5; i++) {
      ui.addOriginal(long);
      ui.addTranslation(long);
    }

    expect(ui.segments.length).toBeLessThan(5);
    expect(ui.sessionLog.length).toBe(5);
  });

  it('does not trim pending (untranslated) original segments even over maxChars', () => {
    ui.configure({ maxLines: 1 }); // maxChars = 160
    const long = 'x'.repeat(100);

    // All pending, never translated -> _trimSegments must leave them alone (findIndex returns -1 -> break).
    ui.addOriginal(long);
    ui.addOriginal(long);
    ui.addOriginal(long);

    expect(ui.segments.length).toBe(3);
    expect(ui.segments.every(s => s.status === 'original')).toBe(true);
  });

  it('_cleanupStaleOriginals marks originals older than 10s as stale without removing them', () => {
    ui.addOriginal('aging original');
    ui.segments[0].createdAt = Date.now() - 15000; // 15s old: stale, not expired
    ui._cleanupStaleOriginals();

    expect(ui.segments).toHaveLength(1);
    expect(ui.segments[0].isStale).toBe(true);
  });

  it('_cleanupStaleOriginals removes originals older than 60s from segments but keeps sessionLog intact', () => {
    ui.addOriginal('very old original');
    ui.segments[0].createdAt = Date.now() - 70000; // 70s old: expired
    ui._cleanupStaleOriginals();

    expect(ui.segments).toHaveLength(0);
    expect(ui.sessionLog).toHaveLength(1); // sessionLog is untouched by cleanup
    expect(ui.sessionLog[0].original).toBe('very old original');
  });

  it('_cleanupStaleOriginals leaves translated segments untouched regardless of age', () => {
    ui.addOriginal('paired');
    ui.addTranslation('paired translation');
    ui.segments[0].createdAt = Date.now() - 70000;
    ui._cleanupStaleOriginals();

    expect(ui.segments).toHaveLength(1);
    expect(ui.segments[0].status).toBe('translated');
  });
});
