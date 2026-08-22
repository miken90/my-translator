---
title: Unified Card Layout + Translation Speed
status: completed
created: 2026-04-06
phases: 2
effort: small
completed: 2026-04-06
---

# Unified Card Layout + Translation Speed

## Goal

Replace disconnected single/dual view modes with unified card-per-utterance layout (original + translation stacked). Lower default Soniox endpoint delay for faster perceived translation.

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Card layout + remove dual mode | completed | `phase-01-card-layout.md` |
| 2 | Speed: lower endpoint delay + show original immediately | completed | `phase-02-speed-improvement.md` |

## Files Modified

- `src/js/ui.js` — replace `_renderSingle()` + `_renderDual()` with `_renderCards()`
- `src/js/app.js` — remove view toggle binding, update default delay
- `src/index.html` — remove view toggle button from floating controls
- `src/styles/main.css` — add card styles, remove dual-view styles

## Red Team Review

### Session — 2026-04-06
**Findings:** 7 (4 accepted, 3 rejected)
**Severity breakdown:** 2 Critical, 1 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `show_original` checkbox becomes zombie | Critical | Accept | Phase 1 |
| 2 | Speed change no-op for existing users (need migration) | Critical | Accept | Phase 2 |
| 3 | Speaker header lost after `_trimSegments()` | High | Reject | Pre-existing |
| 4 | innerHTML rebuild amplified | High | Reject | Pre-existing, capped segments |
| 5 | `_smartScroll()` target unverified after CSS change | High | Accept | Phase 1 |
| 6 | CSS class name mismatch `.seg-translated` vs `.seg-translation` | Medium | Accept | Phase 1 |
| 7 | `_cleanupStaleOriginals` 10s vs 1.5s delay interaction | Medium | Reject | Different concerns |

## Validation Log

### Session 1 — 2026-04-06
**Trigger:** Pre-implementation validation
**Questions asked:** 4

#### Confirmed Decisions

1. **[Scope]** `show_original` checkbox: **Remove entirely** — new card layout always shows original
2. **[Assumptions]** Existing users' endpoint delay: **Silent migration** — if saved == 3000 (old default), auto-update to 1500
3. **[Tradeoffs]** Dual view code: **Remove completely** — button, method, CSS all deleted
4. **[Risk]** Card visual style: **Subtle cards** — `rgba(255,255,255, 0.04)` background, `border-radius: 8px`, no border

#### Action Items
- [ ] Phase 1: Remove `check-show-original` checkbox from `index.html` Display tab
- [ ] Phase 1: Remove `showOriginal` from `configure()`, `_applySettings()`, `_gatherSettingsFromUI()`
- [ ] Phase 2: Add migration logic in `_applySettings()`: if `endpoint_delay === 3000`, set to 1500 and save
