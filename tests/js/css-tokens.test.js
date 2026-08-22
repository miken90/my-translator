import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pure text analysis of src/styles/main.css — no DOM, no browser. Verifies
// the design-token layer added in Phase 3 stays internally consistent as
// the file changes: every var() resolves, every :root token earns its
// keep, and every colour literal outside :root is accounted for.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, '../../src/styles/main.css');
const raw = fs.readFileSync(cssPath, 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

// Set on #overlay-view / the transcript container by JS at runtime
// (src/js/app.js, src/js/ui.js), never declared in :root. A :root
// definition would beat these vars' fallback values and silently change
// behavior before the JS runs, so they are exempt from both the orphan
// and dead-token checks rather than "fixed" by defining them.
const RUNTIME_INJECTED = new Set([
  '--transcript-font-size', // src/js/ui.js
  '--transcript-font-color', // src/js/ui.js
  '--overlay-opacity', // src/js/app.js
]);

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
  return { body: text.slice(braceStart + 1, i - 1), start: braceStart + 1, end: i - 1 };
}

const root = findRootBlock(css);
const rootDefs = new Map(); // name -> value
for (const m of root.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  rootDefs.set(m[1], m[2].trim());
}

// Balanced-paren scan for var(...) calls across the whole file, skipping
// url(...) contents. A plain `var\(...\)` regex mis-terminates on nested
// var() fallbacks (e.g. `var(--transcript-font-color, var(--text-primary))`).
function findCalls(text, name) {
  const calls = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('url(', i)) {
      let depth = 1;
      let j = i + 4;
      while (j < text.length && depth > 0) {
        if (text[j] === '(') depth++;
        else if (text[j] === ')') depth--;
        j++;
      }
      i = j;
      continue;
    }
    if (text.startsWith(`${name}(`, i)) {
      let depth = 1;
      let j = i + name.length + 1;
      const start = j;
      while (j < text.length && depth > 0) {
        if (text[j] === '(') depth++;
        else if (text[j] === ')') depth--;
        j++;
      }
      calls.push({ inner: text.slice(start, j - 1), index: i });
      i = j;
      continue;
    }
    i++;
  }
  return calls;
}

function varName(inner) {
  let depth = 0;
  for (let k = 0; k < inner.length; k++) {
    if (inner[k] === '(') depth++;
    else if (inner[k] === ')') depth--;
    else if (inner[k] === ',' && depth === 0) return inner.slice(0, k).trim();
  }
  return inner.trim();
}

const varCalls = findCalls(css, 'var');
const usedVarNames = new Set(varCalls.map((c) => varName(c.inner)));

describe('css design tokens (main.css)', () => {
  it('has no orphan var() — every referenced custom property is defined in :root or runtime-injected', () => {
    const orphans = [...usedVarNames].filter(
      (name) => !rootDefs.has(name) && !RUNTIME_INJECTED.has(name)
    );
    expect(orphans).toEqual([]);
  });

  it('has no dead token — every :root custom property is referenced at least once', () => {
    const dead = [...rootDefs.keys()].filter((name) => !usedVarNames.has(name));
    expect(dead).toEqual([]);
  });

  it('has no unassigned colour literal outside :root', () => {
    const body = css.slice(0, root.start - 1) + css.slice(root.end + 1);

    // RGB triples of every :root colour token, for the alpha-variant rule.
    const rootTriples = new Set();
    for (const value of rootDefs.values()) {
      const hex = value.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
      if (hex) {
        let h = hex[1];
        if (h.length === 3) h = h.split('').map((c) => c + c).join('');
        rootTriples.add(`${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`);
        continue;
      }
      const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (rgb) rootTriples.add(`${rgb[1]},${rgb[2]},${rgb[3]}`);
    }

    // Skip url(...) contents (the select arrow's data: URI encodes a hex
    // colour as %23888 — not a literal in scanning terms, and a
    // replacement sweep must never rewrite inside it anyway).
    let scan = '';
    let i = 0;
    while (i < body.length) {
      if (body.startsWith('url(', i)) {
        let depth = 1;
        let j = i + 4;
        while (j < body.length && depth > 0) {
          if (body[j] === '(') depth++;
          else if (body[j] === ')') depth--;
          j++;
        }
        i = j;
        continue;
      }
      scan += body[i];
      i++;
    }

    const literalRe = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[\d.\s,%]+\)/g;
    const unassigned = [];
    for (const m of scan.matchAll(literalRe)) {
      const lit = m[0];
      const hex = lit.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
      let triple = null;
      if (hex) {
        let h = hex[1];
        if (h.length === 3) h = h.split('').map((c) => c + c).join('');
        triple = `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
      } else {
        const rgb = lit.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (rgb) triple = `${rgb[1]},${rgb[2]},${rgb[3]}`;
      }
      if (triple === null) continue;
      // Rule 1: alpha variant of a tokenized colour (RGB triple matches a :root token)
      if (rootTriples.has(triple)) continue;
      // Rule 2: black shadows
      if (triple === '0,0,0') continue;
      // Rule 3: header washes
      if (triple === '20,20,30') continue;
      unassigned.push(lit);
    }
    expect(unassigned).toEqual([]);
  });
});
