# Security Adversary Review: Transcript Save & Copy Fix

**Date:** 2026-04-06
**Scope:** `src/js/ui.js` (TranscriptUI), `src/js/app.js` (App controller), `src-tauri/src/commands/transcript.rs`
**Perspective:** Hostile security reviewer / attacker mindset

---

## Finding 1: recordingStartTime never reset — duration leak across sessions

- **Severity:** High
- **Location:** `src/js/app.js`, `stop()` method (line ~1360) and `_saveTranscriptFile()` (line 1384)
- **Flaw:** `recordingStartTime` is set in `start()` (line 977: `if (!this.recordingStartTime) this.recordingStartTime = Date.now()`) but **never reset to null** in `stop()`. The old code had `this.recordingStartTime = null` in the clear button handler; that line was removed in this change. `stop()` resets `sessionStartTime` but not `recordingStartTime`.
- **Failure scenario:** User records session 1 (5 minutes), stops. Starts session 2 (2 minutes), stops. `_saveTranscriptFile()` computes `durationMs = Date.now() - startMs` where `startMs` is still from session 1. Session 2's saved transcript shows "7m" instead of "2m". Every subsequent session accumulates the error further.
- **Evidence:** Line 977: `if (!this.recordingStartTime) this.recordingStartTime = Date.now();` — the guard prevents overwrite. Line 1361: only `this.sessionStartTime = null` is reset, `recordingStartTime` is absent. The removed clear-button line `this.recordingStartTime = null` was the only reset path.
- **Suggested fix:** Add `this.recordingStartTime = null;` to `stop()` immediately after `this.sessionStartTime = null;` (line 1361).

## Finding 2: Unbounded sessionLog growth — memory exhaustion DoS

- **Severity:** High
- **Location:** `src/js/ui.js`, `sessionLog` array (line 24), `addOriginal()` (line 72), `addTranslation()` (line 112)
- **Flaw:** `sessionLog` is explicitly described as "never trimmed." In a long-running translation session (hours of continuous speech in a meeting), this array grows without bound. Each entry stores original text, translation, metadata — roughly 200-500 bytes per segment. A fast speaker producing one segment per 2-3 seconds generates ~1200-1800 entries/hour.
- **Failure scenario:** User runs translator during a 4-hour meeting without stopping. sessionLog accumulates ~5000-7000 entries. On `getFullPlainText()` (copy) or `getFullSessionText()` (save), building a single massive string hits memory pressure in the Tauri WebView process. On low-memory machines, the tab/app becomes unresponsive or crashes. The clipboard write for a multi-MB string can also fail silently.
- **Evidence:** `sessionLog` has no length cap, no periodic flush mechanism, no chunked save. `segments[]` has `_trimSegments()` but sessionLog intentionally bypasses it.
- **Suggested fix:** Either (a) implement periodic auto-flush of sessionLog to disk (append mode) and keep only a tail in memory, or (b) add a hard cap (e.g., 10,000 entries) with oldest-drop and a warning toast. At minimum, document the expected session length limits.

## Finding 3: _cleanupStaleOriginals removes from segments but orphans sessionLog entries

- **Severity:** High
- **Location:** `src/js/ui.js`, `_cleanupStaleOriginals()` (lines 524-543), `addTranslation()` (lines 90-113)
- **Flaw:** `_cleanupStaleOriginals()` filters out stale `original`-status segments from `this.segments`, but **does not touch `sessionLog`**. Those orphaned sessionLog entries remain with `status: 'original'` and `translation: null` permanently. When `addTranslation()` later runs, it searches sessionLog for `s => s.status === 'original' && s.createdAt === seg.createdAt` — but the corresponding segment was already removed from `this.segments`, so `seg` refers to a *different* segment. The translation gets applied to the wrong sessionLog entry.
- **Failure scenario:** Fast speech produces originals faster than translations arrive. Stale originals are cleaned from `segments[]` after 10s. When the translation finally arrives, it matches a different `segments[]` entry (same createdAt timestamp is unlikely but possible on rapid fire), or falls through to the else branch creating a duplicate. Meanwhile, the sessionLog contains ghost entries with original text but no translation, corrupting the saved/copied transcript.
- **Evidence:** `_cleanupStaleOriginals` at line 530: `this.segments = this.segments.filter(...)` — no parallel filter on `this.sessionLog`. `addTranslation` at line 96-97 finds by `createdAt` match, but the segments array and sessionLog are no longer synchronized after cleanup.
- **Suggested fix:** When `_cleanupStaleOriginals` removes a segment, also mark the corresponding sessionLog entry as `status: 'stale'` or `'dropped'`, so `addTranslation()` does not accidentally match it and the save output can note the gap.

## Finding 4: createdAt collision in addTranslation matching — wrong translation applied

- **Severity:** Medium
- **Location:** `src/js/ui.js`, `addTranslation()` (lines 96-98)
- **Flaw:** The sessionLog-to-segments correlation uses `s.createdAt === seg.createdAt` with `Date.now()` as the key. `Date.now()` has millisecond resolution but on fast machines, two `addOriginal()` calls in the same millisecond produce identical `createdAt` values. `sessionLog.find()` returns the **first** match, so translation is applied to the wrong entry.
- **Failure scenario:** In two-way (both) mode with two speakers talking simultaneously, two originals land in the same millisecond. The first translation received is applied to speaker A's sessionLog entry when it should go to speaker B's. The saved transcript attributes speech to the wrong speaker.
- **Evidence:** Line 68: `createdAt: Date.now()`. Line 96-97: `.find(s => s.status === 'original' && s.createdAt === seg.createdAt)` — first match wins. No secondary discriminator (text content, speaker, index).
- **Suggested fix:** Use a monotonically incrementing counter (`this.nextSegId++`) as the correlation key instead of timestamps.

## Finding 5: Copy button exposes full session even after user explicitly clears

- **Severity:** Medium
- **Location:** `src/js/app.js`, `btn-copy` handler (line 236-243) + `showPlaceholder()` in `ui.js` (line 149)
- **Flaw:** This is the *intentional behavioral change*, but from a **data privacy** perspective it is a regression. Before the fix, clearing the display also cleared the clipboard source. Now, after user presses Clear, the display shows the placeholder ("Press play to start"), but pressing Copy still dumps the **entire session history** to the system clipboard — text that the user visually confirmed was "gone."
- **Failure scenario:** User translates a sensitive conversation, presses Clear to remove it from the screen (expecting it to be gone), then accidentally presses Copy or another app reads clipboard. The full conversation is now on the clipboard, violating the user's expectation of data deletion. This is particularly problematic in shared-screen scenarios (presentations, screen sharing).
- **Evidence:** `showPlaceholder()` no longer clears `sessionLog` (line 163 comment). `btn-copy` reads `getFullPlainText()` from `sessionLog`. No indication in the UI that data is still in memory after Clear.
- **Suggested fix:** Either (a) show a visual indicator that session data is retained ("Session will be saved on stop"), or (b) make Clear truly clear when recording is stopped (only preserve during active recording), or (c) have Copy fall back to `getPlainText()` when not recording and `getFullPlainText()` when recording.

## Finding 6: getFormattedContent still uses trimmed segments — save-file inconsistency

- **Severity:** Medium
- **Location:** `src/js/ui.js`, `getFormattedContent()` (lines 251-277) vs `getFullSessionText()` (lines 297-326)
- **Flaw:** `getFormattedContent()` still reads from `this.segments` (the trimmed display buffer) and reports `segments: ${this.segments.length}`. While `_saveTranscriptFile()` correctly uses `getFullSessionText()`, any other caller of `getFormattedContent()` will get truncated data. This is a latent inconsistency — the two methods return different results for the same conceptual operation "give me the transcript for saving."
- **Failure scenario:** A future feature or third-party integration calls `getFormattedContent()` assuming it returns the full transcript (reasonable expectation for a "save" method). It silently gets a truncated version. Debugging this would be difficult since the method works correctly for short sessions.
- **Evidence:** `getFormattedContent()` line 269: `for (const seg of this.segments)`. `getFullSessionText()` line 318: `for (const seg of this.sessionLog)`. Both have similar markdown formatting but different data sources.
- **Suggested fix:** Deprecate `getFormattedContent()` or refactor it to delegate to `getFullSessionText()`. If both are needed, rename them unambiguously (e.g., `getDisplaySnapshot()` vs `getFullSessionText()`).

## Finding 7: getFullPlainText excludes provisional text — copy misses in-progress speech

- **Severity:** Medium
- **Location:** `src/js/ui.js`, `getFullPlainText()` (lines 238-245) vs `getPlainText()` (lines 224-233)
- **Flaw:** The old `getPlainText()` appended `this.provisionalText` (line 232: `if (this.provisionalText) lines.push(this.provisionalText)`). The new `getFullPlainText()` does not include provisional text. When the user presses Copy during active recording, the in-progress sentence being recognized is silently dropped.
- **Failure scenario:** User is mid-recording. Someone is speaking and the provisional text shows "I need the report by Friday." User hits Copy to capture everything. The copied text is missing the last sentence that was visibly on screen. User pastes into email/notes and the critical sentence is absent.
- **Evidence:** `getPlainText()` line 232: `if (this.provisionalText) lines.push(this.provisionalText);`. `getFullPlainText()` has no such line.
- **Suggested fix:** Append `this.provisionalText` to `getFullPlainText()` output, matching the behavior of `getPlainText()`.

## Finding 8: save_transcript content injected verbatim — markdown injection into saved files

- **Severity:** Medium
- **Location:** `src-tauri/src/commands/transcript.rs` (line 28), `src/js/ui.js` `getFullSessionText()` (lines 297-326)
- **Flaw:** The YAML frontmatter in `getFullSessionText()` interpolates `metadata.model`, `metadata.sourceLang`, etc. directly into the markdown output without escaping. The Rust `save_transcript` command writes the content string directly to disk via `fs::write`. If any metadata field contains YAML special characters (e.g., a colon, newline, or backtick), the frontmatter becomes malformed. If the user-controlled `original` or `translation` text contains markdown formatting like `[link](javascript:...)`, the saved file becomes a vector for social engineering when opened in a markdown viewer.
- **Failure scenario:** User translates speech containing the literal text "---" or "`code`" or "](http://evil.com)". The saved markdown file, when opened in a viewer (VS Code, Obsidian, etc.), renders the injected content as active markdown — links, code blocks, or broken frontmatter. Not a direct RCE but can be a phishing vector if transcripts are shared.
- **Evidence:** `getFullSessionText()` line 319: `if (seg.original) lines.push('> ' + seg.original);` — blockquote provides some protection for original text but `seg.translation` at line 320 is injected raw. Metadata at lines 309-312 has no YAML escaping.
- **Suggested fix:** Escape YAML special chars in frontmatter values (wrap in quotes). For transcript body, the blockquote prefix on originals is good but translations should also be escaped or prefixed. Given this is a local-only file, severity is medium, not critical.

---

## Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | recordingStartTime never reset — wrong duration on subsequent sessions | High |
| 2 | Unbounded sessionLog growth — potential OOM on long sessions | High |
| 3 | _cleanupStaleOriginals desyncs segments and sessionLog | High |
| 4 | createdAt collision — wrong translation applied to sessionLog entry | Medium |
| 5 | Copy exposes full session after Clear — user privacy expectation violated | Medium |
| 6 | getFormattedContent still uses trimmed segments — latent inconsistency | Medium |
| 7 | getFullPlainText drops provisional text that getPlainText included | Medium |
| 8 | Markdown/YAML injection in saved transcript files | Medium |

**Blocking issues:** Findings 1, 3 must be fixed before merge. Finding 1 is a one-line fix. Finding 3 requires a design decision about how stale entries in sessionLog should be handled.

**Status:** DONE
