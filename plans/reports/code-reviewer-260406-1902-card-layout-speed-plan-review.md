# Plan Review: Unified Card Layout + Translation Speed

**Reviewer:** code-reviewer  
**Date:** 2026-04-06  
**Plan:** `plans/260406-card-layout-speed/`  
**Verdict:** NEEDS REVISION — 2 critical, 2 high, 3 medium findings

---

## Finding 1: `show_original` setting becomes a zombie — saved, loaded, passed, but never applied

- **Severity:** Critical
- **Location:** Phase 1, Step 4 ("Remove viewMode from configure()")
- **Flaw:** The plan removes `viewMode` from `configure()` and the constructor, but never addresses the `showOriginal` parameter. Currently `showOriginal` is destructured in `configure()` (line 36 of ui.js) but already has no effect — it is never stored or used. The new card layout *always* shows original text. Yet `app.js` still: (1) reads `show_original` from settings (line 577), (2) saves it to settings (line 652), (3) passes `showOriginal` to `configure()` (line 721), and (4) renders a "Show original text" checkbox in `index.html` (line 503). The plan does not mention removing any of this.
- **Failure scenario:** After implementation, users see a "Show original text" checkbox in settings that does absolutely nothing. Unchecking it has zero effect because `_renderCards()` unconditionally renders `seg-original`. The setting is saved to disk on every settings change, creating a persisted lie. Users who previously had `show_original: false` will now see original text they explicitly opted out of, with no way to hide it.
- **Evidence:** `app.js:721` passes `showOriginal: settings.show_original !== false` to `configure()`. `ui.js:36` destructures it but has no `if (showOriginal !== undefined)` handler. Plan's `_renderCards()` code unconditionally renders `.seg-original` div.
- **Suggested fix:** Either (a) remove the `check-show-original` checkbox from `index.html`, remove `show_original` from `_gatherSettingsFromUI()` and `_applySettings()`, and remove the parameter from `configure()` signature, OR (b) honor the setting by conditionally hiding the `.seg-original` div in `_renderCards()`.

---

## Finding 2: Existing users with saved `endpoint_delay: 3000` are unaffected — plan's "faster for everyone" claim is false

- **Severity:** Critical
- **Location:** Phase 2, Success Criteria ("Default endpoint delay is 1500ms for new installs")
- **Flaw:** The plan correctly notes "Existing users with saved settings keep their configured value." But it does not grapple with the implication: *every* user who has ever opened Settings and clicked Save already has `endpoint_delay: 3000` persisted in `settings.json`. The `|| 1500` fallback only fires when the key is missing. This means the "speed improvement" phase delivers zero benefit to every existing user. Only truly fresh installs benefit.
- **Failure scenario:** Ship the update. Existing users — the only users who exist today — notice no speed improvement. They must manually find and adjust the endpoint delay slider, which most won't know to do.
- **Evidence:** `app.js:647` — `endpoint_delay: parseInt(document.getElementById('range-endpoint-delay')?.value || 3000)` actively persists the slider value on every save. `app.js:555` — `const endpointDelay = s.endpoint_delay || 3000` means any previously saved `3000` trumps the new default.
- **Suggested fix:** Add a one-time migration: if `endpoint_delay === 3000` (the old default), auto-update it to `1500`. Or: reset only if user never manually adjusted it (e.g., add a `endpoint_delay_user_modified` flag, though that's heavier). At minimum, document this limitation in the plan so the implementer and product owner make a conscious decision.

---

## Finding 3: `_renderCards()` rebuilds full innerHTML on every provisional keystroke — performance regression for long sessions

- **Severity:** High
- **Location:** Phase 1, Step 1 (`_renderCards()` implementation)
- **Flaw:** Every call to `setProvisional()` triggers `_render()` which calls `_renderCards()` which rebuilds the entire `this.contentEl.innerHTML` from scratch by iterating all segments. During active speech, `setProvisional` fires multiple times per second. With 50+ segments, this creates significant DOM churn: string concatenation of all segments, full innerHTML replacement, GC of all old DOM nodes, re-parse and re-layout.
- **Failure scenario:** In a 30-minute meeting with hundreds of segments (even after trimming to `maxChars`), every provisional text update causes a visible frame stutter. The current `_renderSingle()` has the same problem, but the new cards render MORE HTML per segment (header div, original div, translation div vs. just a translation div), amplifying the cost.
- **Evidence:** `_renderCards()` line 90: `this.contentEl.innerHTML = html;` — full replacement. `setProvisional()` calls `_render()` on every invocation. `_trimSegments()` caps at `maxChars` (default 1200 chars / ~7-8 segments), which limits blast radius, but the plan doesn't acknowledge this tradeoff or analyze whether the current trim threshold is sufficient for the heavier card markup.
- **Suggested fix:** At minimum, acknowledge in the plan that performance is bounded by `_trimSegments()` and verify the current `maxChars` threshold keeps rendered segment count low enough. Ideally, separate provisional text update from full re-render (update only the last card or provisional card element).

---

## Finding 4: `_smartScroll()` target changes from dual-panel scroll to single-container scroll — untested behavioral shift

- **Severity:** High
- **Location:** Phase 1, Step 1 (last line of `_renderCards()`)
- **Flaw:** Current `_renderDual()` manages scroll state per-panel with `_getScrollState()` and restores independently for source/translation panels. Current `_renderSingle()` calls `_smartScroll(this.container.parentElement || this.container)`. The new `_renderCards()` calls the same `_smartScroll(this.container.parentElement || this.container)`. The plan does not analyze whether `this.container.parentElement` is the correct scrollable ancestor in the card layout, or whether removing the `dual-view` CSS class from `#overlay-view` could change which element has `overflow: auto`.
- **Failure scenario:** If the scrollable container is not the element passed to `_smartScroll()`, auto-scroll breaks silently — new cards appear below the fold and users must manually scroll. This is especially bad during live translation where auto-scroll is the primary UX.
- **Evidence:** `_renderCards()` line 91: `this._smartScroll(this.container.parentElement || this.container)`. The plan lists "Auto-scroll still works" as a success criterion but provides no analysis of the scroll container hierarchy or verification steps.
- **Suggested fix:** Add an explicit verification step: identify which DOM element has `overflow: auto/scroll` after the CSS changes and confirm it matches the element passed to `_smartScroll()`. Add this to the testing checklist.

---

## Finding 5: Plan does not address `getPlainText()` / `getFullPlainText()` / `getFormattedContent()` / `getFullSessionText()` — copy/save output format changes silently

- **Severity:** Medium
- **Location:** Phase 1, omission
- **Flaw:** The plan changes how segments are *rendered* but does not review the four text export methods. Currently `getPlainText()` outputs original + translation as separate lines. `getFormattedContent()` uses `> original` (blockquote) + translation format. These methods are called by copy-to-clipboard and auto-save. With the new card layout always showing original text, users will expect copy output to match the visual layout. The plan is silent on whether these methods need updating.
- **Failure scenario:** Likely a non-issue because these methods already output both original and translation. But the plan should explicitly confirm this. If someone later adds a "show_original: false" feature (Finding 1), these export methods would still include original text, creating a visible/export mismatch.
- **Evidence:** `ui.js:224-233` (`getPlainText`) and `ui.js:252-278` (`getFormattedContent`) both iterate segments and output `seg.original` and `seg.translation`. Plan's "Files Modified" section lists `ui.js` but only describes renderer changes.
- **Suggested fix:** Add a brief note confirming export methods require no changes, or update them if the format should match the new card visual structure (e.g., adding timestamps that cards now display).

---

## Finding 6: Removing `_renderDual()` but not verifying all CSS class references — orphaned CSS or broken styles possible

- **Severity:** Medium
- **Location:** Phase 1, Step 7 ("Update CSS in main.css")
- **Flaw:** The plan says to remove "all `.dual-view` rules" (~lines 546-604) and `.seg-block` styles (~lines 540-543). But it does not audit whether any other CSS rules reference `.seg-translated` (the class used in `_renderSingle()`). The new renderer uses `.seg-translation` (different class name). If `.seg-translated` had styles that `.seg-translation` doesn't inherit, the rendered translation text may lose styling (e.g., font weight, color). The plan introduces `.seg-card .seg-translation` CSS but never verifies that `.seg-translated` is removed or that its styles are migrated.
- **Evidence:** Current `_renderSingle()` uses class `seg-translated` (ui.js:407). New `_renderCards()` uses class `seg-translation` (phase-01, line 60). These are different class names. The plan's CSS section defines `.seg-card .seg-translation` but does not mention removing `.seg-translated` styles or ensuring parity.
- **Suggested fix:** Grep for `.seg-translated` in main.css. Either rename the new class to match, or explicitly list `.seg-translated` CSS rules for removal and confirm the new `.seg-translation` rules cover the same properties.

---

## Finding 7: `parseInt()` without radix on slider value fallback creates a subtle parse risk

- **Severity:** Medium
- **Location:** Phase 2, Step 1 (`_gatherSettingsFromUI()`)
- **Flaw:** The plan changes `parseInt(document.getElementById('range-endpoint-delay')?.value || 3000)` to use `|| 1500`. The `parseInt` call lacks a radix argument. While this works fine for decimal integer strings from an HTML range input, the `|| 1500` fallback means if the element is missing (`?.value` returns `undefined`), `parseInt(1500)` is called with a number, not a string. This works in practice but is a code smell the plan copies forward.
- **Failure scenario:** No immediate failure, but if the slider element ID is ever renamed or the element is conditionally absent, the fallback silently works but `parseInt` on a number is unnecessary. More importantly, the plan has `parseInt(document.getElementById('range-endpoint-delay')?.value || 1500)` — if the input value is `"0"` (which is falsy), it would fall through to `1500`. The slider min is `500` so `"0"` can't occur from the UI, but programmatic calls could hit this.
- **Evidence:** Phase 2 Step 1 code sample preserves the `parseInt(... || 1500)` pattern.
- **Suggested fix:** Low priority, but note that the idiomatic fix is `parseInt(el?.value ?? '1500', 10)` using nullish coalescing. This prevents the `"0"` edge case and supplies radix.

---

## Summary

| # | Severity | Finding |
|---|----------|---------|
| 1 | Critical | `show_original` setting becomes a zombie — checkbox does nothing, violates user preference |
| 2 | Critical | Existing users unaffected by speed change — `endpoint_delay: 3000` already persisted |
| 3 | High | Full innerHTML rebuild on every provisional update — amplified by heavier card markup |
| 4 | High | `_smartScroll()` target not verified after CSS/layout restructure |
| 5 | Medium | Export methods (`getPlainText`, etc.) not reviewed for format consistency |
| 6 | Medium | Class name mismatch: `.seg-translated` vs `.seg-translation` — orphaned styles |
| 7 | Medium | `parseInt` without radix, falsy-value fallback pattern carried forward |

**Status:** DONE  
**Summary:** Plan has 2 critical gaps (zombie show_original setting, ineffective speed change for existing users), 2 high-risk omissions (performance, scroll target), and 3 medium concerns. Recommend revision before implementation.
