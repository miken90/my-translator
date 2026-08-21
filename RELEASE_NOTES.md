# Unreleased — Meeting Features (Phase 6)

> Version number TBD — part of the single final release planned after the meeting-focus-optimize-refactor (Phases 1-6).

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

## 📁 Files Changed
- `src/js/session-manager.js` — crash recovery, export, summary persistence/regenerate, Q&A wiring
- `src/js/ui.js` — segment-count flush hook, `getExportText()`
- `src/js/ai-summary.js` — map-reduce chunking, `## AI Summary` section formatting/upsert
- `src/js/ai-client.js` — new shared OpenAI-compatible chat client (extracted, no behavior change)
- `src/js/session-qa.js` — new transcript Q&A module
- `src-tauri/src/commands/transcript.rs` — `update_transcript` (atomic temp+rename write-back), `export_transcript`
- `src/index.html`, `src/styles/main.css` — export controls, recovery dialog, Q&A panel

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
