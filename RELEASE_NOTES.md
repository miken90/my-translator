# v0.8.0 — Header Restyle: Floating Pill Controls & a Real Drag Surface

The header goes from 13 tightly-packed controls to 8, grouped into 4
floating pill clusters on a bare, fully draggable bar — restoring a real
window-drag surface (the app had gotten too crowded to move around your
screen).

## ✨ What's New

- **Header redesigned into floating pill clusters** (Settings · Transport ·
  Library · Window), leaving the bar's ground bare and draggable — grab and
  move the window from anywhere between the pills, even while recording.
- **Mic source picker collapsed into a split-button menu.** Click the ▾ next
  to the mic icon for System audio / Microphone / Both, with a check mark on
  the active source and the same Ctrl+1/2/3 shortcuts as before.
- **Copy / Export / Clear collapsed into a single ⋯ menu**, with Clear kept
  clearly danger-styled behind a divider. New Ctrl+C / Ctrl+E shortcuts for
  Copy and Export.
- **Settings, Sessions, and Session Viewer headers** get the same pill
  treatment for a consistent look; the Session Viewer header can now be
  dragged too.
- **Accessibility pass**: proper menu semantics (roles, focus trap, arrow-key
  navigation), status/toast live regions, settings tabs as a real tab list,
  named form fields, and every shortcut hint now reads Ctrl instead of Cmd.
- **Crash-recovery dialog** can now be dismissed safely with Esc or a click
  outside it, without discarding the recovered transcript.

## 🐛 Fixes

- The "Listening…" indicator no longer gets stuck on screen after stopping
  a session before anything was transcribed.
- Both header menus now open anchored directly under their trigger button
  instead of the window's corner.
- The ⋯ menu right-aligns cleanly under its trigger instead of spilling
  past the window edge.
- Header menus now always paint above the transcript — previously the
  placeholder text and icons could show through an open menu.

---

# v0.7.0 — UI/UX Overhaul & Quiet Glass Reskin

This release focuses on the overlay itself: how the session reads, how the
toolbar is organized, and how the app looks and feels.

## ✨ What's New

- **Session viewer now scrolls as one region.** The AI summary sits on top and
  the transcript flows below it in a single, unified scroll area — no more
  juggling two separate scroll boxes.
- **Toolbar reorganized into labelled groups.** Related controls are grouped
  together; the export-format picker moved into Settings, and the
  transcripts-folder button moved into the Sessions view, so the main toolbar
  stays focused on session controls.
- **Recording elapsed timer**, so you can see how long a session has been running.
- **Window minimum width raised** so the close button can no longer get
  clipped on narrower layouts.
- **About tab now shows the real app version**, always in sync with the build.
- **Keyboard focus rings throughout**, plus consistent disabled and scrollbar
  styling across the app.
- **Overlay opacity now fades only the background** — text stays fully
  legible (WCAG AA contrast) at every opacity setting, instead of fading out
  with the background.
- **"Quiet Glass" visual refresh** — a calmer, more polished look for the
  overlay.

## 🐛 Fixes

- The floating action button (`.float-btn`) is now a proper square (was 26×28).

## 📁 Files Changed (selected)

- `src/index.html` — toolbar regroup, session-viewer scroll region markup
- `src/styles/main.css` — design-token layer, focus/disabled/scrollbar
  normalization, opacity-fade restructure, Quiet Glass reskin, float-btn fix
- `src/js/app.js`, `src/js/window-manager.js` — dynamic version display,
  minWidth enforcement
- `src/js/status-indicator.js` — recording elapsed timer
- `src/js/session-manager.js`, `src/js/settings-form-controller.js`,
  `src/js/settings.js`, `src/js/tts-controller.js` — toolbar-regroup wiring
- `src-tauri/tauri.conf.json` — window minWidth 600
- `src-tauri/src/settings.rs` — supporting settings changes for the regroup

---

# v0.6.0 — Windows-Only, Meeting Features & Stability

My Translator is now **Windows-only**, repositioned as a focused real-time
translation tool for meetings and video watching. This release also ships
crash recovery, transcript export, a persisted/regenerable AI summary,
transcript Q&A, and a round of Rust/frontend stability and performance work.

> **macOS users**: macOS support has been removed as of this version. Please
> stay on **v0.5.4** — the last release with macOS support (available in
> GitHub Releases history / git tags).

## 🪟 Windows-Only

- Removed all macOS code: ScreenCaptureKit system audio, code-signing/
  notarization config, macOS install guides (archived, not deleted)
- Removed the experimental Local Mode (MLX + Whisper, Apple-Silicon-only
  offline STT) entirely, including its Python sidecar scripts
- Removed the dead auto-updater plugin stack (declared but never actually
  wired into the Tauri builder — inert code, not a functional regression)

## 🛡️ Stability

- **Edge TTS no longer hangs**: replaced 7 `.unwrap()` header-parse calls
  with proper error handling; the WebSocket read loop now times out after
  15s instead of waiting forever for a response missing `turn.end`
- **Corrupt settings.json is recoverable**: a corrupt settings file is now
  backed up to `settings.json.bak` (with a log line) before falling back
  to defaults, instead of being silently discarded
- **No more orphaned audio threads**: capture forwarder threads are now
  tracked and joined with a bounded (~2s) timeout on stop, so repeated
  start/stop cycles can't accumulate zombie threads

## ⚡ Performance

- **Incremental transcript rendering**: replaced the full `innerHTML`
  rebuild on every ~100ms update with a keyed card renderer — only cards
  whose content actually changed get repainted, keeping long (multi-hour)
  sessions smooth
- Provisional (in-progress) text updates are coalesced via
  `requestAnimationFrame` instead of rendering on every single update
- Bounded internal buffers (Soniox context-carryover history, transcript
  trim) so memory stays flat over very long sessions

## ✨ New Features

### Crash-safe session logging
- Temp transcript now also flushes every 20 finalized segments, in addition to the existing 2-minute timer — worst-case loss on a crash is now ~20 utterances instead of up to 2 minutes of speech
- On startup, an orphaned temp transcript (left behind by a crash/kill instead of a graceful stop) is detected and offered for recovery — **Recover** saves it as a proper session file, **Discard** deletes it

### Copy / Export transcript
- Export button (overlay + sessions view) saves the session as a timestamped `.md` or `.txt` file with per-entry timestamps, always from the full session log (never the trimmed live display buffer)
- Existing Copy button unchanged (clipboard, full session log)

### AI summary persisted into the session file
- Summarizing a session now saves the result under a `## AI Summary` section in the session's `.md` file (model name + generation timestamp — never the API endpoint or key)
- Reopening a session that already has a summary shows it immediately; the button becomes **Regenerate**, which replaces the section rather than duplicating it
- Long transcripts (over ~6000 estimated tokens) are summarized via map-reduce chunking on utterance boundaries instead of being truncated — a multi-hour session summarizes without a context-length error

### Transcript Q&A
- New chat panel in the sessions view — ask questions about a loaded session, answered using the same AI endpoint configured for summaries
- Same map-reduce chunking as summary for long transcripts; no retrieval/embeddings infrastructure
- Graceful, disabled state with a hint when no AI endpoint is configured
- No question/answer history persists beyond the current sessions-view visit

## 🔧 Internal

- Frontend `app.js` (was 1927 LOC) split into focused modules (session-manager, tts-controller, window-manager, settings-form-controller, session-state, etc.); 4 duplicated TTS providers unified onto one `BaseTTSProvider`
- New test suite from scratch: **91 JS tests** (Vitest) + **16 Rust tests** (`cargo test`), covering session pairing/trim invariants, context carryover, settings, chunking, export formatting, and crash-recovery decision logic

## 📁 Files Changed (selected)
- `src/js/session-manager.js` — crash recovery, export, summary persistence/regenerate, Q&A wiring
- `src/js/ui.js`, `src/js/transcript-card-renderer.js` — keyed incremental renderer, segment-count flush hook, `getExportText()`
- `src/js/ai-summary.js`, `src/js/ai-client.js` (new) — map-reduce chunking, `## AI Summary` section formatting/upsert
- `src/js/session-qa.js` (new) — transcript Q&A module
- `src/js/tts/base-tts-provider.js` (new) — shared TTS provider base class
- `src-tauri/src/commands/transcript.rs` — `update_transcript` (atomic temp+rename write-back), `export_transcript`
- `src-tauri/src/commands/edge_tts.rs`, `src-tauri/src/settings.rs`, `src-tauri/src/commands/audio.rs` — stability fixes above
- `src-tauri/src/audio/wasapi/` — split into `mod.rs`/`com_setup.rs`/`capture_loop.rs` (behavior-preserving)
- Deleted: `src-tauri/src/audio/system_audio.rs`, `src-tauri/src/commands/local_pipeline.rs`, `scripts/setup_mlx.py`, `scripts/local_pipeline.py`, `src/js/updater.js`, `src-tauri/Entitlements.plist`

---

# v0.5.4 — Segment Pairing Fix & Faster Translation

## 🐛 Bug Fixes

### Fixed: Original text and translation mismatched during long meetings
The core issue was that original text and its translation could end up in different cards, especially in long meetings or fast-paced conversations.

**Root causes fixed:**
- **Wrong matching order** — Translation was paired with the oldest pending original (FIFO), but Soniox emits translation for the *most recent* segment. Switched to LIFO matching.
- **Pending originals deleted too early** — Segments waiting for translation were removed after 10s, causing later translations to pair with wrong originals. Now uses a 2-tier system: mark stale at 10s (dimmed display), remove at 60s (safety valve).
- **Display trimming removed pending segments** — Buffer trimming could delete originals that hadn't received translations yet. Now only trims fully translated segments.
- **Timestamp collision risk** — Two originals arriving within 1ms could share the same `createdAt`, causing wrong sessionLog matching. Added monotonic segment IDs.

### Improved: Stale segment UX
- Segments that never receive a translation now show as dimmed + strike-through (instead of showing `...` forever)
- Stale segments are automatically cleaned up after 60s

## ⚡ Performance

### Faster translation response
- **Audio batch interval reduced from 200ms → 100ms** — Audio chunks are now sent to Soniox twice as fast, reducing end-to-end translation latency
- Combined with the Endpoint Delay slider (Settings → min 0.5s), total latency can be reduced from ~2-3s to ~1-1.5s

## 📁 Files Changed
- `src/js/ui.js` — LIFO matching, monotonic IDs, 2-tier stale cleanup, stale card rendering
- `src/styles/main.css` — Stale segment styling (opacity + strike-through)
- `src-tauri/src/commands/audio.rs` — Audio batch interval 200ms → 100ms
