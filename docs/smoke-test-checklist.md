# Smoke Test Checklist

Manual pre-release/pre-merge checklist for My Translator (Windows). Requires a
human on Windows with GUI + audio — no automated test can drive this. Run the
built portable `.exe` (or `npm run tauri build` output) and check off each
item.

**Status**: not yet run — record results (date, build version, pass/fail per
item) here after each run. This checklist is a template until a human
completes the first pass.

## Audio capture

- [ ] Start capture with source = **System Audio** — translations appear
- [ ] Stop capture with source = System Audio — capture stops cleanly, no error toast
- [ ] Start/stop capture with source = **Microphone**
- [ ] Start/stop capture with source = **Both** (system + mic)

## Translation modes

- [ ] One-way translation: source language → target language, correct pairing (original above, translation below, same card)
- [ ] Two-way translation: Language A ↔ Language B, speaker auto-detection switches direction correctly
- [ ] TTS is disabled/blocked when switching to two-way mode (feedback-loop guard)

## TTS providers

- [ ] Edge TTS (free): toggle TTS on, translated text is read aloud audibly
- [ ] Google Cloud TTS (Chirp 3 HD): audible, correct voice/language
- [ ] ElevenLabs TTS: audible, correct voice
- [ ] TTS speed slider (Edge/Google) audibly changes playback rate

## Display controls

- [ ] Font size +/- buttons change transcript text size live
- [ ] Single/dual panel toggle switches view correctly
- [ ] Compact mode hides the control bar
- [ ] Pin/unpin toggles always-on-top

## Session persistence

- [ ] Stop a session with content → `.md` file saved to transcripts folder
- [ ] Reopen the saved session from Sessions view → content displays correctly
- [ ] Copy transcript / Copy session content → clipboard has expected text

## Crash recovery

- [ ] Start a session, let it run past 20 segments (crash-safe count-based flush) OR wait for the 2-min timer, then kill the app process (not graceful close)
- [ ] Relaunch — recovery dialog appears (orphaned `_recording.md` detected)
- [ ] Click **Recover** — a new session `.md` is saved with the recovered content, temp file is removed, dialog closes
- [ ] Repeat crash, this time click **Discard** — temp file removed, no new session file created, dialog closes
- [ ] Normal graceful stop (no crash) → next launch shows NO recovery dialog

## Copy / Export

- [ ] Overlay: Export button (.md) while a session is active — file appears in transcripts folder with per-entry timestamps
- [ ] Overlay: Export button (.txt) — plain text, no markdown syntax, still has per-entry timestamps
- [ ] Sessions view: open a past session, Export .md and .txt — both produce a file; content matches what's displayed

## AI summary persistence

- [ ] Open a session with no summary yet → click **Summary** → summary appears, saved into the session's `.md` file under `## AI Summary` (verify by reopening the file or re-opening the session in-app)
- [ ] Reopen that same session → summary shows immediately (no need to regenerate), button now says **Regenerate**
- [ ] Click **Regenerate** → old summary section is replaced (not duplicated) with a fresh one
- [ ] With no AI endpoint/key/model configured in Settings → Summary button is disabled with an explanatory tooltip
- [ ] A very long session (4h+, or synthetically padded) summarizes without an API context-length error (chunking kicks in)

## Transcript Q&A

- [ ] Open a saved session, ask a question about its content in the Q&A panel → answer references actual transcript content
- [ ] With no AI endpoint configured → hint text shown, ask button/input disabled (no crash, no silent no-op)
- [ ] Ask multiple questions in one visit → each answered independently; leaving and reopening the session clears the chat (no history persistence beyond the session file)

## Long-session scroll behavior

- [ ] While actively streaming new segments, scroll up to read older content — new segments must NOT yank the view back to the bottom
- [ ] Scroll back down near the bottom — auto-scroll resumes on the next new segment

## Rendering performance (Phase 5 — keyed card renderer)

- [ ] Change font size mid-stream (while segments are actively arriving) — no visual glitch, no dropped/duplicated cards
- [ ] Clear session mid-stream (Clear button while actively streaming) — display clears immediately, next segment renders a fresh card, no leftover stale card
- [ ] DevTools "Paint flashing" enabled: only the card(s) that actually changed repaint per update — the rest of the transcript region does not flash
- [ ] DevTools Performance recording during rapid provisional updates (fast speech): no main-thread long tasks ≥50ms attributable to rendering
- [ ] Real ~30 minute run: heap size (DevTools Memory/Performance) stays roughly flat, not climbing unbounded

---

## Run Log

| Date | Build/Version | Run by | Result | Notes |
|------|---------------|--------|--------|-------|
| _(pending)_ | | | | First run not yet performed — awaiting human execution per phase gate. |
