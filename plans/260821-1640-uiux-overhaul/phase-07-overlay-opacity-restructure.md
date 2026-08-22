---
phase: 7
title: "Overlay Opacity Restructure — Opacity on the Background Only"
status: in-progress
priority: P1
effort: "4-6h"
dependencies: [5]
---

# Phase 7: Overlay Opacity Restructure — Opacity on the Background Only

> **Implementation status (2026-08-21).** Code landed on
> `feat/uiux-p1-p2-session-scroll-toolbar`. Steps 2-7 and 10 done; 100/100 vitest green.
> **Step 1 (the user-owned wallpaper check) is still outstanding**, and because of that so are
> **step 8** (finalise the AA claim from the branch it settles) and **step 9** (decide whether the
> branch-B remedies are needed). Both branches build the same code, so the implementation was not
> blocked — only the claim is. The release build was deliberately skipped: one build runs at the
> very end, after all phases land. Human smoke gate below is unrun.

## Overview

Stop the user's opacity setting from fading the **text**. Today `src/js/app.js:263` sets
`overlayView.style.opacity`, which is CSS **group** opacity: it flattens the entire `#overlay-view`
subtree — panel, chrome, transcript, every label — and composites the whole thing at the slider
value. Restructure so the opacity applies to a dedicated **background layer** only; content and text
render at full strength above it.

This is the user's answer to Validation Question 1(a): the real fix, not a qualified AA claim. The
user accepted the added scope.

**The slider keeps working and keeps meaning "how see-through is the panel".** What changes is that
the transcript stays readable when you turn the panel down — which is the point.

Executes **after P5, before P3** (see plan.md → Execution order). P3 must tokenize the *restructured*
`#overlay-view` rules, not the old ones.

## Requirements

- Functional: `overlay_opacity` (range 20-100%, default 85%) still controls how see-through the
  overlay panel is, still persists, still applies at startup and on Save in Settings.
- Functional: text and content inside the overlay render at full strength regardless of the slider.
- Non-functional: `--bg-*` and `backdrop-filter` token **values** unchanged (plan-wide non-goal).
  This phase changes *which element* carries them, not what they are.
- Non-functional: the glass blur must still blur what is behind the window — not go inert.
- Constraint: vanilla CSS/JS, no dependency, no build step.
- Constraint: no element ID renamed or removed; no new element added to `src/index.html`.
- Constraint: `#settings-view` and `#sessions-view` are unaffected — they never had group opacity
  (`grep -rn "style.opacity" src/js/` → one hit, `app.js:263`, on `#overlay-view` only).

## Architecture

### 7a. Mechanism — a `::after` background layer driven by a custom property

`#overlay-view` currently carries the whole glass treatment (`main.css:82-94`): `background`,
`backdrop-filter`, `border`, `border-radius`, `box-shadow`, `overflow: hidden`, `position: relative`.

Move **only `background` and `backdrop-filter`** onto `#overlay-view::after`, and put the opacity
there:

```css
#overlay-view {
  position: relative;
  /* background + backdrop-filter REMOVED — they move to ::after */
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  box-shadow: /* unchanged */;
  overflow: hidden;
}

#overlay-view::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background: var(--bg-primary);
  backdrop-filter: blur(30px) saturate(150%);
  -webkit-backdrop-filter: blur(30px) saturate(150%);
  opacity: var(--overlay-opacity, 0.85);
  pointer-events: none;
}

/* Lift in-flow content above the layer. .floating-controls already has z-index:10 —
   verify it is positioned; if it is not, add position: relative. */
#drag-region,
#transcript-container,
#resize-handle { position: relative; z-index: 1; }
```

`src/js/app.js:263` becomes a custom-property write instead of an element-opacity write:

```js
overlayView.style.setProperty('--overlay-opacity', settings.overlay_opacity || 0.85);
```

Custom properties inherit, so `::after` picks it up. One line, same lifecycle, same default.

**Why `::after` and not `::before`:** `::before` on this element is already taken —
`.compact-mode::before` (`main.css:263-273`) is the compact-mode hover strip, and `compact-mode` is
applied to `#overlay-view` itself (`window-manager.js` `toggleCompact()`). `#overlay-view::after` is
unused (`grep -n '#overlay-view' src/styles/main.css` → only rules 82 and 660).

**Why `z-index: 0` on the layer plus `z-index: 1` on the children, and NOT `z-index: -1` plus a
stacking context on the host.** `isolation: isolate` (and other stacking-context-forming properties)
risk turning `#overlay-view` into a **backdrop root**, which would leave `::after`'s
`backdrop-filter` with nothing behind it to sample — the glass blur would silently go inert. The
children-lifting approach adds no stacking context to the host and cannot cause that. It costs three
extra declarations. Take the cheap, safe one.

**Deliberately left on the host, at full strength:** `border` (moving it would change the content box
by 2px and shift the toolbar-width arithmetic P5 just settled), `box-shadow` (an outer shadow drawn
by a child would be clipped by the host's `overflow: hidden`), and the `inset 0 1px 0` highlight
inside that shadow. Consequence: at low opacity a faint hairline border and drop shadow still mark
where the window is. That is defensible — arguably helpful — but it **is** a visible difference from
today and is in the smoke gate. If the user dislikes it, moving the shadow requires dropping
`overflow: hidden`, which is a larger change: **note it, do not build it.**

**Also full strength now:** content surfaces that are children rather than backdrop — `.seg-card`
tints, dividers, the toolbar's zone backgrounds. That is the intended behaviour ("content stays
readable"), not a defect, but at 20% opacity the app looks materially different from today: crisp
content floating on a nearly-invisible panel instead of the whole window fading out together.

### 7b. Contrast — what this actually buys, computed

Double-composite model, `--bg-primary` `rgba(15,15,20,0.88)` as the panel, white and black as the
bounding composite bases. Contrast of each text tier against the surface directly behind it:

| Tier | opacity | base | before | after | AA after |
|---|---|---|---|---|---|
| `--text-primary` 0.92 | 0.85 | black | 11.77 | **16.54** | pass |
| | 0.20 | black | 1.55 | **17.30** | pass |
| | 0.85 | white | 7.61 | 7.61 | pass |
| | 0.20 | white | 1.43 | 1.43 | fail |
| `--text-secondary` 0.55 | 0.85 | black | 4.73 | **6.26** | pass |
| | 0.20 | black | 1.23 | **6.26** | pass |
| | 0.85 | white | 3.90 | 3.90 | fail |
| `--text-muted` 0.5 | 1.00 | either | 4.69 / 5.34 | 4.69 / 5.34 | pass |
| | **0.85** | **black** | **4.09** | **5.33** | **pass** |
| | 0.50 | black | 2.04 | **5.31** | pass |
| | 0.20 | black | 1.20 | **5.29** | pass |
| | 0.85 | white | 3.52 | 3.52 | fail |
| | 0.20 | white | 1.22 | 1.22 | fail |

Two conclusions, and they are the whole story:

1. **Against a dark composite base the restructure is a complete fix.** Contrast becomes essentially
   *independent of the slider* — `--text-muted` holds ~5.3:1 from 100% all the way down to 20%,
   where today it collapses to 1.20:1. Every text tier clears AA at every slider position.
2. **Against a white composite base it changes nothing at all** — the before and after columns are
   identical. Fading a dark panel toward white destroys the contrast of white text no matter what the
   text's own alpha does. This is physics, not an implementation choice.

So the value of this phase depends entirely on what the panel composites against — which is
step 1 below.

Separately and unconditionally: `rgba(255,255,255,0.4)` text reaches only 3.55:1 even at full
opacity over a dark base. That is Validation Question 5's raise, and it lands here (7c).

### 7c. `--text-provisional` — raise by deletion (Validation Question 5)

`--text-provisional: rgba(255,255,255,0.4)` is defined in `:root` and **referenced zero times**. The
only place a 0.4 white currently renders as text is `.session-summary-block strong` (`main.css:1772`),
which falls through the undefined `--text-dim`'s `var()` fallback.

The user's answer was "raise it to match `--text-muted`". Since `--text-muted` is already exactly
`rgba(255,255,255,0.5)`, "matching" it makes `--text-provisional` a duplicate token. So implement the
raise as a **deletion**:

- delete `--text-provisional` from `:root`;
- rewrite `.session-summary-block strong`'s `var(--text-dim, rgba(255,255,255,0.4))` to
  `var(--text-muted)` — a deliberate 0.4 → 0.5 raise, 3.55:1 → 4.69:1 at full opacity.

The other three `--text-dim` sites are value-neutral swaps and stay in **P3 §3a**, which keeps its
"zero rendered pixels change" invariant intact. All contrast *value* changes live in this phase; P3
does representation only.

### 7d. If the window turns out to be opaque

`src-tauri/tauri.conf.json` sets `"transparent": false`, and `html, body { background: transparent }`
(`main.css:59`) with no window background configured anywhere in `src-tauri/src/`. If the window is
genuinely opaque, the desktop never composites through and the "base" is a single fixed colour — the
webview's own. In that case the whole white-base column above is hypothetical and the black-base
column is the real one. That is the good branch. Step 1 settles it.

## Related Code Files

- Modify: `src/styles/main.css` — `#overlay-view` (82-94) loses `background` + `backdrop-filter`;
  new `#overlay-view::after`; `position: relative; z-index: 1` on `#drag-region`,
  `#transcript-container`, `#resize-handle`; `:root` loses `--text-provisional`;
  `.session-summary-block strong` (1772) rewritten.
- Modify: `src/js/app.js` — line 263, `style.opacity` → `style.setProperty('--overlay-opacity', …)`.
- Create: `tests/js/overlay-opacity.test.js` — see step 6.
- Untouched: `src/index.html` (no new element), `src-tauri/**`, every other JS file.

Line numbers are `969f94e`-relative and will have shifted after P5. Re-grep before editing.

## Implementation Steps

1. **PREREQUISITE — owned by the USER, blocking, one minute.** Launch the app over a **bright**
   wallpaper, drag the opacity slider to 20%, and report which happens:
   - **Branch A — the wallpaper does NOT show through** (the panel fades toward a fixed colour).
     The composite base is fixed. Proceed; the black-base column in 7b is the real one if that fixed
     colour is dark. If it is *light*, say so — that is Branch B's arithmetic with a fixed base, and
     the same follow-up applies.
   - **Branch B — the wallpaper DOES show through.** The base is arbitrary. Proceed with the
     restructure anyway (it is correct, and it is a strict improvement over a dark wallpaper), but
     the AA claim in step 8 is the bounded one, and the follow-up in step 9 becomes live.

   **Do not guess this.** Both branches build the *same* code; only the claim and the follow-up
   differ, so implementation is never blocked — but the claim must not be written before the answer
   arrives.
2. Branch from the P5 tip.
3. Move `background` and `backdrop-filter` (both prefixed and unprefixed) from `#overlay-view` to a
   new `#overlay-view::after` per 7a. Add `border-radius: inherit`, `inset: 0`, `z-index: 0`,
   `pointer-events: none`, and `opacity: var(--overlay-opacity, 0.85)`.
4. Add `position: relative; z-index: 1` to `#drag-region`, `#transcript-container`, `#resize-handle`.
   Check `.floating-controls` (`main.css:648`) is positioned — its `z-index: 10` is inert if it is
   not — and add `position: relative` if needed.
5. Change `app.js:263` to `setProperty('--overlay-opacity', …)`. Keep the `|| 0.85` fallback.
   Confirm no other site writes `style.opacity` (`grep -rn 'style.opacity' src/js/`).
6. **7c** — delete `--text-provisional`; rewrite `.session-summary-block strong` to
   `var(--text-muted)`.
7. Add `tests/js/overlay-opacity.test.js`: drive `_applySettings` with several `overlay_opacity`
   values in jsdom and assert `#overlay-view` gets the `--overlay-opacity` custom property and
   **not** an inline `opacity`. Also assert the default lands when the setting is absent. This is the
   only part of the phase a worker can verify; it catches a regression back to element opacity.
8. Re-derive and write the AA claim from step 1's branch, into this file and into
   `plan.md` → Success Criteria. Use the computed table in 7b; do not restate the old
   "AA at ≥98% opacity" wording anywhere — it is dead.
9. **Branch B only, and only as a written follow-up — do not build it.** If the desktop composites
   through, note that AA below 100% opacity would additionally require either an opacity floor on the
   background layer (which costs the ghost-overlay look the slider exists for) or a text treatment
   that does not depend on the backdrop (e.g. a dark `text-shadow`). Both are visible changes beyond
   what the user approved. Present them; let the user decide separately.
10. `powershell.exe -NoProfile -Command "npm test"` from `/mnt/d`; then `npm run tauri build`; stat
    the exe.
11. Hand back for the smoke gate.

## Verification a Worker Can Do

- `grep -n 'style.opacity' src/js/` → empty; `grep -n 'setProperty(.--overlay-opacity' src/js/app.js`
  → one hit
- `grep -n 'backdrop-filter' src/styles/main.css` shows the overlay's pair on `::after`, not on
  `#overlay-view`
- `grep -c 'text-provisional' src/styles/main.css` → `0`
- `tests/js/overlay-opacity.test.js` green; full vitest green with no test weakened or deleted;
  `cargo test` green
- `tests/js/html-id-bindings.test.js` (from P5) still green — no HTML change expected in this phase
- Windows build artifact on disk with a fresh mtime

## Verification a Worker Cannot Do

Whether the glass still looks like glass, whether the blur still blurs, and whether the text is
actually more readable at low opacity. All three are the point of the phase, and all three need eyes
on a real Windows build.

## Smoke-Test Gate (HUMAN — blocking)

**Capture "before" screenshots first** at opacity 100%, 85% and 20%, with a session's transcript on
screen. Steps 2-4 are comparisons.

1. Launch. At the default 85% the overlay looks essentially as it did — panel, blur, border, shadow
   all present.
2. **Drag the opacity slider to 20%.** The panel goes nearly invisible **but the transcript text,
   toolbar icons and status readout stay crisp and fully legible.** This is the whole phase; if the
   text fades with the panel, it failed.
3. At 20%, confirm the glass **blur** is still doing something — content behind the panel is blurred,
   not sharp. (If the blur went inert, `::after` lost its backdrop; see 7a.)
4. Slide 20% → 100% and back. Smooth, no flicker, no repaint artefacts, no content jumping.
5. Save & Close Settings, reopen — the slider value stuck. **Fully quit and relaunch** — still stuck,
   and applied at startup before you touch anything.
6. Toolbar, transcript cards, speaker labels, the translation card's coloured border and the
   floating controls all still paint **above** the panel at every opacity — nothing disappears behind
   it, nothing is half-covered.
7. Compact mode at low opacity: hover-reveal still reveals the bar, and the revealed bar is readable.
8. Open Settings and Sessions at 20% opacity — both are unaffected by the slider, exactly as before.
9. Recovery dialog and a toast (trigger one by copying) still appear above everything.
10. Sessions ▸ open a session with a summary — bold text inside the summary block is now slightly
    brighter than before (the 7c raise). Nothing else in that block changed.

Phase closes on user confirmation of steps 1-10, with step 2 as the pass/fail criterion for the
phase's purpose.

## Success Criteria

- [ ] Smoke steps 1-10 confirmed by the user, step 2 in particular
- [ ] `grep -n 'style.opacity' src/js/` → empty; opacity reaches the DOM only as
      `--overlay-opacity`
- [ ] `#overlay-view` no longer carries `background` or `backdrop-filter`; `#overlay-view::after`
      does, with `opacity: var(--overlay-opacity, 0.85)`
- [ ] The glass blur still blurs at every slider position (human-verified, step 3)
- [ ] `--bg-*` and `backdrop-filter` **values** are byte-identical to before — only their owning
      element changed
- [ ] `--text-provisional` deleted; `.session-summary-block strong` reads `var(--text-muted)`
- [ ] `overlay_opacity` still persists across a full app restart and still applies at startup
- [ ] `tests/js/overlay-opacity.test.js` present and green; full vitest green, no test weakened or
      deleted; `cargo test` green
- [ ] Windows exe artifact verified on disk
- [ ] The AA claim in this file and in `plan.md` is rewritten from step 1's branch, with the computed
      numbers, and no "AA at ≥98% opacity" wording survives anywhere in the plan

## Risk Assessment

| Risk | Mitigation |
|---|---|
| **The blur goes inert** because something makes `#overlay-view` a backdrop root | The design deliberately avoids adding any stacking context to the host (no `isolation`, no host `z-index`), using child-lifting instead. Smoke step 3 is the check, and it is worded so a "looks fine" answer cannot mask it |
| Content ends up **behind** the background layer because a child was missed | Only four direct children exist (`#drag-region`, `#transcript-container`, `.floating-controls`, `#resize-handle`) — all four are named in step 4. Smoke step 6 walks the visible ones |
| The low-opacity look changes materially (crisp content on an invisible panel, plus a still-visible border and shadow) | **Intended**, and the direct consequence of the user's decision. Called out in 7a and in smoke steps 1-2 so it is confirmed, not discovered |
| The restructure buys nothing because the composite base is light | Exactly what step 1 determines. Both branches are pre-written so implementation is never blocked; the *claim* waits for the answer |
| Regression back to element opacity in a later edit | `tests/js/overlay-opacity.test.js` asserts the absence of inline `opacity`, so it fails loudly |
| P3 tokenizes the old `#overlay-view` rules | P7 runs **before** P3, and P3 already re-derives its census from the immediately preceding tip |
| `-webkit-backdrop-filter` dropped during the move | Both prefixed and unprefixed forms are named explicitly in step 3 |

**Rollback**: three independent hunks — the CSS layer move, the one-line `app.js` change, and the 7c
token change. Reverting the CSS and JS together restores group opacity exactly; the test file is
additive and deletes on its own. No schema change, no persisted-state change, no ID change, no HTML
change.
