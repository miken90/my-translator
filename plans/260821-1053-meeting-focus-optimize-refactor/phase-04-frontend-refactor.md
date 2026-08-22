---
phase: 4
title: "Frontend Refactor"
status: completed
priority: P1
effort: "4-6d"
dependencies: [2]
---

# Phase 4: Frontend Refactor

## Overview

Split the 1927-LOC `app.js` into focused modules with an explicit session state machine, and collapse 4 duplicated TTS providers onto one base class. Highest-risk phase — gated on Phase 2 tests green.

## Requirements

- Functional: zero behavior change; every keyboard shortcut, settings control, session flow works as before
- Non-functional: no JS file >600 LOC; `app.js` <500 LOC; TTS duplication removed; CLAUDE.md invariants preserved (`sessionLog` never trimmed; `clearSession()` only after successful save; error handlers call `clearSession()` before `showPlaceholder()`)

## Architecture

```
src/js/
  app.js                     ← thin coordinator + state machine (Idle→Connecting→Listening→Stopping)
  settings-form-controller.js ← settings panel bind/read/write (from app.js:546-735)
  session-manager.js          ← save/load/auto-save/temp-flush/clearSession (app.js:1350-1493, 1615-1745)
  window-manager.js           ← pin/compact/resize/position (app.js:1523-1593)
  tts-controller.js           ← provider selection, toggle, callback wiring (app.js:67-77, 761-836)
  tts/base-tts-provider.js    ← queue, connect/speak/disconnect lifecycle, onAudioChunk/onError/onStatusChange, shared reconnect + fetch timeout
  tts/elevenlabs-tts.js       ← WS streaming _processQueue impl
  tts/google-tts.js           ← REST impl (+ fetch timeout from base)
  tts/edge-tts.js             ← Rust invoke impl
  tts/web-speech-tts.js       ← SpeechSynthesis impl
```

State machine replaces boolean cluster (`isRunning`, `isStarting`, ...): single `sessionState` + explicit transitions; derived getters keep old call sites readable.

## Related Code Files

- Modify: `src/js/app.js` (extract → shrink), `src/index.html` (script imports)
- Create: 5 controller/manager modules + `tts/` base per architecture above
- Modify: 4 TTS provider files → move into `tts/`, extend base
- Modify: `tests/js/` — add tests for extracted pure logic (session-manager save formatting, state transitions)

## Implementation Steps

1. Branch `refactor/phase-4-frontend`. One extraction per commit, app manually smoke-tested after each:
   a. window-manager → b. settings-form-controller → c. session-manager → d. tts-controller.
2. Introduce state machine in `app.js`; map old booleans to derived getters; delete booleans once call sites migrated.
3. TTS: write `base-tts-provider.js` from common pattern (queue mgmt duplicated across elevenlabs 228/google 138/edge 86/web-speech 145 LOC); port providers one by one, testing audio after each; unify auto-reconnect (currently ElevenLabs-only) + add Google fetch timeout.
4. Single-pass loop for TTS callback wiring (replaces double loop app.js:67-77).
5. Add unit tests for state transitions + session-manager markdown formatting.
6. Full smoke checklist run.

## Success Criteria

- [x] `wc -l src/js/app.js` <500; no JS file >600 LOC
- [x] All 4 TTS providers speak correctly; each ≤~80 LOC of provider-specific code
- [x] Vitest green incl. new state-machine + session-manager tests
- [x] Smoke checklist 100% pass (esp. start/stop/two-way, save session, shortcuts, TTS toggle mid-session)
- [x] CLAUDE.md invariants verifiably intact (tests from Phase 2 still green)

## Risk Assessment

- Biggest regression surface of the plan → per-extraction commits, smoke after each, tests gate merge.
- Hidden coupling via shared DOM ids/global settings singleton → extract by moving code verbatim first, then clean interfaces; no logic rewrites in same commit as moves.
