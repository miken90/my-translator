# Plan Review: Unified Card Layout + Translation Speed

**Reviewer:** code-reviewer (Security Adversary perspective)
**Date:** 2026-04-06
**Plan:** `plans/260406-card-layout-speed/`
**Verdict:** 6 findings -- 1 Critical, 2 High, 3 Medium

---

## Finding 1: `_trimSegments()` breaks card speaker/language headers after trimming

- **Severity:** Critical
- **Location:** Phase 1, Step 1 (`_renderCards()` implementation)
- **Flaw:** The new `_renderCards()` uses `lastRenderedSpeaker` / `lastRenderedLang` tracking to conditionally show speaker headers -- a header is only emitted when the speaker *changes* from the previous segment. But `_render()` calls `_trimSegments()` before rendering, which shifts off segments from the front of the array. After trimming, the *first remaining segment* may have a speaker identical to a trimmed segment, so the renderer skips the header entirely. Users see cards with no speaker attribution at the top of the visible transcript.
- **Failure scenario:** Long session with Speaker 1 producing 20+ segments. `_trimSegments` removes the first 15. The 16th segment (now first) has `speaker: "1"`, but since `lastRenderedSpeaker` starts as `null`, the header IS shown in this case -- wait, actually `null !== "1"` is true so the header shows. Let me re-examine... The actual problem is subtler: if the first remaining segment after trim has the same speaker as the *second* remaining segment, the second one correctly skips. That works. However, the real breakage happens when segments are trimmed such that a language change boundary is removed. Consider: segments [A(en), B(en), C(ja), D(ja), E(ja)]. Trim removes A,B,C. Now D is first, shows `JA` badge. Then E skips badge. But the user lost the fact that there was an `EN -> JA` transition. More critically, the timestamp shown on the header of the first visible card after trim is for a segment that appeared potentially minutes ago, yet is now presented as the "starting" context.
- **Evidence:** `_trimSegments()` in ui.js (line 509-518) runs before every render. `_renderCards()` iterates `this.segments` starting from index 0 after trim.
- **Suggested fix:** The plan should either (a) store `lastRenderedSpeaker`/`lastRenderedLang` as instance state that persists across trims, or (b) always show the header on the first visible card regardless of whether the speaker matches the "previous" (now-trimmed) segment. Option (b) is simpler and more correct: `const showSpeaker = seg.speaker && (i === 0 || seg.speaker !== lastRenderedSpeaker)` where `i` is the loop index.

---

## Finding 2: `_cleanupStaleOriginals` + lower endpoint delay = dropped segments under load

- **Severity:** High
- **Location:** Phase 2, interaction with Phase 1 (cross-phase dependency not analyzed in plan)
- **Flaw:** `_cleanupStaleOriginals()` drops original segments older than 10s (`STALE_MS = 10000`) and caps pending originals at 3 (`MAX_PENDING = 3`). Phase 2 lowers endpoint delay from 3000ms to 1500ms, which means Soniox finalizes segments ~2x as frequently. In fast multi-speaker conversation, the translation API may not keep up with the doubled rate of originals. The `MAX_PENDING = 3` cap was tuned for 3s endpoint delay (so ~9s of backlog). At 1500ms, 3 pending segments represent only ~4.5s of speech. If translation latency spikes (network, API throttle), originals are silently dropped from `segments[]` but remain in `sessionLog[]`, causing a visible desync: saved transcript has content that was never shown on screen.
- **Evidence:** Phase 2 `plan.md` says "Combined with Phase 1's 'show original immediately' card layout, users perceive translation ~1.5s faster." But the plan does not analyze the interaction with `_cleanupStaleOriginals`. The Risk section only mentions "split sentences mid-thought for slow speakers."
- **Suggested fix:** Add a step in Phase 2 to evaluate whether `MAX_PENDING` and `STALE_MS` constants need adjustment. At minimum, raise `MAX_PENDING` to 5 to match the increased finalization rate.

---

## Finding 3: Full innerHTML replacement on every render causes DOM thrashing and loses scroll accuracy

- **Severity:** High
- **Location:** Phase 1, Step 1 (`_renderCards()` line `this.contentEl.innerHTML = html`)
- **Flaw:** Every call to `_render()` (triggered by `addOriginal`, `addTranslation`, `setProvisional`, `clearProvisional`, `configure`) rebuilds the entire card list as an HTML string and assigns it via `innerHTML`. During active translation, this fires multiple times per second. Each assignment destroys and recreates all DOM nodes, which: (a) causes visual flicker on complex layouts with cards, headers, badges, timestamps; (b) resets any browser text selection the user might have; (c) `_smartScroll` checks `scrollHeight` immediately after `innerHTML` assignment, but the browser may not have completed layout yet, making the near-bottom detection unreliable.
- **Evidence:** Plan Step 1 code: `this.contentEl.innerHTML = html;` followed by `this._smartScroll(...)`. The existing single-mode renderer has the same pattern, but the new card layout is significantly more DOM-heavy per segment (wrapper div + header div + speaker span + lang span + time span + original div + translation div = ~7 nodes per card vs ~2-3 nodes per segment in single mode).
- **Suggested fix:** The plan should acknowledge this as a known limitation and add a future-improvement note, OR implement incremental rendering where only the last card is appended/updated and translated cards are updated in-place. At minimum, document that `_smartScroll` should use `requestAnimationFrame` to defer scroll measurement.

---

## Finding 4: `_formatTime()` uses locale-dependent formatting without fixed locale

- **Severity:** Medium
- **Location:** Phase 1, Step 2 (`_formatTime()` helper)
- **Flaw:** `d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })` uses the system locale. On some Windows locales, this produces unexpected formats (e.g., 24h vs 12h with AM/PM, period separators instead of colons in certain Asian locales). The empty array `[]` is not the same as `undefined` -- in some engines it means "use default locale" but the behavior is implementation-defined. More critically, if `seg.createdAt` is `undefined` (older code paths or edge cases where `createdAt` was not set), `new Date(undefined)` returns `Invalid Date`, and `toLocaleTimeString()` returns the string `"Invalid Date"` which renders visibly in the card header.
- **Evidence:** Plan code: `_formatTime(timestamp) { if (!timestamp) return ''; const d = new Date(timestamp); return d.toLocaleTimeString([], ...); }`. The guard `if (!timestamp)` catches `null`, `undefined`, `0`, and `""`, but `createdAt` is set to `Date.now()` which returns a number -- so `0` would be caught but any truthy invalid value would not.
- **Suggested fix:** Add `if (isNaN(d.getTime())) return '';` after the `new Date()` call. Consider using a fixed format string or explicit locale like `'en-GB'` for consistency.

---

## Finding 5: Plan does not address `getPlainText()` / `getFormattedContent()` output format change

- **Severity:** Medium
- **Location:** Phase 1, missing from implementation steps and todo list
- **Flaw:** The plan removes dual-view rendering but does not update `getPlainText()`, `getFullPlainText()`, `getFormattedContent()`, or `getFullSessionText()`. These methods iterate segments and output `original` then `translation` per segment. In the old single-mode, `original` segments were skipped during rendering (line 410: "Skip 'original' segments in single mode -- wait for translation"), so the copy/save output could include original text that was never shown on screen. The new card layout makes originals always visible, which is consistent -- but the plan doesn't verify or document this alignment. More importantly, if the plan's card layout shows "..." for pending translations, but `getPlainText()` outputs `null` translations as empty, the copy output diverges from what the user sees.
- **Evidence:** `getPlainText()` at ui.js line 224-233: `if (seg.translation) lines.push(seg.translation)` -- for pending segments with `translation: null`, this line is skipped, so copied text shows original without the "..." placeholder. This is arguably correct but the plan should explicitly state whether this is intended behavior.
- **Suggested fix:** Add a step to Phase 1 reviewing the copy/save output methods to confirm they produce expected results under the new card layout. Document the intended copy behavior for pending segments.

---

## Finding 6: No fallback or error handling for missing `createdAt` on legacy segments

- **Severity:** Medium
- **Location:** Phase 1, Step 1 (`_renderCards()` -- timestamp rendering)
- **Flaw:** The card layout renders `this._formatTime(seg.createdAt)` for every segment header. The `createdAt` field was added in the `addOriginal()` method, but `addTranslation()` for orphan translations (the `else` branch at ui.js line 104-113) sets `createdAt: Date.now()` -- this is the translation arrival time, not the original speech time. Additionally, if the app is updated mid-session (e.g., dev reload), any segments already in memory that were created before `createdAt` was added would have `undefined`. The plan does not address backward compatibility with segment objects that lack `createdAt`.
- **Evidence:** Plan's `_renderCards()` code: `const time = this._formatTime(seg.createdAt);` is called unconditionally. The `_formatTime` guard handles falsy values but the plan doesn't discuss what happens visually when some cards have timestamps and others don't (inconsistent UI).
- **Suggested fix:** Either always show timestamps (defaulting to empty string gracefully, which `_formatTime` already does for falsy) and document this as acceptable, or only show the timestamp span when a valid time exists: `if (time) headerHtml += \`<span class="seg-time">${time}</span>\`;`.

---

## Summary

The plan is functionally sound for the happy path but has two significant gaps:

1. **Cross-phase interaction analysis is missing.** Phase 2's endpoint delay change directly affects Phase 1's segment cleanup behavior, but neither phase references the other's impact on shared state (`segments[]`, `_cleanupStaleOriginals`).

2. **The rendering approach carries forward existing technical debt** (full innerHTML rebuild) into a layout that is 2-3x more DOM-heavy per segment, without acknowledging the performance implications.

The Critical finding (Finding 1 -- speaker header loss after trim) will produce visibly incorrect output in any session longer than ~8-10 segments and should be addressed before implementation.
