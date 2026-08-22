---
phase: 5
title: "Rendering Performance"
status: completed
priority: P1
effort: "2-3d"
dependencies: [4]
---

# Phase 5: Rendering Performance

## Overview

Make multi-hour meeting sessions smooth: replace full `innerHTML` rebuild per speech update with incremental card DOM updates, throttle provisional renders, fix O(n²) trim, bound unbounded arrays.

## Requirements

- Functional: identical visual output incl. smart-scroll behavior (auto-scroll only at bottom), card layout, stale-segment dim/strike/removal
- Non-functional: per-update DOM work proportional to changed cards, not total; stable memory across 4h session

## Architecture

`_renderCards()` (ui.js:340-402) currently rebuilds whole HTML string + `innerHTML` assign on every update (~100ms cadence). Replace with keyed card elements: map segment id → card node; on update, patch that card's text nodes; on new segment, append node; on trim/stale-removal, remove node. `_smartScroll` fires only when content height changed. Provisional text updates coalesced through `requestAnimationFrame`.

## Related Code Files

- Modify: `src/js/ui.js` — `_renderCards` → incremental `_createCard`/`_updateCard`/`_removeCard`; `_trimSegments` (ui.js:419-432) batch removal without repeated findIndex+splice; keep `sessionLog` untouched
- Modify: `src/js/soniox.js` — cap `_recentTranslations` array length (char cap exists at ~line 26, add entry-count cap + prune)
- Modify: `src/js/audio-player.js` — on queue overflow (> _maxQueueSize) surface backpressure signal to tts-controller (skip-oldest already logged; make policy explicit)
- Modify: `tests/js/` — trim tests updated for new implementation, same observable behavior

## Implementation Steps

1. Branch `refactor/phase-5-render`. Build keyed-card renderer behind same public API (`addOriginal`, `addTranslation`, `setProvisional`, `clear`).
2. rAF-coalesce provisional updates; ensure final (non-provisional) updates flush immediately.
3. Rewrite `_trimSegments` as single-pass; verify with Phase 2 trim tests.
4. Bound soniox context array; add test.
5. Perf verification, two layers:
   - Worker-verifiable: jsdom test driving N=5000 synthetic `addOriginal`/`addTranslation`/`setProvisional` calls through the public API → assert DOM mutation count per update is O(changed cards) not O(total), node count bounded by trim, no detached-node accumulation. No Soniox replay harness — synthetic calls at the ui.js API boundary suffice.
   - Human checkpoint: DevTools paint flashing shows only changed card repainting; long tasks <50ms during rapid provisional updates; heap stable over a real ~30min run.
6. Smoke checklist incl. scroll-up-while-streaming, font-size change mid-stream, clear session.

## Success Criteria

- [x] jsdom perf test: DOM mutations per update O(changed cards); node count bounded; no detached-node growth over 5000 synthetic updates
- [x] Human checkpoint: paint flashing shows single card region repainting; heap stable over real ~30min session
- [x] Trim tests + all Vitest green; visual behavior identical per smoke checklist
- [x] No jank (main-thread long tasks <50ms) during rapid provisional updates

## Risk Assessment

- Smart-scroll regressions are easy to introduce → explicit smoke cases: reading scrollback while streaming must not yank down.
- Keyed updates must handle translation-arrives-after-trim (segment already removed) → drop patch silently but still append to sessionLog (existing invariant).
