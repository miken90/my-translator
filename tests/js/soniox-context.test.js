import { describe, it, expect, beforeEach } from 'vitest';
import { SonioxClient } from '../../src/js/soniox.js';

// CONTEXT_HISTORY_CHARS/MAX_HISTORY_ENTRIES are module-private constants in
// soniox.js (currently 500 / 50). Mirrored here as characterization values —
// if soniox.js changes either cap, update these to match.
const CONTEXT_HISTORY_CHARS = 500;
const MAX_HISTORY_ENTRIES = 50;

describe('SonioxClient._buildContext', () => {
  let client;

  beforeEach(() => {
    client = new SonioxClient();
  });

  it('returns null when there is no custom context or carryover', () => {
    expect(client._buildContext(null, null)).toBeNull();
  });

  it('maps customContext.general array through as-is', () => {
    const general = [{ key: 'domain', value: 'medical' }];
    const ctx = client._buildContext({ general }, null);
    expect(ctx.general).toEqual(general);
  });

  it('converts legacy customContext.domain string to a general pair', () => {
    const ctx = client._buildContext({ domain: 'legal' }, null);
    expect(ctx.general).toEqual([{ key: 'domain', value: 'legal' }]);
  });

  it('passes through terms and translation_terms when present', () => {
    const ctx = client._buildContext(
      { terms: ['Kubernetes'], translation_terms: [{ source: 'sin', target: 'tội' }] },
      null
    );
    expect(ctx.terms).toEqual(['Kubernetes']);
    expect(ctx.translation_terms).toEqual([{ source: 'sin', target: 'tội' }]);
  });

  it('builds context.text from carryover only when no custom text is set', () => {
    const ctx = client._buildContext(null, 'we discussed pricing');
    expect(ctx.text).toBe('Recent conversation: we discussed pricing');
  });

  it('joins custom text and carryover with a blank line', () => {
    const ctx = client._buildContext({ text: 'background info' }, 'recent talk');
    expect(ctx.text).toBe('background info\n\nRecent conversation: recent talk');
  });
});

describe('SonioxClient context carryover history (CONTEXT_HISTORY_CHARS cap)', () => {
  let client;

  beforeEach(() => {
    client = new SonioxClient();
  });

  it('returns null carryover when nothing has been translated yet', () => {
    expect(client._getCarryoverContext()).toBeNull();
  });

  it('joins recorded translations with a space', () => {
    client._addToHistory('hello');
    client._addToHistory('world');
    expect(client._getCarryoverContext()).toBe('hello world');
  });

  it('trims the oldest entries once total length exceeds the cap', () => {
    const a = 'a'.repeat(300);
    const b = 'b'.repeat(300); // a+b = 600 > 500 cap
    client._addToHistory(a);
    client._addToHistory(b);

    const history = client._recentTranslations;
    expect(history).toEqual([b]); // oldest ("a" chunk) shifted out
    expect(history.join('').length).toBeLessThanOrEqual(CONTEXT_HISTORY_CHARS);
  });

  it('keeps at least one entry even if it alone exceeds the cap', () => {
    const huge = 'x'.repeat(CONTEXT_HISTORY_CHARS + 100);
    client._addToHistory(huge);
    expect(client._recentTranslations).toEqual([huge]);
  });

  it('bounds entry count even when many short translations never trip the char cap', () => {
    // Many single-char entries: total length stays far under
    // CONTEXT_HISTORY_CHARS, so only the entry-count cap can bound this.
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 20; i++) {
      client._addToHistory('x');
    }
    expect(client._recentTranslations.length).toBe(MAX_HISTORY_ENTRIES);
    // Oldest entries were dropped first — FIFO, same policy as the char cap.
    expect(client._recentTranslations.every(t => t === 'x')).toBe(true);
  });
});
