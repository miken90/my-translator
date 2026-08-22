# Phase 7 — Overlay Opacity Restructure: implementation report

Commit `ac964e9` on `feat/uiux-p1-p2-session-scroll-toolbar`, on top of `d85457a` (P5).
Spec: `plans/260821-1640-uiux-overhaul/phase-07-overlay-opacity-restructure.md`.
Scope: Phase 7 only. No branch created, nothing pushed, no PR. Release build deliberately skipped.

Re-verified every line reference against `d85457a` before editing — they had all shifted from what
the phase file recorded at `969f94e` (the four `--text-dim` sites moved 1749/1772/1821/1871 →
1764/1787/1838/1888, and the `0.4` one turned out to be at 1816 by the time I edited). Nothing was
edited from memory.

## What changed, per file

**`src/styles/main.css`** (+40/-7)

1. `#overlay-view` (rule at 82) loses `background: var(--bg-primary)` and both
   `backdrop-filter` / `-webkit-backdrop-filter` declarations. Keeps `position: relative`,
   `border-radius`, `border`, `box-shadow`, `overflow: hidden`.
2. New `#overlay-view::after` — `position: absolute; inset: 0; z-index: 0; border-radius: inherit;`
   carrying the moved `background` + both `backdrop-filter` declarations **verbatim**, plus
   `opacity: var(--overlay-opacity, 0.85)` and `pointer-events: none`.
3. `position: relative; z-index: 1` added to `#drag-region`, `#transcript-container`,
   `#resize-handle` — the three static direct children. `.floating-controls` needed nothing: it is
   already `position: absolute; z-index: 10`.
4. `--text-provisional: rgba(255,255,255,0.4)` deleted from `:root` (was defined, referenced zero
   times).
5. `.session-summary-block strong` — `var(--text-dim, rgba(255,255,255,0.4))` → `var(--text-muted)`.
   This is the VQ5 raise: 0.4 white is 3.55:1, below AA even at full opacity.

**`src/js/app.js`** (+6/-2) — `_applySettings()`, the one opacity site.

**`tests/js/overlay-opacity.test.js`** (new, 63 lines) — 4 tests.

**`plans/260821-1640-uiux-overhaul/phase-07-*.md`** — frontmatter `pending` → `in-progress`, plus a
status block naming the steps that are done and the three that are not.

## How the slider is wired now vs before

```js
// before (app.js:263 @ d85457a)
overlayView.style.opacity = settings.overlay_opacity || 0.85;

// after (app.js:265 @ ac964e9)
overlayView.style.setProperty('--overlay-opacity', settings.overlay_opacity || 0.85);
```

Same call site, same lifecycle (`_applySettings` runs at startup via `app.js:97` and on every
settings change via `settingsManager.onChange`, `app.js:114`), same `|| 0.85` fallback, same range,
same persistence. The value now inherits from `#overlay-view` down to `#overlay-view::after`, where
it fades **only** the background layer. Text, icons, card tints and the toolbar's own translucent
background sit above it at full strength.

### Design points worth knowing

- **`::after`, not `::before`** — `::before` on this element is taken: `.compact-mode::before`
  (`main.css:285`) is the compact-mode hover strip, and `compact-mode` is applied to
  `#overlay-view` itself.
- **Children lifted individually rather than giving the host a stacking context.** `isolation:
  isolate` or a numeric `z-index` on `#overlay-view` would risk making it a *backdrop root*, which
  would leave the moved `backdrop-filter` with nothing behind it to sample — the glass blur would
  silently go inert. Three declarations on three children avoids that entirely.
- **Border and box-shadow stayed on the host** and therefore do not fade. Moving the border would
  change the content box by 2px, and P5 just set `minWidth: 600` against a 597px toolbar
  derivation that assumes those borders; an outer shadow drawn by a child would be clipped by
  `overflow: hidden` anyway. Net effect is what the user confirmed: a faint edge still marks the
  window when the panel is nearly invisible.

## Verification

**Token values unchanged — only the owning element moved.** `:root` diff against `d85457a` is
exactly one line, the intended `--text-provisional` deletion:

```
17d16
<   --text-provisional: rgba(255, 255, 255, 0.4);
```

No `--bg-*` value touched. `backdrop-filter: blur(30px) saturate(150%)` and its `-webkit-` twin are
byte-identical, now at `main.css:108-109`.

**Greps**

| Check | Result |
|---|---|
| `grep -rn 'style\.opacity' src/` | `0` |
| `--overlay-opacity` write / read sites | 1 in `app.js:265`, 1 in `main.css:110` |
| `grep -rn 'text-provisional' src/` | `0` |
| `--text-dim` sites remaining | 3, all with a `0.5` fallback — those are P3's value-neutral swaps, untouched here |
| `grep -n 'overflow' main.css \| grep toolbar-zone` | empty (P5's corrected state held) |

**ID preservation.** `src/index.html` was **not modified by this phase at all**
(`git diff --stat -- src/index.html` empty), so no id could have moved. Parity check anyway:
120 ids in `index.html`, 110 `getElementById` refs across `src/js/**`, 6 unresolved — exactly the
pre-existing dead set in `settings-form-controller.js` (`check-tts-enabled`, `hint-mode-local`,
`link-elevenlabs`, `range-tts-speed`, `tts-settings-detail`, `tts-speed-value`), all `?.`- or
`if (el)`-guarded. **Unexpected: NONE.** `tests/js/html-id-bindings.test.js` passes.

**Re-parenting check.** `position: relative` on a container re-homes absolutely positioned
descendants, so I enumerated every `position: absolute|fixed` rule in the file:
`#overlay-view::after` (new), `.compact-mode::before`, `.compact-mode:hover
#drag-region.compact-hidden`, `.floating-controls`, `.checkbox-option input:checked::after`,
`.toast`, `.modal-overlay`. **None is a descendant of `#transcript-container`, `#drag-region` or
`#resize-handle`.** `.floating-controls` is a *sibling* of `#transcript-container`, so its
containing block is still `#overlay-view`; `.toast` is appended to `document.body`;
`.modal-overlay` is a sibling of the views. No containing block changed.

**Tests** — `powershell.exe -NoProfile -Command "npm test"` from `D:\`, re-run after committing:

```
Test Files  15 passed (15)
     Tests  100 passed (100)
```

Was 96/96 at `d85457a`; +4 are the new file. No test weakened, skipped or deleted. (The two stderr
blocks in the output are pre-existing: `app-session-state.test.js` deliberately drives `start()` and
`stop()` into throwing to assert the error path.)

**cargo** — not run. `src-tauri/` untouched this phase (`git diff d85457a..HEAD --stat` lists three
files, all under `src/` and `tests/`).

**Release build** — not run, per the dispatch. One build at the end, after all phases land.

## Phase steps: done vs not

| Step | State |
|---|---|
| 1 — wallpaper check (user-owned) | **NOT DONE.** User has not run it. Did not block: both branches build identical code |
| 2 — branch from P5 tip | done (worked directly on the branch as instructed) |
| 3 — move background + both backdrop-filters to `::after` | done |
| 4 — lift children; check `.floating-controls` is positioned | done (it already was) |
| 5 — `setProperty('--overlay-opacity', …)`; confirm no other `style.opacity` | done |
| 6 — 7c: delete `--text-provisional`, rewrite the 0.4 site | done |
| 7 — `tests/js/overlay-opacity.test.js` | done, 4 tests |
| 8 — finalise the AA claim from step 1's branch | **NOT DONE**, blocked on step 1. No finalised claim written anywhere; §7b still presents both branches |
| 9 — branch-B remedies, specified not built | **left specified, not built**, as the phase requires |
| 10 — vitest + build | vitest done; build deliberately skipped |
| 11 — hand back for smoke | this report |

## What to look at for THIS phase at the final smoke test

Capture "before" screenshots at 100%, 85% and 20% opacity with a transcript on screen first — 3 and
9 are comparisons.

1. Launch at the default 85%: the overlay looks essentially as it did — panel, blur, border, shadow.
2. **Drag opacity to 20%.** The panel goes nearly invisible **but the transcript text, toolbar icons
   and status readout stay crisp and fully legible.** This is the whole phase. If text fades with
   the panel, it failed.
3. Still at 20%: confirm the **blur is still working** — content behind the window is blurred, not
   sharp. This is the one failure mode the design specifically guards against, and it cannot be
   detected any other way.
4. Slide 20% → 100% and back: smooth, no flicker, no repaint artefacts, nothing jumping.
5. Save & Close Settings, reopen — value stuck. **Fully quit and relaunch** — still stuck, and
   applied at startup before you touch anything.
6. At 20%, check nothing has fallen *behind* the panel: toolbar, transcript cards, speaker labels,
   the translation card's coloured left border, and the floating controls (hover near the bottom
   right) must all still paint above it.
7. Compact mode at low opacity: hover-reveal still reveals the bar, and the revealed bar is readable.
8. Open Settings and Sessions at 20% — both must be completely unaffected by the slider.
9. **Look at the 1px window edge at 20%.** The border and drop shadow deliberately do not fade, so
   the window outline stays visible. Confirm that reads as intentional rather than as a stray line —
   see unresolved question 2.
10. Trigger a toast (copy the transcript) and, if you can, the recovery dialog — both must still
    appear above everything.
11. Sessions ▸ open a session with a summary: the small bold labels inside the summary block
    (ORIGINAL / TRANSLATED) are now slightly brighter. Nothing else in that block changed.
12. **The wallpaper check, which is still owed:** run the app over a **bright** wallpaper at 20% and
    report whether the wallpaper shows through the panel. That single answer finalises the AA claim.

## Unresolved questions

1. **The wallpaper check (phase step 1) is still outstanding and is the only thing blocking a
   finalised AA claim.** Per the dispatch I wrote none. Recap of why it matters: against a dark
   composite base the restructure makes contrast essentially independent of the slider
   (`--text-muted` ~5.3:1 from 100% down to 20%, vs 1.20:1 today at 20%); against a white base the
   before/after numbers are identical and the phase buys nothing. Same code either way.

2. **A 1px detail I did not flag when I wrote the phase.** An element's `background` paints under
   its border by default; a positioned child with `inset: 0` only covers the padding box. So the
   thin ring beneath `#overlay-view`'s 1px border is no longer painted by the panel background — the
   border (`rgba(255,255,255,0.06)`, 6% white) now blends over whatever is behind the window instead
   of over the panel. I left it: `overflow: hidden` clips to the padding box so `inset: -1px` cannot
   fix it, and the alternatives (moving the border to the layer, or keeping a non-fading background
   on the host) each perturb something another phase settled — the border move would change the
   content box by 2px, against which P5 just set `minWidth: 600`. It is a hairline at 6% alpha, but
   it is a real delta from before and smoke step 9 exists to judge it.

3. **`--text-dim` is still referenced 3× and still undefined.** Deliberate — those three are P3's
   value-neutral swaps and are out of Phase 7's scope. Flagging so it is not read as an oversight.

Status: DONE
Summary: Phase 7 implemented and committed as `ac964e9` — overlay opacity now drives a `#overlay-view::after` background layer via `--overlay-opacity` instead of fading the whole subtree; 100/100 vitest green, token values byte-identical, `src/index.html` untouched.
Concerns/Blockers: The user-owned wallpaper check (phase step 1) is still outstanding, so the finalised AA claim (step 8) is deliberately unwritten — both branches build the same code, so implementation was never blocked. Two things need eyes at the smoke test that I cannot verify: that the glass blur did not go inert, and a 1px window-edge detail described in unresolved question 2.
