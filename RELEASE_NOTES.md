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
