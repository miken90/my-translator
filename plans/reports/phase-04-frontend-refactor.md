# Phase 4: Frontend Refactor — Completion Report

operation_id: op-mytranslator-phase4
Branch: refactor/phase-4-frontend (worktree: my-translator-phase4)
Scope touched: src/js/, src/index.html, tests/js/ only. src-tauri/ untouched (owned by parallel Rust worker).

## Summary

Split app.js (1459 LOC at start of this phase — plan cited 1927, already reduced by earlier phases) into window-manager.js, settings-form-controller.js, session-manager.js, tts-controller.js + thin app.js with an explicit SessionState machine (Idle/Connecting/Listening/Stopping). Consolidated all 4 TTS providers onto tts/base-tts-provider.js. Single-pass TTS callback wiring. Added tests for state transitions, session-manager formatting, and the endpoint_delay migration.

## What changed

New modules:
- `src/js/window-manager.js` — pin/compact/window-position + their DOM bindings
- `src/js/settings-form-controller.js` — settings panel populate/save/bind + font-size quick-controls + color dots
- `src/js/session-manager.js` — transcript save/auto-save/temp-flush + saved-sessions browser (list/open/copy/AI-summarize)
- `src/js/tts-controller.js` — provider selection/toggle/configure + single-pass callback wiring
- `src/js/session-state.js` — `SessionState` enum (Idle/Connecting/Listening/Stopping) + `isToggleBlocked()` guard
- `src/js/toast.js`, `src/js/status-indicator.js` — small stateless DOM utilities (extracted to hit the LOC gate cleanly)
- `src/js/tts/base-tts-provider.js` — shared pull-queue, reconnect scheduler, `_fetchWithTimeout` helper
- `src/js/tts/{edge,google,elevenlabs,web-speech}-tts.js` — the 4 providers, ported off the old top-level files, each extending the base class

app.js: 1459 → 495 LOC (thin coordinator + state machine). No file >600 LOC (largest: soniox.js 526, pre-existing, untouched).

## State machine

Replaced the `isRunning`/`isStarting` boolean pair with `sessionState` (Idle/Connecting/Listening/Stopping) and one `_handleStartStopToggle()` entry point shared by the start/stop button and its keyboard shortcut (previously near-duplicated). `isRunning` is now a derived getter (`sessionState === LISTENING`), timed to match the old boolean exactly for the golden path (button flips at the same points it always did).

One intentional, disclosed behavior tightening: the old `isStarting` guard only blocked a re-entrant *start* click; a rapid click during `stop()`'s teardown could race a new `start()` in against the old code (isRunning flipped false synchronously at the top of stop(), before teardown finished). The new guard blocks re-entrant toggles during **both** Connecting and Stopping. This closes a latent race rather than changing any golden-path behavior — flagging it per the "no logic change without a callout" instruction, not asking for a decision (it's a pure safety improvement with no user-visible downside).

## TTS consolidation

- `BaseTTSProvider` provides: the shared pull-based text queue (`speak()`/`_processQueue()`/subclass `_synthesize()`) used by edge/google/web-speech, plus `_scheduleReconnect()`/`_resetReconnect()` reused by ElevenLabs' WebSocket reconnect (previously ElevenLabs-only, per plan: "unify auto-reconnect"), plus shared `disconnect()`/`_setStatus()`/`_fetchWithTimeout()`.
- Google TTS: added a 10s request timeout via `_fetchWithTimeout` (explicitly required by the plan — previously an unbounded fetch could hang forever on a stalled connection).
- ElevenLabs keeps its own WS send/flush queue (`_textQueue`/`_sendText`/`_flushQueue`) since it doesn't fit the pull-queue pattern — it reuses only the reconnect/disconnect/status plumbing from the base.
- Web Speech: ported for parity (it's pre-existing dead code — not imported by app.js, no UI provider option references it — this refactor did not wire it in, only relocated/based it, since wiring it in would be new scope).
- `stop()`'s pre-existing quirk of disconnecting only ElevenLabs+Edge (not Google, which is stateless REST) was preserved as-is — not "fixed", since that's a behavior change outside this phase's zero-behavior-change mandate.

## Tests

30 → 59 vitest tests, all green after every commit:
- `session-state.test.js` — enum shape + `isToggleBlocked` guard logic
- `app-session-state.test.js` — `App._handleStartStopToggle()` transitions (Connecting/Stopping guards, success/early-return/error paths), isolated from network/DOM via stubbed `start`/`stop`
- `session-manager-formatting.test.js` — `formatDuration`, `formatBytes`, `parseSessionMeta`, `saveTranscriptFile`, and the `finalizeSession` CLAUDE.md invariant (clearSession only after a successful save)
- `settings-form-controller.test.js` — the endpoint_delay 3000→1500 migration (now lives in `SettingsFormController.populateForm()`, per the dispatch note)

`tests/js/setup.js` gained a `window.__TAURI__.window.getCurrentWindow` stub (needed to import/construct `App` in tests); `App` is now exported.

## CLAUDE.md invariants — verified intact

- `sessionLog[]` never trimmed: ui.js untouched (out of Phase 4 scope; Phase 5 owns it).
- `clearSession()` only after successful save: preserved via `SessionManager.finalizeSession()`, covered by tests.
- Error handlers call `clearSession()` before `showPlaceholder()`: no error handler in the codebase calls `showPlaceholder()` (pre-existing state, unchanged); no new one was introduced.

## Method

One extraction per commit as instructed, in the specified order (window-manager → settings-form-controller → session-manager → tts-controller → state machine → TTS base class + providers one at a time), each followed by a green `npx vitest run`. One deviation: window-manager and settings-form-controller landed in a single commit (both were small, low-risk, and verified together) rather than two — flagging this since the instruction was explicit about one-per-commit; every other extraction is its own commit. A final commit was needed after the TTS work to bring app.js from 519 to 495 LOC (moving the last few DOM bindings into the new modules + two small new utility files) — no logic changes, purely relocation/data-driven dispatch tables replacing repeated if-blocks.

## Final counts

- Vitest: **59/59 passing** (Phase 2's 30 + 29 new)
- `wc -l src/js/app.js`: **495** (<500 ✓)
- No JS file >600 LOC ✓ (largest is pre-existing soniox.js at 526)
- 4 TTS providers all extend `BaseTTSProvider` ✓

## Not done (explicitly out of scope for Phase 4)

- Full Windows build/GUI/audio smoke verification — deferred to the human smoke checkpoint per plan.
- `cargo`/`tauri build` — not run from this worktree per the dispatch note (parallel Rust worker owns src-tauri/).
- ui.js rendering-performance work — Phase 5.

## Unresolved questions

None.

Status: DONE
operation_id: op-mytranslator-phase4
Summary: Phase 4 frontend refactor complete — app.js split into window-manager/settings-form-controller/session-manager/tts-controller + state machine; all 4 TTS providers consolidated onto a shared base class; app.js at 495 LOC; 59/59 vitest tests green.
Concerns/Blockers: One process deviation (window-manager + settings-form-controller shared a commit instead of two); one intentional behavior tightening (toggle also guarded during Stopping, closing a latent race) — both called out above, neither blocks merge. Human smoke checkpoint (start/stop/two-way, save session, shortcuts, TTS toggle mid-session) still required before this phase can close per the plan.
