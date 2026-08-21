# Phase 2 Report: Test Harness

Plan: `plans/260821-1053-meeting-focus-optimize-refactor/`
Branch: `refactor/phase-2-tests` (from `refactor/phase-1-delete-macos`), 3 commits, not pushed.

## What was built

**Vitest harness** (`vitest.config.js`, `tests/js/setup.js` + 4 spec files): default `environment: 'node'`, per-file `// @vitest-environment jsdom` override for the two `TranscriptUI` spec files that touch DOM. `setup.js` stubs `globalThis.window.__TAURI__.core.invoke` (exported as `invokeMock` so `settings.test.js` can control per-test resolve/reject) before any test module imports app code — required because `settings.js:5` dereferences `window.__TAURI__.core` at module top level and captures `invoke` by reference at import time. No app code was restructured.

**Rust unit tests** (`#[cfg(test)]`, compiled only under `cargo test` — zero shipped-binary impact): `settings.rs` (10 tests total across both files, see counts below) covers default baseline values, serde round-trip, partial/missing-field fallback, corrupt-JSON fallback, custom-context round-trip. `microphone.rs` covers `simple_resample` identity/empty/divisible-length/known-interpolation-values/upsample cases. Added `PartialEq` derives to `Settings`/`CustomContext`/`TranslationTerm` to enable equality assertions — this is the only change that reaches the shipped release binary (trait impl only, no behavior change; test modules themselves are `cfg(test)`-gated out of release builds).

**`docs/smoke-test-checklist.md`**: created with all items the dispatch spec required (audio sources, one-way/two-way, all 3 TTS providers, font/panel controls, save+reopen, kill-mid-session recovery, scroll-while-streaming). **Not run** — per dispatch instructions ("mark it as run-by-human") and Phase 1 precedent, I cannot operate a Windows GUI/audio session myself. Left as an unchecked template with a Run Log table for the human to fill in.

## Test evidence

### `npx vitest run` — full output

```
 Test Files  4 passed (4)
      Tests  30 passed (30)
   Duration  ~22-26s
```

30/30 green, ≥20 required. Breakdown by file:
- `session-pairing.test.js` — 6 tests (monotonic ids, original+translation sessionLog mirroring, LIFO pairing, orphan-translation case, no re-pairing an already-translated segment)
- `segment-trim.test.js` — 6 tests (trim-to-floor-of-2 on maxChars overflow, sessionLog never trimmed, pending originals never trimmed, stale-mark at >10s, expire-and-remove at >60s while sessionLog stays intact, translated segments immune to staleness)
- `soniox-context.test.js` — 10 tests (`_buildContext` null/general/legacy-domain/terms/carryover-only/text+carryover joins; `_addToHistory`/`_getCarryoverContext` null-when-empty, join-with-space, trim-oldest-over-cap, keep-at-least-one-even-if-oversized)
- `settings.test.js` — 8 tests (load defaults/merge/unknown-fields-preserved/reject-fallback; save merge+persist/reject-leaves-unchanged; get() returns a copy; onChange notifies + unsubscribe works)

Full per-test pass list captured in the terminal transcript this session (all ✓, stderr lines are expected `console.error` calls from the reject-path tests, not failures).

### `cargo test` (Windows, via `powershell.exe`) — full output

```
running 10 tests
test audio::microphone::tests::downsample_48khz_to_16khz_produces_exact_length_for_divisible_input ... ok
test audio::microphone::tests::downsample_known_values_use_linear_interpolation ... ok
test audio::microphone::tests::upsample_produces_more_samples_than_input ... ok
test settings::tests::missing_fields_in_stored_json_fall_back_to_defaults ... ok
test settings::tests::corrupt_json_falls_back_to_default_settings ... ok
test settings::tests::default_settings_have_expected_baseline_values ... ok
test audio::microphone::tests::resample_is_identity_when_rates_match ... ok
test audio::microphone::tests::resample_returns_empty_for_empty_input ... ok
test settings::tests::custom_context_round_trips_with_translation_terms ... ok
test settings::tests::settings_survive_a_serde_json_round_trip ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

10/10 green. Same 7 pre-existing warnings as Phase 1's build (unused vars/dead code in `wasapi.rs`/`transcript.rs`/`microphone.rs`/`audio/mod.rs`) — none introduced by this phase.

## Judgment calls / deviations from the literal phase file

1. **`Settings::load()` not called directly in tests.** `settings_path()` resolves to the real `%APPDATA%/com.personal.translator/settings.json` with no injection point. Rather than restructure it for testability (out of scope — that's Phase 3/Rust-stability territory) or risk touching/corrupting a real user's settings file during `cargo test`, the corrupt-path test exercises the exact same expression `load()` uses (`serde_json::from_str(&content).unwrap_or_default()`) directly against an in-memory string. Documented in-code.
2. **`endpoint_delay` 3000→1500 migration test**: confirmed still absent per dispatch instruction — it lives in DOM-coupled `app.js:_populateSettingsForm`, deferred to Phase 4 as instructed. Not chased.
3. **`PartialEq` derives added** to 3 Rust structs — additive, non-breaking, needed for round-trip equality assertions.
4. **Smoke checklist not executed** — created as a template only, per explicit dispatch override of the phase file's "run it once ... record baseline" step.

## Success criteria verification

- [x] `npx vitest run` ≥20 tests green — 30/30
- [x] `cargo test` green (via `powershell.exe` on Windows) — 10/10
- [x] `docs/smoke-test-checklist.md` exists — created; baseline **not** recorded (see above, human-run required)
- [x] No change to shipped app behavior — vitest/jsdom are devDependencies only; Rust `#[cfg(test)]` modules compile out of release builds; only shipped-binary change is the additive `PartialEq` derives (no behavior change)

## Unresolved questions

None — no user-owned decisions were hit this phase.

---

Status: DONE
operation_id: op-mytranslator-phase2
Summary: Phase 2 complete — vitest harness with 30 green characterization tests (session pairing, trim invariants, context carryover, settings), 10 green cargo tests (settings serde/corrupt-path, resampler), smoke-test-checklist.md created (unrun, awaiting human). 3 commits on refactor/phase-2-tests, not pushed.
Concerns/Blockers: Smoke checklist baseline still needs a human run before Phase 2's own gate (and Phase 1's carried-forward smoke checkpoint) can close.
