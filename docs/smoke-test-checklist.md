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

## Toolbar and Settings (Phase 2)

- [ ] Fresh launch — toolbar shows five visual groups separated by thin
      dividers: app, transport, status, transcript, window
- [ ] Click Start — status text turns "Connecting…" (amber) then "Listening"
      (green); an elapsed timer ("0:0X") ticks up beside it every second.
      Click Stop — elapsed clears, status returns to muted "Ready"
- [ ] Copy / Export / Sessions icons sit grouped tight; Clear (trash) sits
      after a visible gap; hovering Clear turns it red
- [ ] Settings ▸ Display — an "Export Format" dropdown, full width, arrow
      visible and not covering the text
- [ ] Sessions view — a folder icon sits beside the "Sessions" title;
      clicking it opens the transcripts folder
- [ ] Dragging the window works from bar gaps, dividers, and the status area;
      clicking any icon button activates it and does not drag

## Window sizing and small fixes (Phase 5)

- [ ] Settings ▸ About — version reads the app's actual running version
      (matches `package.json`), never blank/`undefined`/a stale number
- [ ] Fresh launch — the window opens wide enough that the whole toolbar is
      visible, close button included, and the status area shows the dot and
      "Ready" label without touching the icons to its right
- [ ] While recording, drag the window as narrow as it will go — the elapsed
      timer truncates or disappears; it never paints on top of the icons to
      its right
- [ ] At the narrowest width the window allows, compact/pin/minimize/close
      are fully visible and clickable; the window refuses to go narrower
- [ ] At default width, hover the Start button — the blue glow around it
      renders fully, not clipped
- [ ] Sessions ▸ open a session — the export-format dropdown beside Copy is
      compact, shows ".md"/".txt" legibly with a visible arrow
- [ ] In that viewer, the top-left button is a **×** (closes Sessions, back
      to the overlay) and the one below it is a **←** (back to the session
      list) — each does what its icon says
- [ ] Close the app with the × button and relaunch — session still saves on
      close, app starts cleanly. Minimize with the button and with Ctrl+M —
      both still minimize

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

- [ ] Settings ▸ Display ▸ Export Format = .md, Save & Close, then Overlay Export while a session is active — file appears in transcripts folder with per-entry timestamps, `.md` extension
- [ ] Settings ▸ Display ▸ Export Format = .txt, Save & Close, Overlay Export again — plain text, no markdown syntax, still has per-entry timestamps, `.txt` extension
- [ ] Fully quit and relaunch the app — the Export Format choice from Settings is still applied (disk persistence, not just the in-memory cache)
- [ ] Sessions view: open a past session, use the format dropdown beside Copy (.md/.txt) and Export — both produce a file; content matches what's displayed

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
