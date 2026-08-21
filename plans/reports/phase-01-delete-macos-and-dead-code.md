# Phase 1 Report: Delete macOS and Dead Code

Plan: `plans/260821-1053-meeting-focus-optimize-refactor/`
Branch: `refactor/phase-1-delete-macos` (from `main`), 4 commits, not pushed.

## What was deleted

**Rust**: `src-tauri/src/audio/system_audio.rs` (ScreenCaptureKit), `src-tauri/src/commands/local_pipeline.rs` (MLX sidecar mgmt), macOS `Cargo.toml` target block + `screencapturekit` dep, all `target_os = "macos"` cfg branches (audio/mod.rs, commands/transcript.rs), `Entitlements.plist`, `build.rs` screencapturekit linker rpath hack, `get_platform_info` command (was Apple-Silicon detection only).

**Python**: `scripts/setup_mlx.py`, `scripts/local_pipeline.py`.

**Frontend**: Local MLX mode UI (dropdown option, setup-progress modal, `_startLocalMode`/`_handleLocalPipelineResult`/`_runMlxSetup`, `_checkPlatformSupport`/`isAppleSilicon` detection) from `app.js`/`index.html`/`main.css`.

**Auto-updater** (scope extension beyond the two literal commented lines — see "Judgment calls" below): `src/js/updater.js`, `_checkForUpdates`/`_triggerUpdateCheck`/`_onUpdateAvailable`, the About-tab update UI (`#section-update`, badge), `@tauri-apps/plugin-updater`/`plugin-process` (npm + Cargo), `updater:*`/`process:*` capabilities, `tauri_plugin_process::init()` registration.

Also removed the now-dead `_restoreWindowPosition()` (its only call was the commented line; rationale in-code was Retina-display-specific, i.e. macOS-only) and its commented invocation.

## Judgment calls (flagging per report instructions)

1. **Updater scope**: Phase file said "remove plugin-updater/plugin-process if only used by disabled updater." Investigation showed `tauri_plugin_updater::init()` was never registered in the Tauri builder at all — so the plugin declarations, the About-tab "Check/Download" buttons, and `updater.js` were all dead on arrival (invoke calls would fail). Removed the whole feature rather than just the two commented lines, since the callback wiring (`onUpdateFound` etc.) lived only inside the now-removed `_checkForUpdates()` — leaving it half-removed would have left more orphaned code, not less.
2. **`Cargo.toml authors = ["phucnt"]`**: collides with the success-criteria grep for "phucnt" but is unrelated to the HOME fallback the criterion was written for. Asked user; **kept as-is** per explicit instruction — documented here as the expected non-clean grep line.
3. Left `settings.js`/`app.js` `translation_mode` field as a vestigial single-value ('soniox') setting rather than ripping out the dropdown/settings schema — that's Phase 4 (frontend refactor) territory, not Phase 1's "delete dead code."
4. Docs: updated README, `docs/project-overview-pdr.md` (explicitly named in phase file), plus `codebase-summary.md`, `system-architecture.md`, `deployment-guide.md`, `project-roadmap.md` (Platforms line + current-status claims) since they actively described deleted files/features. Left historical version-history entries (v0.1–v0.4 shipped features) and `project-changelog.md` untouched — those are historical record, not current claims. Archived (not deleted) `installation_guide.md`/`_vi.md` for macOS with a banner pointing to the Windows guide.

## Success criteria verification

- `grep -ri "screencapturekit|target_os = \"macos\"|phucnt|mlx" src-tauri/ scripts/ src/` → clean except `Cargo.toml:authors = ["phucnt"]` (accepted exception, see above). `Cargo.lock` confirmed clean (no `screencapturekit`/`tauri-plugin-updater`/`tauri-plugin-process` entries) after lockfile refresh.
- `system_audio.rs`, `local_pipeline.rs`, both Python scripts: confirmed gone (`ls` → "No such file or directory" for all 6 deleted files).
- Windows release build: **succeeded**. `powershell.exe -NoProfile -Command "npm run tauri build"` from `D:\WORKSPACES\PERSONAL\my-translator`, exit code 0, `Finished release profile [optimized] in 1m 10s`. 7 pre-existing warnings (unused vars/dead code in wasapi.rs/microphone.rs/transcript.rs), none related to this change.
  - Artifact: `src-tauri/target/release/my-translator.exe` — **10.81 MB**
  - Bundle: `src-tauri/target/release/bundle/nsis/MyTranslator_0.5.4_x64-setup.exe` — **2.62 MB**
- README/docs no longer advertise macOS or Local Mode: verified via grep sweep across README + docs/ (remaining "macOS" mentions are either archived-guide banners, contributor dev-machine notes ("install Rust on macOS/Linux/WSL"), or historical changelog/version-history — no current-state claims left).

## What I verified vs. what awaits human smoke

**Verified by me**: clean grep sweep, deleted-file absence, cargo/npm build success + artifact sizes, no new compiler warnings introduced.

**Awaits human smoke** (per plan.md — Phase 1 has a mandatory human smoke checkpoint; I cannot run the GUI): app launch, start/stop capture (system audio + mic), Soniox translation flow, TTS playback, session save. Please run `docs/smoke-test-checklist.md` on the built exe before merging/closing this phase.

## Unresolved questions

None outstanding — the one ambiguity (Cargo.toml authors field) was resolved with the user during execution (kept as-is).

---

Status: DONE
operation_id: op-mytranslator-phase1
Summary: Phase 1 complete — macOS/MLX/Python-sidecar code deleted, dead auto-updater removed, docs updated to Windows-only, Windows release build green (exe 10.81MB, nsis bundle 2.62MB). 4 commits on refactor/phase-1-delete-macos, not pushed.
Concerns/Blockers: Human smoke checkpoint (docs/smoke-test-checklist.md) still required before this phase can be considered closed per plan.md's per-phase gate — I could not run the GUI/audio flows myself.
