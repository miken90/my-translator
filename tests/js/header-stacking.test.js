// Bug: the open header menus (mic source menu + ⋯ overflow menu) painted
// BEHIND #transcript-container's content (placeholder text, mic icon,
// Ctrl+Enter chip bled through/on top of the menu panel) instead of above
// it — not a transparency issue (.menu's background is ~97% opaque and was
// painting correctly), but a stacking-context trap: #drag-region and
// #transcript-container are SIBLINGS under #overlay-view, both originally
// z-index:1 (each only meant to clear #overlay-view::after). Tied z-index
// falls back to DOM order, and #transcript-container comes later in the
// HTML, so it always painted on top of #drag-region — and everything
// inside it, including .menu's own z-index:var(--z-menu) (500), which only
// ranks the menu *within* #drag-region's own local stacking context and
// can never let it out-rank an outer sibling.
//
// jsdom has no layout/paint engine, so there is no way to assert real
// cross-element paint order here (getComputedStyle().zIndex would just
// echo the CSS text back, and no browser actually resolves the visual
// z-order in jsdom). What IS meaningfully testable — and is the literal
// root cause — is the CSS *invariant* that must hold for the real browser
// to paint correctly: #drag-region's resolved z-index must exceed
// #transcript-container's resolved z-index in their shared stacking
// context (#overlay-view). This is a pure text/value check of main.css,
// the same style css-tokens.test.js already uses. It is honestly scoped:
// passing it proves the CSS numbers are right, not that pixels render
// correctly — that still needs the manual check recorded in
// docs/smoke-test-checklist.md (open each menu, confirm no transcript
// content shows through/on top of the panel, in idle/listening/compact
// states).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, '../../src/styles/main.css');
const raw = fs.readFileSync(cssPath, 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

function findRootBlock(text) {
  const start = text.indexOf(':root');
  const braceStart = text.indexOf('{', start);
  let depth = 1;
  let i = braceStart + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    i++;
  }
  return text.slice(braceStart + 1, i - 1);
}

const rootBody = findRootBlock(css);
const tokens = new Map();
for (const m of rootBody.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  tokens.set(m[1], m[2].trim());
}

function resolveZIndex(value) {
  const varMatch = value.match(/^var\((--[\w-]+)\)$/);
  const raw = varMatch ? tokens.get(varMatch[1]) : value;
  const num = Number(raw);
  if (Number.isNaN(num)) throw new Error(`Could not resolve z-index value: ${value} -> ${raw}`);
  return num;
}

// Grabs the FIRST top-level `z-index: ...;` declaration inside a selector's
// own block (not nested/descendant rules) — matches how css-tokens.test.js
// scans rule bodies elsewhere in this suite.
function zIndexOf(selector) {
  const selEsc = selector.replace(/[.#]/g, '\\$&');
  const re = new RegExp(`(?:^|\\})\\s*${selEsc}\\s*\\{([^}]*)\\}`, 'm');
  const m = css.match(re);
  if (!m) throw new Error(`Selector not found: ${selector}`);
  const zMatch = m[1].match(/z-index\s*:\s*([^;]+);/);
  if (!zMatch) throw new Error(`No z-index in ${selector}`);
  return resolveZIndex(zMatch[1].trim());
}

describe('header/transcript stacking-context invariant (main.css)', () => {
  it('#drag-region out-ranks its sibling #transcript-container, so the header (and its menus) never paints behind the transcript', () => {
    const dragRegionZ = zIndexOf('#drag-region');
    const transcriptZ = zIndexOf('#transcript-container');
    expect(dragRegionZ).toBeGreaterThan(transcriptZ);
  });

  it('#drag-region also out-ranks #resize-handle (the other z-index:1-tier sibling under #overlay-view)', () => {
    const dragRegionZ = zIndexOf('#drag-region');
    const resizeHandleZ = zIndexOf('#resize-handle');
    expect(dragRegionZ).toBeGreaterThan(resizeHandleZ);
  });

  it('the compact-mode reveal state (higher tier) still out-ranks #drag-region\'s own baseline, preserving relative order', () => {
    // .compact-mode:hover #drag-region.compact-hidden overrides z-index to
    // --z-compact-reveal while the bar is shown via the hover strip.
    const compactRevealMatch = css.match(/z-index:\s*var\((--z-compact-reveal)\)/);
    expect(compactRevealMatch).not.toBeNull();
    const compactRevealZ = tokens.get(compactRevealMatch[1]);
    expect(Number(compactRevealZ)).toBeGreaterThan(zIndexOf('#drag-region'));
  });
});
