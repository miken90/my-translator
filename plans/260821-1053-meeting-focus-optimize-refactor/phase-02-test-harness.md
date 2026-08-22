---
phase: 2
title: "Test Harness"
status: completed
priority: P1
effort: "2-3d"
dependencies: [1]
---

# Phase 2: Test Harness

## Overview

Build the safety net before touching behavior: Vitest for pure-logic JS modules, `cargo test` for Rust logic, and a manual smoke checklist. No DOM tests, no E2E.

## Requirements

- Functional: tests pin down current behavior of session pairing, trimming, context carryover, settings load/migration, resampling
- Non-functional: tests run without bundler changes to the app (`vitest` as devDependency only); zero impact on shipped exe

## Architecture

Vitest runs ES modules directly, BUT several modules dereference `window.__TAURI__.core` at module top level (`settings.js:5`, `edge-tts.js:7`, `app.js:16`) and construct singletons at import (`soniox.js:526`, `settings.js:92`). A `setupFiles` entry MUST stub the Tauri global before any import, e.g. `globalThis.window = { __TAURI__: { core: { invoke: vi.fn() } } }` — do NOT restructure app code to make it testable in this phase. Modules with heavy DOM/Tauri coupling (`ui.js` render, `app.js`) are NOT unit-tested — their pure logic gets extracted in Phase 4 and tested then.

## Related Code Files

- Create: `vitest.config.js`, `tests/js/session-pairing.test.js`, `tests/js/segment-trim.test.js`, `tests/js/soniox-context.test.js`, `tests/js/settings.test.js`
- Create: `src-tauri/src/` unit tests inline (`#[cfg(test)]`) for `settings.rs` parse/corrupt-file behavior, `microphone.rs` `simple_resample`
- Create: `docs/smoke-test-checklist.md` — manual pre-release checklist (start/stop both sources, two-way mode, each TTS provider, font/panel controls, save + reopen session, kill mid-session recovery, 30-min run scroll behavior)
- Modify: `package.json` — add `vitest` devDependency + `test` script

## Implementation Steps

1. Branch `refactor/phase-2-tests`. Add vitest, config with `environment: 'node'` (jsdom only if a target module demands it).
2. Test `TranscriptUI` data logic via minimal DOM stub: `addOriginal`/`addTranslation` id pairing, orphan translation case, `sessionLog` never trimmed while `segments` trims at maxChars, stale-segment cleanup keeps sessionLog intact.
3. Test `soniox.js` context carryover: CONTEXT_HISTORY_CHARS cap honored, translation-history assembly.
4. Test `settings.js`/Rust `Settings::load`: defaults, unknown fields preserved, corrupt JSON path. NOTE: the endpoint_delay 3000→1500 migration lives in DOM-coupled `_populateSettingsForm` (app.js:568), NOT settings.js — its test is deferred to Phase 4 after extraction.
5. Rust: `cargo test` for resampler (known input → expected output length/values) and settings serde round-trip.
6. Write smoke checklist doc; run it once on current build to record baseline.

## Success Criteria

- [x] `npx vitest run` ≥20 tests green
- [x] `cargo test` green (run via `powershell.exe` on Windows target)
- [x] `docs/smoke-test-checklist.md` exists with baseline recorded
- [x] No change to shipped app behavior (devDependencies only)

## Risk Assessment

- `ui.js` imports may pull DOM at module load → stub `document` minimally or defer those assertions to Phase 4 extraction; do not restructure app code in this phase.
- WSL vs Windows node: run vitest on whichever node runs; logic tests are platform-neutral. Rust tests must run on Windows toolchain per project rule.
