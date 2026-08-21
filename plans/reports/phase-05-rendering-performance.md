# Phase 5 Report: Rendering Performance

Plan: `plans/260821-1053-meeting-focus-optimize-refactor/`
Branch: `refactor/phase-5-render` (from `refactor/phase-4-frontend`), 5 commits, not pushed.

## What was changed

**`ui.js` / new `transcript-card-renderer.js`**: `_renderCards()`'s full `innerHTML` rebuild replaced with a keyed segId→card-element map (`CardRenderer`). Each render pass only writes a card's `innerHTML` when a computed content signature (status/original/translation/stale/confidence/header-visibility/createdAt) differs from the last patch — an unrelated provisional-text update no longer touches settled cards at all. New segments are always appended (ids are monotonic, segments array is append-only aside from removals, so DOM order never needs reconciling beyond `appendChild`). The provisional card is a reused singleton, re-appended each render to stay last. Split into a separate module since the combined logic would have pushed `ui.js` past the plan's own "no JS file >600 LOC" criterion (now 440 + 205 lines).

**Provisional rAF-coalescing**: `setProvisional`/`clearProvisional` now schedule a single `requestAnimationFrame` render instead of rendering synchronously on every call; rapid successive calls before the frame fires just overwrite pending state, so only the latest value renders. `addOriginal`/`addTranslation` (finalized content) still flush synchronously, unchanged.

**`_trimSegments` single-pass rewrite**: was a `while` loop doing repeated `findIndex`+`splice` (O(n) rescans per removal); now one forward pass building a `kept` array, dropping 'translated' segments in encounter order while over `maxChars` and above the 2-segment floor. Same removal semantics (verified via existing Phase 2 tests, unchanged).

**`soniox.js`**: added `MAX_HISTORY_ENTRIES = 50` as an entry-count cap on `_recentTranslations`, independent of the existing char cap — guards against many very short translations never tripping the 500-char cap while still growing the array over a multi-hour session.

**`audio-player.js` / `tts-controller.js`**: added `audioPlayer.onBackpressure(droppedCount)`, invoked alongside the existing drop-oldest `console.warn` on queue overflow. Wired in `TTSController.wireCallbacks` (logs at the controller level — no UI toast added, since that wasn't requested and would be a product decision beyond "make the policy explicit").

## Judgment calls

1. **Behavioral fidelity of the keyed renderer**: the old code recomputed `showSpeaker`/`showLang` fresh on every single render pass (resetting tracking vars to `null` each time, over the *current*, possibly-trimmed segments array) — meaning header visibility could shift between renders as earlier segments got trimmed. Preserved this exactly: the reconciliation loop still walks the full segments array every render and updates tracking vars unconditionally (even for invisible segments), only skipping the actual card DOM write via the signature check.
2. **Invisible-segment edge case**: old code rendered nothing for a `status:'original'` segment with empty `original` text (falsy check, implicit else-branch). Replicated via `_isCardVisible()` — no card is created for such a segment; if one somehow existed from an earlier state it's removed.
3. **Translation-arrives-after-trim**: no special-case code needed — `addTranslation`'s own lookup against `this.segments` is unchanged (existing behavior: if the original was already trimmed away, it falls to the orphan-entry path), and the renderer's reconciliation naturally never sees a "patch" request for a vanished id since it only ever iterates the *current* segments array.
4. **rAF-coalescing scope**: grouped `clearProvisional` with `setProvisional` (same transient-display stream), not just `setProvisional` alone — both can be reasonably deferred by up to one frame (~16ms, imperceptible) without affecting "final updates flush immediately."
5. **No audio-player.js test added**: Web Audio API (`AudioContext`/`decodeAudioData`) isn't available in jsdom without substantial extra mocking, and the phase's Implementation Steps only explicitly called for tests on the ui.js renderer and soniox.js cap — left this change (small, additive, low-risk) uncovered by an automated test, same as it was before.

## Verification (worker-verifiable layer)

`npx vitest run` → **66/66 tests passed** (9 test files) — 59 existing (Phases 1-4) + 7 new (6 in `ui-render-perf.test.js`, 1 in `soniox-context.test.js`). Full run repeated after every commit, stayed green throughout.

New `ui-render-perf.test.js` (jsdom) asserts, via 5000 synthetic `addOriginal`/`setProvisional`/`addTranslation` calls plus targeted smaller tests:
- Card-node count stays bounded (~70-80 at steady state for this test's short synthetic strings, `maxChars`-driven) — does not scale with N=5000.
- No detached-node accumulation: every tracked card node is confirmed still attached under `contentEl`; `clear()` leaves zero tracked nodes and zero DOM children.
- `sessionLog` keeps the full untrimmed history (5000 entries) — existing invariant intact.
- A card whose content signature is unchanged gets zero DOM write on re-render (direct `dataset.sig` equality check).
- A `MutationObserver`-verified test proves provisional-only updates never touch previously-settled stable cards (the core "O(changed), not O(displayed))" property).
- Rapid `setProvisional` calls coalesce into exactly one scheduled `requestAnimationFrame`, and flushing it reflects the *latest* value, not the first.
- `addOriginal` renders with zero `requestAnimationFrame` calls (finalized content flushes synchronously).

## Not verified (human checkpoint — listed per dispatch instructions, not claimed)

- DevTools "Paint flashing" showing only the changed card region repainting
- DevTools Performance recording confirming no main-thread long tasks ≥50ms during rapid provisional updates
- Heap stability over a real ~30 minute run
- Visual/behavioral smoke pass on the actual built app (font-size mid-stream, clear-session mid-stream, scroll-up-while-streaming)

Added these as explicit checklist items in `docs/smoke-test-checklist.md` under a new "Rendering performance (Phase 5)" section.

## Success criteria verification

- [x] jsdom perf test: DOM mutations per update O(changed cards); node count bounded; no detached-node growth over 5000 synthetic updates — see above
- [ ] Human checkpoint: paint flashing single-card-region repaint; heap stable over real ~30min session — **pending human run**
- [x] Trim tests + all Vitest green — 66/66; visual behavior identical per code-level analysis (item 1-3 above) — **smoke checklist confirmation pending human run**
- [ ] No jank (long tasks <50ms) during rapid provisional updates — **pending human run with DevTools**

## Unresolved questions

None — no user-owned decisions were hit this phase.

---

Status: DONE_WITH_CONCERNS
operation_id: op-mytranslator-phase5
Summary: Phase 5 complete — keyed incremental card renderer (split into transcript-card-renderer.js), rAF-coalesced provisional updates, single-pass trim, soniox.js entry-count cap, audio-player backpressure signal. 66/66 vitest green (59 existing + 7 new). 5 commits on refactor/phase-5-render, not pushed.
Concerns/Blockers: Paint-flashing/long-task/30min-heap checks and the visual smoke pass are human-checkpoint items I cannot perform myself — added as explicit pending items in docs/smoke-test-checklist.md.
