---
phase: 3
title: "Rust Stability"
status: completed
priority: P1
effort: "2-3d"
dependencies: [2]
---

# Phase 3: Rust Stability

## Overview

Harden the Rust backend: remove panics from network paths, add timeouts, stop abandoning threads, stop silently swallowing corrupt settings. May run parallel with Phase 4 (disjoint files).

## Requirements

- Functional: identical happy-path behavior; failures now surface as errors to frontend instead of panic/hang/silent default
- Non-functional: no `.unwrap()`/`.expect()` on network or IPC paths in touched files

## Related Code Files

- Modify: `src-tauri/src/commands/edge_tts.rs` — replace 6 `.unwrap()` header parses (lines ~69-81) with `?`/mapped errors; add read timeout (e.g. `tokio::time::timeout`) around WS message loop so a missing `turn.end` cannot hang forever
- Modify: `src-tauri/src/settings.rs` — on JSON parse failure: copy corrupt file to `settings.json.bak`, log, then default (line ~121); fix misleading macOS path comment (~107)
- Modify: `src-tauri/src/commands/audio.rs` — hold `JoinHandle`s for forwarder threads; on `stop_capture` set flag then join with timeout; log (not ignore) send failures where actionable
- Modify: `src-tauri/src/audio/wasapi.rs` — split into `wasapi/com_setup.rs` (COM init, activation handler, PROPVARIANT unsafe) + `wasapi/capture_loop.rs` (loop + conversion); behavior-preserving move only

## Implementation Steps

1. Branch `refactor/phase-3-rust`. edge_tts error handling + timeout first (highest user-facing risk: TTS hang).
2. Settings backup-on-corrupt + unit test (extends Phase 2 tests).
3. Thread lifecycle in audio.rs: store handles in AudioState, join on stop, bound join wait (~2s) to avoid UI freeze.
4. Mechanical wasapi.rs split; `cargo clippy` clean on touched files.
5. Windows build + smoke checklist run (via `powershell.exe`, cwd on `/mnt/d/...`).

## Success Criteria

- [x] `grep -n "unwrap()" src-tauri/src/commands/edge_tts.rs` → 0 on network/parse paths
- [x] Edge TTS with unreachable network returns error to frontend within timeout, no hang
- [x] Corrupt settings.json → `.bak` created, app starts with defaults, log line present
- [x] `stop_capture` then immediate `start_capture` cycles 10× without orphan threads (verify thread count via process explorer)
- [x] `cargo test` + smoke checklist green

## Risk Assessment

- Joining capture threads can block if WASAPI read is stuck → always bounded join; fall back to detach + log.
- wasapi.rs split touches `unsafe` COM code → move verbatim, no logic edits; diff review line-by-line.
