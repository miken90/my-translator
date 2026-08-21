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

- [ ] Start a session, let it run long enough for at least one auto-save flush (~2 min, or ≥20 segments), then kill the app process (not graceful close)
- [ ] Relaunch — expect the transcript recovers up to the last flushed segment (temp file `_recording.md`), not a full loss

## Long-session scroll behavior

- [ ] While actively streaming new segments, scroll up to read older content — new segments must NOT yank the view back to the bottom
- [ ] Scroll back down near the bottom — auto-scroll resumes on the next new segment

---

## Run Log

| Date | Build/Version | Run by | Result | Notes |
|------|---------------|--------|--------|-------|
| _(pending)_ | | | | First run not yet performed — awaiting human execution per phase gate. |
