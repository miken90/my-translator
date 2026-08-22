# Code Review: Fix Full Transcript Save & Copy

**Reviewer:** code-reviewer (Assumption Destroyer)
**Date:** 2026-04-06
**Files:** `src/js/ui.js`, `src/js/app.js`
**Scope:** 4 changes across 2 files — copy from full session, preserve sessionLog on clear

---

## Finding 1: sessionLog leaks across sessions (start -> stop -> start)

- **Severity:** Critical
- **Location:** `src/js/ui.js`, `showPlaceholder()` line 149; `src/js/app.js`, `start()` line 994
- **Flaw:** `showPlaceholder()` no longer clears `sessionLog`. But `showPlaceholder()` is NOT called in the normal `start()` path. The `start()` method at line 994 checks `if (!this.transcriptUI.hasContent())` -- if there IS content (e.g., transcript from previous session still visible), it calls `clearProvisional()` instead of `showPlaceholder()`. Even if `showPlaceholder()` IS called, it no longer clears `sessionLog`. The only place `clearSession()` is called is in `stop()` at line 1357. So the sessionLog IS cleared between sessions by `stop()`. **However**: if `stop()` is called but `hasSessionContent()` returns false (empty session -- user started and immediately stopped), `clearSession()` is never called. Then the NEXT session's `sessionLog` starts clean because it was already empty. This path is actually safe.

  **But consider this flow:** User starts session -> records data -> `stop()` is called -> `_saveTranscriptFile()` throws (line 1408, `save_transcript` invoke fails) -> `clearSession()` is still called at line 1357 because it's not inside the try/catch of `_saveTranscriptFile`. Wait -- re-reading: `_saveTranscriptFile` has its own try/catch (line 1404-1411) that swallows the error. So `clearSession()` at line 1357 always runs. **The save failure path silently clears session data that was never persisted.** Data loss on save failure.

- **Failure scenario:** User records a 30-minute translation session. Rust backend `save_transcript` fails (disk full, permissions error, path issue). `_saveTranscriptFile` catches error, shows toast "Failed to save transcript". Execution continues to line 1357: `this.transcriptUI.clearSession()`. All 30 minutes of session data is destroyed. User cannot retry save. Gone forever.
- **Evidence:** Lines 1354-1358 in app.js:
  ```js
  if (this.transcriptUI.hasSessionContent()) {
      await this._saveTranscriptFile();    // has internal try/catch, swallows error
      this.transcriptUI.clearSession();    // runs unconditionally after save attempt
  }
  ```
- **Suggested fix:** `clearSession()` must only be called after confirmed successful save. Move it inside `_saveTranscriptFile` after the successful invoke, or have `_saveTranscriptFile` return a boolean indicating success.

---

## Finding 2: recordingStartTime is never reset -- duration accumulates across sessions

- **Severity:** Critical
- **Location:** `src/js/app.js`, `start()` line 977; `stop()` lines 1360-1362; `_saveTranscriptFile()` line 1384
- **Flaw:** `recordingStartTime` is set in `start()` with `if (!this.recordingStartTime) this.recordingStartTime = Date.now()`. It is never reset anywhere. `stop()` resets `sessionStartTime` at line 1361 but NOT `recordingStartTime`. The Clear button handler previously reset it (`this.recordingStartTime = null`) but that line was removed in this change. The constructor sets it to `null` at line 28, and the guard `if (!this.recordingStartTime)` prevents re-setting it on subsequent `start()` calls.
- **Failure scenario:** User starts session 1 at 10:00 AM, stops at 10:05 AM (saved with correct 5m duration). User starts session 2 at 10:10 AM -- `recordingStartTime` is still the 10:00 AM value from session 1. Stops at 10:15 AM. `_saveTranscriptFile` computes `durationMs = Date.now() - startMs` = 15 minutes instead of the correct 5 minutes. Every subsequent session reports increasingly wrong durations. After 8 hours of use, the last 5-minute session would show "8h 0m".
- **Evidence:** `stop()` at line 1361 resets `sessionStartTime = null` but not `recordingStartTime`. `start()` at line 977: `if (!this.recordingStartTime) this.recordingStartTime = Date.now()` -- the guard prevents reset on second session.
- **Suggested fix:** Add `this.recordingStartTime = null;` to `stop()` alongside the `sessionStartTime = null` reset at line 1361.

---

## Finding 3: _cleanupStaleOriginals removes from segments but orphans entries in sessionLog

- **Severity:** High
- **Location:** `src/js/ui.js`, `_cleanupStaleOriginals()` line 524; `addOriginal()` line 72
- **Flaw:** When `addOriginal()` is called, a copy is pushed to both `segments[]` and `sessionLog[]`. Then `_cleanupStaleOriginals()` is called, which filters `segments[]` to remove entries older than 10s or exceeding MAX_PENDING. But it never touches `sessionLog[]`. Those stale originals (which never received a translation) remain permanently in `sessionLog` with `status: 'original'` and `translation: null`.
- **Failure scenario:** User speaks rapidly for 2 minutes. Many originals arrive faster than translations. Stale originals are cleaned from display buffer but accumulate in sessionLog. When `getFullPlainText()` is called for copy, or `getFullSessionText()` for save, these orphaned entries appear as original-only lines with no translation. The saved transcript contains dozens of duplicate/stale original lines interspersed with the real translated pairs, producing a confusing document.
- **Evidence:** `_cleanupStaleOriginals` operates only on `this.segments` (line 530). `sessionLog` is a separate array that receives all entries at line 72 but is never cleaned.
- **Suggested fix:** Either mirror the stale cleanup to sessionLog (using `createdAt` matching), or accept the trade-off and document it. If the goal is "never lose data," then this is by-design but the output quality degrades.

---

## Finding 4: _trimSegments removes from display buffer, breaking addTranslation matching

- **Severity:** High
- **Location:** `src/js/ui.js`, `_trimSegments()` line 508; `addTranslation()` line 91
- **Flaw:** This is a pre-existing issue, but the change makes it worse by relying on `sessionLog` as the authoritative record. `_trimSegments()` removes oldest segments from `segments[]` via `shift()`. When a delayed translation arrives, `addTranslation()` looks for `seg = this.segments.find(s => s.status === 'original')`. If that segment was already trimmed from `segments[]`, the find returns `undefined`. The code falls through to the `else` branch (line 103) and creates a brand new segment with `original: ''` in both `segments` and `sessionLog`. Meanwhile, the corresponding sessionLog entry (the one pushed by `addOriginal`) retains `status: 'original'` and `translation: null` forever -- the `createdAt` matching at line 96-98 will never fire because the segment is gone from `segments[]`.
- **Failure scenario:** Long session with lots of text. Display buffer trims old segments. Translation arrives 2s later for a trimmed segment. Result: sessionLog now has TWO entries -- the original (with no translation) and a new entry (with translation but empty original). Saved transcript shows both, doubling content and losing the original<->translation pairing.
- **Evidence:** `addTranslation()` line 91 searches `this.segments`, not `this.sessionLog`. Line 96 mirrors to sessionLog using `seg.createdAt`, but if `seg` came from the `else` branch, the mirror creates a new sessionLog entry rather than updating the orphan.
- **Suggested fix:** `addTranslation()` should also search `sessionLog` directly (by status/createdAt) to update the canonical record, independent of whether the segment still exists in the display buffer.

---

## Finding 5: Source switch (stop -> start) triggers save + clear mid-session

- **Severity:** High
- **Location:** `src/js/app.js`, `_setSource()` line 916
- **Flaw:** When switching audio source while recording, `_setSource` calls `this.stop().then(() => { ... this.start(); })`. `stop()` at line 1355-1357 saves the transcript and calls `clearSession()`. Then `start()` begins a new session. The user perceives this as a seamless source switch, but it silently splits their session into two files and loses the continuity.
- **Failure scenario:** User is in a 20-minute meeting, switches from System to Mic audio at minute 10. The first 10 minutes are saved as one file and sessionLog is cleared. The remaining 10 minutes become a separate session file. User expects one continuous transcript but gets two files with no indication of the split.
- **Evidence:** `_setSource` line 916: `this.stop().then(...)`. `stop()` unconditionally saves and clears session.
- **Suggested fix:** Either skip the save/clear in `stop()` when called from source switch (add a parameter like `{skipSave: true}`), or document this as expected behavior. The user-facing toast says "Switched to System Audio" but doesn't mention the transcript split.

---

## Finding 6: getFullPlainText excludes provisional text, getPlainText includes it

- **Severity:** Medium
- **Location:** `src/js/ui.js`, `getFullPlainText()` line 238 vs `getPlainText()` line 224
- **Flaw:** The old `getPlainText()` at line 232 includes `this.provisionalText` (text currently being recognized). The new `getFullPlainText()` does not include provisional text. If the user clicks Copy while speech is being recognized, the in-progress text is silently dropped from the clipboard content.
- **Failure scenario:** User is actively recording and clicks Copy. They see provisional text on screen (the "Listening..." segment being recognized). The copied text does not include it. User pastes into a document and notices the last visible segment is missing.
- **Evidence:** `getPlainText()` line 232: `if (this.provisionalText) lines.push(this.provisionalText);`. `getFullPlainText()` line 238-245: no provisional text handling.
- **Suggested fix:** Add provisional text to `getFullPlainText()` or document the omission. The old behavior included it; the new behavior silently drops it. This is a regression in copy behavior.

---

## Finding 7: getFormattedContent still reads from segments (display buffer), not sessionLog

- **Severity:** Medium
- **Location:** `src/js/ui.js`, `getFormattedContent()` line 251
- **Flaw:** `getFormattedContent()` still iterates over `this.segments` (line 269) and checks `this.segments.length` (line 252). This method was not updated to use `sessionLog`. While the change description says `_saveTranscriptFile` now uses `getFullSessionText`, if any other caller uses `getFormattedContent`, they still get trimmed data.
- **Failure scenario:** If `getFormattedContent` is called by any future feature (export, share, etc.), it will produce truncated output from the display buffer. The method's docstring says "Get formatted content for saving to file" which is misleading -- it no longer serves that purpose but still exists.
- **Evidence:** `getFormattedContent` at line 269: `for (const seg of this.segments)`. Meanwhile `getFullSessionText` at line 318: `for (const seg of this.sessionLog)`.
- **Suggested fix:** Either deprecate/remove `getFormattedContent` (dead code), or update it to use `sessionLog`. Having two methods that look identical except for the data source is a bug waiting to happen.

---

## Finding 8: Error paths call showPlaceholder but not clearSession, leaking stale data into next session

- **Severity:** Medium
- **Location:** `src/js/app.js`, Start/Stop error handler line 210-211; local mode permission error line 1076-1077
- **Flaw:** When `start()` fails (lines 204-214), the error handler calls `this.transcriptUI.clear()` then `this.transcriptUI.showPlaceholder()`. Neither calls `clearSession()`. If the user had a previous session's data still in `sessionLog` (because `stop()` failed to save or was never called), that stale data persists. On the next successful `start() -> stop()` cycle, the stale data from the failed session merges with the new session's data in the auto-save.

  Similarly at line 1076-1077 in `_startLocalMode`, audio permission failure clears display and shows placeholder but does not clear sessionLog.

- **Failure scenario:** Session 1 records 5 segments. Network error during session -- `start()` catches error at line 204, clears display, shows placeholder. `stop()` was never called so `clearSession()` never ran. Session 1's 5 segments remain in `sessionLog`. User starts session 2. Session 2's segments are APPENDED to sessionLog. `stop()` saves all data (session 1 + session 2) as one file. Session 1's data may have already been saved by a previous `stop()` call, causing duplication.
- **Evidence:** Error handler at lines 210-211 calls `clear()` and `showPlaceholder()` but not `clearSession()` or `stop()`.
- **Suggested fix:** Error paths that abort a session should call `stop()` (which handles save + clearSession), or explicitly call `clearSession()` if the data should be discarded.

---

## Summary

| # | Finding | Severity | Type |
|---|---------|----------|------|
| 1 | Save failure silently destroys session data | Critical | Data loss |
| 2 | recordingStartTime never reset -- duration grows forever | Critical | State leak |
| 3 | Stale originals orphaned in sessionLog | High | Data quality |
| 4 | Trimmed segments cause duplicate/orphan entries in sessionLog | High | Data integrity |
| 5 | Source switch triggers silent session split | High | UX / data split |
| 6 | getFullPlainText drops provisional text (regression) | Medium | Behavior change |
| 7 | getFormattedContent is now dead/misleading code | Medium | Maintainability |
| 8 | Error paths leak stale sessionLog into next session | Medium | State leak |

**Blocking issues:** Findings 1 and 2 must be fixed before merge. Finding 1 causes irreversible data loss on save failure. Finding 2 causes every session after the first to report wrong duration metadata.

**Status:** DONE
**Summary:** 8 findings identified -- 2 critical (data loss on save failure, duration state leak), 3 high (orphaned entries, session splitting), 3 medium (regressions, dead code, error path state leaks).
**Concerns:** Findings 1 and 2 are blocking.
