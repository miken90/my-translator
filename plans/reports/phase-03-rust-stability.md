# Phase 3 Report: Rust Stability

Plan: `plans/260821-1053-meeting-focus-optimize-refactor/`
Branch: `refactor/phase-3-rust` (from `refactor/phase-2-tests`), 4 commits, not pushed.
Scope discipline: only `src-tauri/` + this report touched (verified via `git status`) — a parallel worker owns `src/js/`.

## What was changed

**`commands/edge_tts.rs`**: replaced all 7 `.parse().unwrap()` header-value parses (Origin, User-Agent, Pragma, Cache-Control, Accept-Encoding, Accept-Language, Cookie) with `.map_err(...)?` returning a proper error to the frontend. Wrapped the WS message-read loop in `tokio::time::timeout(15s, read.next())` per message — a response that never sends `Path:turn.end` now errors out instead of hanging the command forever. Added `tokio` (`features = ["time"]`) as a direct Cargo dependency (previously only transitive via tauri/tokio-tungstenite).

**`settings.rs`**: `Settings::load()` now routes corrupt JSON through a new `parse_or_backup(path, content)` — on parse failure it writes the original corrupt bytes to `settings.json.bak`, logs, then returns defaults (previously silently discarded). Fixed the stale `~/Library/Application Support/...` (macOS) path comment to `%APPDATA%/...`. Extended Phase 2's test module with 2 new tests covering the backup path (temp-dir based, never touches the real settings file).

**`commands/audio.rs`**: `AudioForwarder` now holds `Vec<JoinHandle<()>>` for the main buffer-forward thread plus the two "both"-mode source-merge threads (previously fire-and-forget, unjoined). `stop_capture_inner` signals stop → stops system/mic sources (which is what actually unblocks the merge threads' blocking `recv()`) → then joins all handles with a combined ~2s bounded wait, detaching (dropping without joining) and logging any thread still running past the deadline instead of blocking indefinitely. Channel-send failures (final flush, merge forwarding) are now logged instead of silently swallowed via `let _ = ...`.

**`audio/wasapi.rs` → `audio/wasapi/{mod,com_setup,capture_loop}.rs`**: mechanical, behavior-preserving split. `mod.rs` keeps the public `SystemAudioCapture` API. `com_setup.rs` holds the COM completion handler, PROPVARIANT unsafe construction, and both `start_app_loopback`/`start_legacy_loopback` entry points. `capture_loop.rs` holds `run_capture_loop` + `convert_to_pcm_s16_16k`. Unsafe COM code moved character-for-character — no logic edits.

## Judgment calls

1. **Clippy scope**: `cargo clippy --all-targets -- -D warnings` fails crate-wide on pre-existing lints in files Phase 3 doesn't own (`transcript.rs:created_at`, `audio/mod.rs:TARGET_CHANNELS`) — these predate this phase and aren't in its file list. Within touched files, I fixed the 2 lints in code I actually wrote/modified (`field_reassign_with_default` in my Phase 2 settings.rs test, `empty_line_after_doc_comments` in edge_tts.rs's pre-existing top-of-file doc comment). I deliberately left `collapsible_if` in `capture_loop.rs` and the unused `own_pid`/`build_activation_propvariant`/`start_app_loopback` in `wasapi/*` — all pre-existing, and touching them would violate the phase's explicit "move verbatim, no logic edits in unsafe COM code" instruction. Documented here per that instruction's own "diff review line-by-line" intent.
2. **Bounded-join ordering**: the two "both"-mode merge threads only exit once `system_audio.stop()`/`microphone.stop()` drop their senders — so `stop_capture_inner` must stop the sources *before* joining, not just set the forwarder's flag and join immediately. Reordered accordingly (signal → stop sources → join), matching the Risk Assessment's "always bounded join; fall back to detach + log."
3. **`start_capture` now blocks briefly on the prior capture's threads**: since `start_capture` calls `stop_capture_inner` first, and that now does a real (bounded ≤2s) join instead of fire-and-forget, back-to-back start/stop cycles no longer pile up orphan threads — this is the intended fix for the "stop_capture then immediate start_capture cycles 10× without orphan threads" success criterion, not a regression.

## Test/build evidence

### `cargo test` (Windows, via `powershell.exe`)

```
running 12 tests
test audio::microphone::tests::downsample_48khz_to_16khz_produces_exact_length_for_divisible_input ... ok
test audio::microphone::tests::downsample_known_values_use_linear_interpolation ... ok
test audio::microphone::tests::upsample_produces_more_samples_than_input ... ok
test audio::microphone::tests::resample_is_identity_when_rates_match ... ok
test audio::microphone::tests::resample_returns_empty_for_empty_input ... ok
test settings::tests::default_settings_have_expected_baseline_values ... ok
test settings::tests::corrupt_json_falls_back_to_default_settings ... ok
test settings::tests::missing_fields_in_stored_json_fall_back_to_defaults ... ok
test settings::tests::custom_context_round_trips_with_translation_terms ... ok
test settings::tests::settings_survive_a_serde_json_round_trip ... ok
test settings::tests::valid_settings_json_does_not_create_a_backup_file ... ok
test settings::tests::corrupt_settings_are_backed_up_before_falling_back_to_defaults ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```
12/12 green (10 carried from Phase 2 + 2 new backup-on-corrupt tests).

### `cargo clippy --all-targets` (no `-D warnings`, full output reviewed)

8 warnings total, all pre-existing/verbatim-preserved (see Judgment call #1): `own_pid` unused (wasapi/mod.rs), `created_at` unused (transcript.rs — not in scope), `TARGET_CHANNELS` dead (audio/mod.rs — not in scope), `is_capturing` unused ×2 (microphone.rs — not in scope; wasapi/mod.rs — verbatim), `build_activation_propvariant`/`start_app_loopback` dead (com_setup.rs — verbatim ALAC path, was already dead before the split), `collapsible_if` (capture_loop.rs — verbatim). Zero new lints from Phase 3's actual logic changes (edge_tts.rs, settings.rs, audio.rs are clean).

### `cargo build` / `cargo build --release`

Both succeed, exit code 0. Release: `Finished release profile [optimized] target(s) in 33.10s`. Artifact `src-tauri/target/release/my-translator.exe` = **10.79 MB** (Phase 1 baseline was 10.81 MB — consistent). Same 7 warnings as `cargo test`/`clippy` (the `field_reassign_with_default`/`empty_line_after_doc_comments` fixes reduced clippy's count from 9→8 in lib, cargo build's own lint set stays at 7 since those two were clippy-only lints, not rustc warnings).

## Success criteria verification

- [x] `grep -n "unwrap()" src-tauri/src/commands/edge_tts.rs` → 0 matches
- [ ] Edge TTS unreachable-network → error within timeout, no hang — **not independently verified live** (would require a real network-down repro on Windows with GUI); the 15s `tokio::time::timeout` wrap is in place and mechanically bounds every read-loop iteration, but I could not exercise it end-to-end myself
- [x] Corrupt settings.json → `.bak` created, defaults used, log line present — verified via `corrupt_settings_are_backed_up_before_falling_back_to_defaults` test (temp dir, not the real config path)
- [ ] `stop_capture`/`start_capture` ×10 cycles, no orphan threads (process explorer) — **not independently verified live**, requires running the built exe on Windows with GUI; the bounded-join fix mechanically addresses this (see Judgment call #3) but a human should confirm via Task Manager/Process Explorer
- [x] `cargo test` + clippy green — 12/12 tests, clippy clean on all Phase 3 logic (see above)

## Unresolved questions

None — no user-owned decisions were hit this phase.

---

Status: DONE_WITH_CONCERNS
operation_id: op-mytranslator-phase3
Summary: Phase 3 complete — edge_tts unwraps replaced with mapped errors + 15s read timeout, settings.json corrupt-file backup added, audio forwarder threads now tracked and bound-joined on stop, wasapi.rs split verbatim into 3 files. cargo test 12/12, clippy clean on all new code, cargo build --release green (10.79MB). 4 commits on refactor/phase-3-rust, not pushed.
Concerns/Blockers: Two success criteria need a human on Windows with GUI to verify live (Edge TTS timeout against a real unreachable-network condition; 10× start/stop cycle thread-count check via Process Explorer) — I could not exercise either myself. The mechanical fixes for both are in place and unit-tested where testable.
