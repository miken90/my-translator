---
phase: 1
title: "Delete macOS and Dead Code"
status: completed
priority: P1
effort: "1-2d"
dependencies: []
---

# Phase 1: Delete macOS and Dead Code

## Overview

Remove all macOS-only code, the MLX/Whisper local mode (Apple Silicon only), and permanently disabled dead code. Cheapest phase, highest LOC reduction (~1500+), shrinks every later phase.

## Requirements

- Functional: Windows build + all current features unchanged after deletion
- Non-functional: no conditional-compilation branches left that can never compile on Windows

## Related Code Files

- Delete: `src-tauri/src/audio/system_audio.rs` (ScreenCaptureKit, 158 LOC)
- Delete: `src-tauri/src/commands/local_pipeline.rs` (MLX sidecar, 321 LOC)
- Delete: `scripts/setup_mlx.py`, `scripts/local_pipeline.py`
- Modify: `src-tauri/Cargo.toml` — remove `screencapturekit`, `macos-private-api` feature, all `[target.'cfg(target_os = "macos")']` blocks
- Modify: `src-tauri/src/lib.rs` — remove LocalPipelineState + local-pipeline command registrations (17 commands → fewer)
- Modify: `src-tauri/src/audio/mod.rs` — drop macOS re-export
- Modify: `src-tauri/src/commands/mod.rs`, `transcript.rs` — remove macOS `open` branch, keep `explorer`
- Modify: `src/js/app.js` — remove local-mode UI wiring, delete commented `_checkForUpdates()` (app.js:84) and `_restoreWindowPosition()` (app.js:80)
- Modify: `src/index.html` — remove local-mode settings UI if present
- Modify: `package.json` — remove `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process` if only used by disabled updater
- Modify: `README.md`, docs — remove macOS badges/claims/install guides or mark archived; update `docs/project-overview-pdr.md` platform scope

## Implementation Steps

1. Branch `refactor/phase-1-delete-macos`.
2. Delete Rust macOS modules + Cargo deps; fix compile errors outward from `lib.rs`.
3. Delete Python sidecar scripts + any invocation paths; remove `/Users/phucnt` fallbacks (both in deleted file — verify no others remain: `grep -r phucnt`).
4. Strip frontend local-mode UI + dead commented features.
5. Trim package.json plugins; `npm install` to refresh lockfile.
6. Update README/docs platform claims.
7. Build: `powershell.exe` `npm run tauri build` from Windows path; run smoke checks (start/stop capture, TTS, save session).

## Success Criteria

- [x] `grep -ri "screencapturekit\|target_os = \"macos\"\|phucnt\|mlx" src-tauri/ scripts/ src/` returns nothing EXCEPT `src-tauri/Cargo.toml` `authors = ["phucnt"]` — attribution field stays, expected exception (decided during execution 2026-08-21)
- [x] `system_audio.rs`, `local_pipeline.rs`, both Python scripts gone
- [x] Windows release build succeeds; portable exe starts, captures, translates, saves
- [x] README/docs no longer advertise macOS or Local Mode

## Risk Assessment

- Local Mode has real users → mitigated: feature is experimental + Apple Silicon only, irrelevant to Windows-only scope. Note removal in RELEASE_NOTES.md.
- Updater plugins may be referenced elsewhere → grep before removing from package.json.
