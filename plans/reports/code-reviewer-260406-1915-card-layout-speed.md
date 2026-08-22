# Code Review: Card Layout + Endpoint Delay Changes

**Date:** 2026-04-06  
**Files:** `src/js/ui.js`, `src/js/app.js`, `src/index.html`, `src/styles/main.css`  
**LOC delta:** -371 net (194 added, 565 removed)

## Overall Assessment

Clean refactor. Dual-view rendering removed, replaced with card layout. Dead references cleaned up well. Two correctness issues found (one medium, one low).

## Critical Issues

None.

## High Priority

None.

## Medium Priority

### 1. Dead `show_original` default in settings.js

`src/js/settings.js:16` still has `show_original: true` in `DEFAULT_SETTINGS`. This property is no longer read or written anywhere in app.js or ui.js. Not a runtime bug (it's harmless extra data), but it will persist into every new user's settings file forever.

**Fix:** Remove `show_original: true` from `DEFAULT_SETTINGS` in `src/js/settings.js`.

### 2. Dead code: `getPlainText()` and `getFormattedContent()`

- `getPlainText()` (ui.js:216) -- no callers. Copy button now uses `getFullPlainText()`.
- `getFormattedContent()` (ui.js:244) -- no callers. Save uses `getFullSessionText()`.

Both are dead weight. Not a bug, but increases maintenance surface.

**Fix:** Remove both methods.

## Low Priority

### 3. Unused CSS class `seg-pending` on card wrapper

`ui.js:405` applies `seg-card seg-pending` to pending-translation cards, but no `.seg-pending` CSS rule exists. The inner `<div class="seg-translation pending">` IS styled (line 578). The outer `seg-pending` class does nothing.

**Fix:** Either remove `seg-pending` from the JS, or add a CSS rule if visual differentiation of the card wrapper is desired (e.g., slightly different background).

### 4. Unawaited `settingsManager.save(s)` in migration (app.js:552)

Fire-and-forget async call. Acceptable here: if save fails, migration retries on next app launch (condition `s.endpoint_delay === 3000` will still match). No data loss risk. Mentioning for awareness only.

## Verification Results

### Dead reference scan -- all clean:
| Removed identifier | Remaining references | Status |
|---|---|---|
| `btn-view-mode` | 0 | Clean |
| `check-show-original` | 0 | Clean |
| `viewMode` | 0 | Clean |
| `_renderSingle` | 0 | Clean |
| `_renderDual` | 0 | Clean |
| `_getScrollState` | 0 | Clean |
| `.seg-block` | 0 | Clean |
| `.dual-view` | 0 | Clean |
| `.seg-translated` | 0 | Clean |
| `showOriginal` | 0 | Clean |
| `_toggleViewMode` | 0 | Clean |
| `show_original` | 1 (settings.js default) | **Stale** |

### `_smartScroll()` target
Uses `this.container.parentElement || this.container` -- unchanged. Card layout renders inside `.transcript-flow` child of container. Scroll target is the overlay container, which is correct.

### CSS class consistency
- JS uses `.seg-translation` -- matches CSS `.seg-card .seg-translation`. Correct.
- Old `.seg-translated` completely removed. Correct.

### innerHTML/XSS
All user text goes through `_esc()` (DOM-based textContent escaping). No raw interpolation. Safe.

### Error handler session cleanup
Both error paths (start/stop toggle at line 205, permission check at line 1072) now call `clearSession()` before `clear()` + `showPlaceholder()`. Matches the documented pattern in CLAUDE.md.

### Save-then-clear correctness
`stop()` now conditionally clears: `if (saved) this.transcriptUI.clearSession()`. If save fails, session data is preserved. This is an improvement over the prior unconditional clear.

## Positive Observations

- Net deletion of 371 lines -- good simplification
- `_saveTranscriptFile` now returns boolean, enabling conditional `clearSession()` -- prevents data loss on save failure
- Card layout produces cleaner DOM (single render path vs two)
- Migration is idempotent and safe (re-runs if save fails)
- `recordingStartTime` reset moved from clear button to stop -- correct, clearing display shouldn't affect duration tracking

## Recommended Actions

1. **Remove `show_original: true` from `DEFAULT_SETTINGS`** in settings.js
2. **Remove dead methods** `getPlainText()` and `getFormattedContent()` from ui.js
3. Optional: remove `seg-pending` class from JS or add CSS rule for it

**Status:** DONE  
**Summary:** Clean refactor, no critical or high issues. One stale default in settings.js and two dead methods to clean up.
