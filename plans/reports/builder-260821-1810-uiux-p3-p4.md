---
title: "Builder Report — UI/UX Overhaul Phase 3 + Phase 4"
date: 2026-08-21
plan: plans/260821-1640-uiux-overhaul/
phases: [3, 4]
commits: [642f6d9, d6dced3]
---

# Builder Report — Phase 3 (Design Token Layer) + Phase 4 (Interaction State Normalization)

Branch `feat/uiux-p1-p2-session-scroll-toolbar`, on top of `ac964e9` (P7). Two commits, per
dispatch. No Windows build run — user does one final build after all phases land, per dispatch.

## Re-verification against current source (mandatory per dispatch)

All line numbers in both phase files are `969f94e`-relative; four commits landed since. Re-ran
every grep/census against `ac964e9` before editing. Findings, all confirmed correct:
- 3 `var(--text-dim, rgba(255,255,255,0.5))` sites (P7 already fixed the 4th → `var(--text-muted)`).
- 4 `outline: none` sites at lines 799/1194/1217/1329 (not the stale 724/1118/1141/1232).
- 5 scrollbar rule-sets, byte-identical except `#transcript-container`'s extra `:hover` thumb rule.
- Colour census: 88 occurrences / 43 distinct outside `:root` (89/43 minus the one P7 rewrote) —
  matches the plan's own predicted delta exactly.
- `.tts-action-btn.disabled`, `.session-copy-btn:disabled:hover`, zero `overflow` on `.toolbar-zone*`
  — all as the plan expected.

**One correction to the plan itself**, reported per dispatch instructions rather than silently
patched: phase-03's guard-test spec (§3e) names only two `RUNTIME_INJECTED` exemptions
(`--transcript-font-size`, `--transcript-font-color`). P7 (landed after the phase file was written)
added a third: `#overlay-view.style.setProperty('--overlay-opacity', ...)` in `src/js/app.js:265`.
Without exempting it too, the guard test's orphan-`var()` rule would flag `var(--overlay-opacity, 0.85)`
(`main.css`, `#overlay-view::after`) as broken. Added it to the exemption array with the same
rationale as the other two (a `:root` definition would beat the runtime value). This is a factual
gap in the plan text, not a design disagreement — flagging per dispatch's "if the plan is factually
wrong, say so" instruction.

## Phase 3 — Design Token Layer (commit `642f6d9`)

Files: `src/styles/main.css`, new `tests/js/css-tokens.test.js`, `docs/code-standards.md`.

- **3a**: 3× `var(--text-dim, rgba(255,255,255,0.5))` → `var(--text-muted)`; confirmed
  `--text-dim`/`--text-provisional` fully gone. Dead `--radius-md` wired to `.about-app-version`'s
  literal `border-radius: 10px`.
- **3b**: Added `--surface-1/2/3`, `--text-on-accent`, `--accent-alt/-speaker/-minimize-hover`,
  `--accent-translation`, `--error-strong` to `:root`; replaced all matching literals (8× 0.04, 5×
  0.05, 10× 0.1 white; 2× `#fff`; 1× each hex accent). Verified via balanced-paren RGB-triple
  matching that every remaining literal is either an alpha variant of a `:root` token, a black
  shadow, or the `rgba(20,20,30,*)` header wash.
- **3c**: Added spacing (`--space-3xs..3xl`), type (`--font-size-xs..xl`), z-index
  (`--z-floating/-compact-reveal/-compact-catch/-overlay`), control-height
  (`--control-h-sm/md/lg`), and radius (`--radius-2xs/-xs`) scales. Replaced literals only in
  matching properties (`gap`/`padding*`/`margin*` for spacing, `font-size` for type, `z-index`,
  `border-radius`, and the four named height selectors only — `.icon-btn`, `.source-btn`,
  `.action-btn`, `.tts-action-btn`). Left 1px/3px/14px/28px, the 5px/8px radius one-offs, and every
  other same-valued width/height alone, per the plan's explicit judgment calls.
- **3e**: `tests/js/css-tokens.test.js` — 3 tests: no orphan `var()`, no dead `:root` token, no
  unassigned colour literal. Passing.
- Doc: added a "CSS Design Tokens" subsection to `docs/code-standards.md`.

**Value-parity proof**: wrote a one-off resolver (balanced-paren `var()` expansion one level from
`:root`, keyed by `selector => property` in source order — not committed, was in scratchpad).
Ran before/after the full phase. **Exactly one non-empty diff**, on the 3a swap:
```
.session-summary-title => color: var(--text-dim, rgba(255, 255, 255, 0.5))   [before]
.session-summary-title => color: rgba(255, 255, 255, 0.5)                     [after]
```
(×3, same for `.session-qa-title` and `.qa-message-system`) — same rendered value, expected per plan.
Every other rule in the file resolved identically before and after, across every sub-step (colour
tokens, spacing, type, z-index, control-heights).

## Phase 4 — Interaction State Normalization (commit `d6dced3`)

Files: `src/styles/main.css`, `src/index.html`, `src/js/window-manager.js`,
`src/js/tts-controller.js`, `src/js/app.js`, new `tests/js/toggle-state.test.js`.

- **4a**: Added `:where(button, input, select, textarea, [role="radio"], a[href]):focus-visible`
  (solid `--accent`, `outline-offset: 2px`). Deleted the 4 `outline: none` declarations. Added an
  inset-ring (`outline-offset: -2px`) override for `#btn-close`, `#btn-settings`,
  `.session-copy-btn`, `.qa-input-row input`, `.float-btn`, `.color-dot` — all flush against a
  clipping ancestor or a tight row. Re-confirmed zero `overflow` on any `.toolbar-zone*` before
  relying on the +2px offset there.
- **4b**: Added shared `button/input/select/textarea:disabled { opacity: 0.4; cursor: not-allowed }`.
  Converted `tts-controller.js`'s `classList.toggle('disabled', isTwoWay)` → `btn.disabled = isTwoWay`
  and deleted `.tts-action-btn.disabled`. **Decision**: kept `.tts-action-btn:disabled { opacity: 0.35 }`
  as a byte-exact override rather than letting it drift to 0.4 — no user decision authorized a value
  change here, so I defaulted to zero-pixel-change. Folded `.session-copy-btn:disabled` and
  `.qa-input-row input:disabled` into the shared rule (both were already exactly `opacity:0.4;
  cursor:not-allowed`) but **kept** `.session-copy-btn:disabled:hover` standalone, per plan.
- **4c**: Consolidated 5 scrollbar rule-sets (base/track/thumb/thumb:hover, each a single
  comma-separated selector line so `grep -c webkit-scrollbar` reads exactly 4) into one shared
  group. Diffed all 5 before collapsing — byte-identical except the missing `:hover` thumb rule on 4
  of them, which they now gain (intended, per plan).
- **4d**: `aria-pressed` on `#btn-pin` (starts `"true"`, matches `isPinned = true`), `#btn-tts`
  (starts `"false"`), `#btn-compact` (starts `"false"` — also gave it the `.active` CSS/class
  treatment it never had, wired in `window-manager.js`'s `toggleCompact()`). `role="radiogroup"` +
  `aria-label` on `.source-controls`; `role="radio"` + `aria-checked` on the 3 source buttons, wired
  in `app.js`'s `_updateSourceButtons()`. Accessible names (the existing `title` text) unchanged.
- **4e**: Toolbar icons normalized: 16px on the 4 zone-primaries (settings, start — already 16,
  unchanged — copy, close); 14px on everything else. Fixed the "both" source icon's box to `14×12`
  (exact match to its `28×24` viewBox aspect, was `16×14` — a ~2% squash). Swapped `#btn-sessions`'s
  clock-face path for a list glyph (6 lines: 3 bars + 3 dots), same id/class/position, only inner
  geometry and `width`/`height` changed.
- **4f**: No action — confirmed sub-28px controls outside the toolbar untouched, per the final user
  decision.
- New test: `tests/js/toggle-state.test.js` — 5 tests covering pin/compact/TTS `.active` +
  `aria-pressed` sync, TTS `disabled` property in two-way mode, and the source radiogroup's
  exactly-one-checked invariant.

## Before/after counts

| Check | Before (ac964e9) | After Phase 3 | After Phase 4 |
|---|---|---|---|
| `grep -c 'outline: none' src/styles/main.css` | 4 | 4 (untouched — P4's job) | **0** |
| `grep -c 'focus-visible' src/styles/main.css` | 0 | 0 | **7** (1 rule definition + `outline`/`outline-offset` lines + the inset-override selector list + comment mentions) |
| `grep -c 'webkit-scrollbar' src/styles/main.css` | 16 | 16 (untouched) | **4** |
| `grep -c 'text-dim' src/styles/main.css` | 3 | **0** | 0 |
| `grep -c 'app-region' src/styles/main.css` | 0 (P5 already removed) | 0 | 0 |
| `grep -c 'aria-' src/index.html` | 0 | 0 | **7** |

## ID-preservation proof

No `getElementById`-bound ID was renamed or removed in either phase. Ran a script comparing every
`id="..."` in `src/index.html` against every `getElementById(...)` call across `src/js/*.js`:

```
Bound IDs not found in index.html: [
  'link-elevenlabs', 'check-tts-enabled', 'tts-settings-detail',
  'range-tts-speed', 'tts-speed-value', 'hint-mode-local'
]
Total distinct HTML ids: 120   Total distinct bound ids: 110
```

Identical to the pre-existing 6-entry gap phase-04 itself documents as expected (the
`KNOWN_DEAD` array in `tests/js/html-id-bindings.test.js`, added by P5) — zero drift from either
phase. `tests/js/html-id-bindings.test.js` stayed green through both commits (confirmed in the full
vitest runs below).

## Test output

Phase 3 (`npm test` via `powershell.exe`, from `/mnt/d`):
```
Test Files  16 passed (16)
     Tests  103 passed (103)
```
(100 baseline + 3 new in `tests/js/css-tokens.test.js`.)

Phase 4 (`npm test` via `powershell.exe`, from `/mnt/d`):
```
Test Files  17 passed (17)
     Tests  108 passed (108)
```
(103 + 5 new in `tests/js/toggle-state.test.js`.) No test weakened or deleted in either phase.
`cargo test` not run — neither phase touched `src-tauri/**`, per dispatch's conditional instruction.
Windows build **not** run, per dispatch — deliberate, one build happens after all phases land.

## Plan steps completed / not completed

All numbered steps in both phase files completed:
- Phase 3 steps 1–10 (baseline snapshot through hand-back) — done, except step 8
  (`npm run tauri build`) which the dispatch explicitly overrides ("do NOT run the full Windows
  release build"); vitest ran in its place per dispatch's own verification section.
- Phase 4 steps 1–11 — done, same build-step override.
- Nothing skipped or deferred beyond that one deliberate, dispatch-authorized build skip.

## What to look at at the single final smoke test (these two phases only)

1. Overlay: cards, speaker labels, provisional (grey) text, the pink-bordered translation line,
   placeholder/shortcut hints — should look pixel-identical to before P3/P4 (P3 is representation
   only; P4 changed no colours).
2. Toolbar: icon sizes now read as two tiers (16px on settings/start/copy/close, 14px elsewhere);
   the "both" source icon should look slightly less squashed than before; Sessions button now shows
   a list glyph instead of a clock — click it, confirm it still opens Sessions.
3. Tab through the overlay from a cold start: every control shows a visible blue ring; no ring is
   cut off at the left/right window edge or by the panel border.
4. Click (not Tab) any button: **no** ring should appear on click — only on keyboard focus.
5. Settings: Tab through every tab/field/slider/colour dot/select — ring visible on all, including
   the range sliders and colour dots (these had `outline: none` before).
6. Sessions: Tab through the list, into a session, through the viewer header and Q&A input — ring
   never clipped by the panel edge.
7. Switch to two-way translation mode: the TTS button should visibly go inert and **Tab should skip
   it**. Switch back: focusable again.
8. Open a session with no AI endpoint configured: Summary/Q&A-ask should look and behave disabled,
   Tab skips them, and hovering with the mouse should do nothing (no background/colour change).
9. Hover the scrollbar thumb in all five scroll regions (transcript, Settings, Sessions list,
   session viewer, Q&A) — all five should now highlight on hover (4 of them are new).
10. Toggle pin, TTS, and compact — compact should now visibly show an active state on its button,
    like pin and TTS already do.
11. Drag the opacity slider 100%→20%→100% (P7 territory, but P3 touches nothing here) — nothing
    should look different from before P3/P4.

## Unresolved questions

1. **0.35 vs 0.4 opacity for the disabled TTS button** (§4b): kept byte-exact at 0.35 via an
   override rather than letting it drift to the shared 0.4, since no user decision authorized that
   0.05 change. If the user actually prefers one shared value everywhere, say so and I'll drop the
   override.
2. **`--overlay-opacity` guard-test exemption**: added as a third `RUNTIME_INJECTED` entry (see
   "Re-verification" above) since P7 introduced it after the phase file was written. No action
   needed unless the user wants this documented back into the plan file itself.

Status: DONE
Summary: Phase 3 (design-token layer) and Phase 4 (focus/disabled/scrollbar/ARIA normalization) both implemented, committed separately, 108/108 vitest green, zero pixel-value regressions in Phase 3, only plan-approved visible changes in Phase 4 (focus rings, 4 new scrollbar hovers, icon sizes, compact active state, session icon glyph).
Concerns/Blockers: None blocking. Two minor judgment calls recorded above for user confirmation at the final smoke pass.
