// @vitest-environment jsdom
//
// Loads src/index.html into jsdom and asserts every getElementById id
// literal used across src/js/** resolves to a real element. No test read
// index.html before this file, so an id rename/removal there could break
// every getElementById binding silently — npm test stayed green regardless.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

// Ids referenced via getElementById in src/js/** with no matching element in
// src/index.html today. All live in settings-form-controller.js, guarded by
// `?.` or an `if (el)` check, so a lookup miss there is a no-op, not a bug.
const KNOWN_DEAD = [
  'check-tts-enabled',
  'hint-mode-local',
  'link-elevenlabs',
  'range-tts-speed',
  'tts-settings-detail',
  'tts-speed-value',
];

function collectJsFiles(dir) {
  let files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(collectJsFiles(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function collectIdsReferencedByJs() {
  const ids = new Set();
  for (const file of collectJsFiles(path.join(repoRoot, 'src/js'))) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(/getElementById\('([a-zA-Z0-9_-]+)'\)/g)) {
      ids.add(match[1]);
    }
  }
  return [...ids].sort();
}

function mountIndexHtmlBody() {
  const html = readFileSync(path.join(repoRoot, 'src/index.html'), 'utf8');
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
  document.body.innerHTML = bodyMatch ? bodyMatch[1] : html;
}

describe('src/index.html — id bindings', () => {
  it('resolves every getElementById id used by src/js/**, minus KNOWN_DEAD', () => {
    mountIndexHtmlBody();

    const missing = collectIdsReferencedByJs()
      .filter((id) => !KNOWN_DEAD.includes(id))
      .filter((id) => !document.getElementById(id));

    expect(missing).toEqual([]);
  });

  it('KNOWN_DEAD ids are really absent from the HTML, so the exemption list stays honest', () => {
    mountIndexHtmlBody();

    for (const id of KNOWN_DEAD) {
      expect(document.getElementById(id)).toBeNull();
    }
  });
});
