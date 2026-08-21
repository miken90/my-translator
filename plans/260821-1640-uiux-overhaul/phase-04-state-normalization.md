---
phase: 4
title: "Interaction State Normalization"
status: pending
priority: P2
effort: "4-6h"
dependencies: [3]
---

# Phase 4: Interaction State Normalization

## Overview

Make every interactive control behave the same way in every state. Today: keyboard focus is
**invisible everywhere** (`:focus-visible` count in the whole app = 0, and four rules actively set
`outline: none` with no replacement), disabled is expressed two contradictory ways, the scrollbar
rule-set is copy-pasted five times, and no toggle reports its state to assistive tech.

Depends on Phase 3 — the focus ring, the shared scrollbar rule and the disabled treatment are all
written against P3's tokens.

## Requirements

- Functional: tabbing through the overlay, Settings and Sessions views shows a visible focus ring on
  every interactive control, and the ring is never clipped by an ancestor.
- Functional: disabled controls are inert, look inert, and are skipped by Tab — one mechanism, not
  two.
- Functional: pin, TTS and compact report pressed state; the source picker reports which of the
  three is selected.
- Non-functional: exactly one `::-webkit-scrollbar` rule-set in the file.
- Constraint: **no behaviour change.** A control that was clickable stays clickable; a control that
  was blocked stays blocked.
- Constraint: minimal ARIA only. No `role="toolbar"`, no landmarks, no live regions. The user
  explicitly rejected a11y theatre; correctness for the two real patterns is the bar.

## Architecture

### 4a. Focus ring

Zero `:focus-visible` rules exist. Four rules kill the default outline with nothing in its place:
`.color-dot` (~724), the grouped `input[type="text"], input[type="password"]` (~1118 — **both**
types, not just password), `select` (~1141), `input[type="range"]` (~1232). Inputs and selects have
a `:focus` border-colour change; buttons have nothing at all.

**The shared rule alone does not fix three of those four.** `:where()` pins the new rule at
specificity `(0,1,0)`, and it is added near the top of the file:

| Existing rule | Specificity | vs `:where(…):focus-visible` `(0,1,0)` | Result if only the shared rule is added |
|---|---|---|---|
| `.color-dot` (724) | `(0,1,0)` | tie → **later in source wins**, and 724 is after the new rule | `outline: none` wins — **still no ring** |
| `input[type="text"], input[type="password"]` (1118) | `(0,2,0)` | higher | `outline: none` wins — **still no ring, both types** |
| `input[type="range"]` (1232) | `(0,2,0)` | higher | `outline: none` wins — **still no ring** |
| `select` (1141) | `(0,0,1)` | lower | new rule wins — ring appears |

So **deleting the `outline: none` declaration from those four rules is a mandatory build step**, not
a tidy-up. It is step 3 below. Deleting the declaration is safe: it only ever suppressed the browser
default, which `:focus-visible` now replaces deliberately.

Ring colour is **solid `--accent` (`#638cff`)**, not `--border-focus`. Measured against the panel:
`--border-focus` (`rgba(99,140,255,0.5)`) reaches only **2.16-2.36 : 1**, failing WCAG SC 1.4.11's
3:1 non-text-contrast floor; solid `--accent` reaches **4.46-5.70 : 1**
(`plans/reports/researcher-260821-1642-contrast-tokens-reskin.md`).

```css
:where(button, input, select, textarea, [role="radio"], a[href]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- `outline`, not `box-shadow`: it does not affect layout, and it survives Windows High Contrast
  mode, which drops `box-shadow` entirely.
- `outline-offset: 2px` keeps the ring clear of the translucent panel edge and its
  `backdrop-filter` bleed.
- `outline` follows `border-radius` in Chromium since Chrome 94, so rounded buttons get a rounded
  ring — safe for a current WebView2 runtime.
- `:where()` keeps specificity at 0. That is a **liability** here, not a feature — it is exactly
  why step 3's deletion is mandatory. It is chosen so the rule sits below any deliberate
  per-component focus treatment added later, not so existing `outline: none` rules can beat it.

**Clipping.** `#overlay-view`, `.sessions-body`, `.session-scroll-region` and `.qa-messages` are all
`overflow: hidden`/`auto`. A 2px outline at 2px offset on a control flush against one of those edges
will be cut. Step 4 below enumerates the at-risk controls and, for those only, swaps to an inset
ring (`outline-offset: -2px`) so the ring draws inside the control's own box. This is the one place
the recipe varies, and the keyboard smoke pass is what proves it.

**Before building, re-grep for `overflow` on `.toolbar-zone*`.** P5 runs first, and an earlier draft
of it would have added `overflow: hidden` to the transport and transcript zones. The zones have zero
padding, so their clip box is exactly their children's bounding box — that would have clipped this
ring on all four sides for 9 of the 14 toolbar buttons, and clipped `.action-btn:hover`'s
`box-shadow: 0 0 12px var(--accent-glow)` (`main.css:427-430`) at every width. P5 was corrected to
not do it; confirm it stayed corrected before relying on the `+2px` offset in the toolbar.

### 4b. One disabled convention

| Site | Today | After |
|---|---|---|
| `#btn-tts` | `.tts-action-btn.disabled` class (`main.css:231`) with `pointer-events: none`, toggled by `tts-controller.js:146` `classList.toggle('disabled', isTwoWay)` | `btn.disabled = isTwoWay`; CSS keyed on `:disabled` |
| `#btn-session-summarize`, `#qa-ask`, `#qa-input` | already the `disabled` property (`session-manager.js:398/404/405/425/461/546/561`) | unchanged |
| `.session-copy-btn:disabled` (1782), `.qa-input-row input:disabled` | already `:disabled` | folded into the shared rule |
| `.session-copy-btn:disabled:hover` (1787-1790) | neutralises `.session-copy-btn:hover` (1697-1700) so a disabled Copy/Export/Summary button does not light up under the cursor | **KEEP — do not fold.** The shared `button:disabled` rule sets `opacity`/`cursor` only; it does not stop the `:hover` background and colour change. Dropping this rule makes disabled buttons look interactive on mouse-over. |

Standardise on the **`disabled` property**. It is what most of the app already uses, and unlike
`pointer-events: none` it also removes the control from the tab order — which matters now that
focus is visible. One shared rule:

```css
button:disabled, input:disabled, select:disabled, textarea:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

`.tts-action-btn.disabled`'s `opacity: 0.35` becomes `0.4` — a 0.05 alpha change on one button in
one state. Called out here rather than buried; if the user wants it byte-exact, keep a
`.tts-action-btn:disabled { opacity: 0.35 }` override.

### 4c. One scrollbar rule-set

Five duplicated sets at `969f94e`: `#transcript-container` (467-483), `.settings-body` (883-894),
`.sessions-body` (1557-1568), `.session-scroll-region` (1711-1722), `.qa-messages` (1834-1845).
Only `#transcript-container` has a `:hover` thumb rule; the other four silently lack it.

**Verified at `969f94e`: all five sets are byte-identical** — `width: 4px`, track `transparent`,
thumb `rgba(255,255,255,0.1)` with `border-radius: 2px`. The *only* difference is that
`#transcript-container` additionally has
`::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2) }` and the other four do not.
So the consolidation is value-safe; re-confirm with a diff at implementation time in case P3 or P5
moved something.

```css
#transcript-container, .settings-body, .sessions-body,
.session-scroll-region, .qa-messages { /* ::-webkit-scrollbar, -track, -thumb, -thumb:hover */ }
```

Net effect for the user: four scrollbars gain the hover highlight they were missing. That is a
visible change, and an intended one.

### 4d. Minimal ARIA

The app currently has **zero** `aria-*` attributes. Additive, not a migration.

| Control | Pattern | Wiring |
|---|---|---|
| `#btn-pin` | `aria-pressed` | `window-manager.js:63`, beside the existing `classList.toggle('active')` |
| `#btn-tts` | `aria-pressed` | `tts-controller.js:145`, beside `classList.toggle('active')` |
| `#btn-compact` | `aria-pressed` | `window-manager.js` `toggleCompact()` — note it currently sets **no** class on the button at all, so this also gives compact mode the visual `.active` state pin and TTS already have |
| `.source-controls` + 3 buttons | `role="radiogroup"` on the wrapper; `role="radio"` + `aria-checked` on each button | `app.js:305`, beside `classList.toggle('active', …)` |

`aria-pressed` for the three independent binary toggles and `radiogroup`/`radio` for the
select-one-of-three picker are the ARIA APG patterns for exactly these two shapes. Accessible names
come from the existing `title` attributes and must **not** change when state flips (APG rule): keep
"Pin on top", not "Pinned"/"Unpin".

### 4e. Toolbar icon work — APPROVED

Two items from the accepted counsel's toolbar section that P2 left unbuilt. The user has since
approved both (Validation Question 3):

1. **Icon sizes.** "Normalize icon sizes (16px zone-primary, 14px rest)". Toolbar SVGs today:
   18px ×1 (settings), 16px ×3, 16×14 ×1 (the "both" source icon, `viewBox="0 0 28 24"` — the
   16:14 box does not match the 28:24 viewBox, so it renders slightly squashed), 14px ×3, 13px ×10.
2. **Sessions icon metaphor.** "Sessions = clock icon (reads as history/timer)" — still true:
   `#btn-sessions` is a circle plus clock hands (`src/index.html:110-112`). The counsel asked for a
   list / document-stack glyph.

Both are real visible changes and both are approved. Apply: **16px** for the zone-primary control in
each zone (settings, start, the first transcript icon, close), **14px** for the rest; correct the
non-square icon so its box matches its `viewBox` aspect; replace the clock paths with a
list/document-stack glyph. **Element IDs, classes and DOM positions stay unchanged** — only
`width`/`height` attributes and the geometry inside `#btn-sessions` change.

### 4f. Hit targets — deliberately NOT in scope

Toolbar controls are already ≥28px (`.icon-btn` 32, `.source-btn` 28, `.action-btn` 30,
`.tts-action-btn` 30), so the counsel's "≥28px" is already satisfied where it was approved.

Outside the toolbar, five controls are under 28px: `.float-btn` 26 (675), `.session-copy-btn` 26
(1683), `.btn-icon-sm` 24 (944), `.term-row .btn-remove-term` 22 (973),
`.general-row .btn-remove-general` 22 (1009). Raising them relayouts the Settings panel and the
session-viewer header. **User decision (final): leave them.** Not in scope here, and not deferred to
a later phase either — do not raise them.

## Related Code Files

- Modify: `src/styles/main.css` — shared `:focus-visible`, shared `:disabled`, one scrollbar
  rule-set; delete the four bare `outline: none` rules' now-redundant halves; `#btn-compact.active`.
- Modify: `src/index.html` — `role`/`aria-checked` on `.source-controls` and its three buttons;
  initial `aria-pressed="false"` on `#btn-pin` / `#btn-tts` / `#btn-compact`
  (`#btn-pin` starts `true` — it ships pinned, `window-manager.js:8`).
- Modify: `src/js/window-manager.js` — `aria-pressed` on pin and compact; `.active` class on compact.
- Modify: `src/js/tts-controller.js` — `aria-pressed`; `.disabled` class → `disabled` property.
- Modify: `src/js/app.js` — `aria-checked` on the source picker.
- Create: `tests/js/toggle-state.test.js`. **Verified: no existing test references any toolbar ID**
  (`grep -n "btn-tts\|btn-pin\|btn-compact\|btn-source" tests/js/*.js` → empty), so this phase's JS
  changes currently have *zero* automated coverage. A small jsdom test asserting that toggling pin /
  TTS / compact sets both the `.active` class **and** `aria-pressed`, and that the source picker
  sets `aria-checked` on exactly one of three, is cheap and is the only worker-verifiable gate this
  phase has. **Do not weaken or delete any existing test.**

Line numbers are `969f94e`-relative and will have shifted after P5 and P3. Re-grep.

## Implementation Steps

1. Branch from the P3 tip.
2. Add the `:where(...):focus-visible` rule near the top of `main.css` (base section, before the
   view sections) so per-component rules can override it.
3. **Delete the `outline: none` declaration from all four rules that carry it** — `.color-dot`
   (~724), `input[type="text"], input[type="password"]` (~1118), `select` (~1141),
   `input[type="range"]` (~1232). Without this, three of the four keep winning the cascade and stay
   ring-less (specificity table in 4a). Afterwards
   `grep -n 'outline: none' src/styles/main.css` must return **nothing**.
4. Enumerate at-risk controls: any control whose box touches an `overflow: hidden`/`auto` edge, or
   sits in a container whose padding is smaller than the 2px offset plus the 2px ring —
   `#btn-close` and `#btn-settings` at the bar's ends, the `.session-copy-btn` group in the viewer
   header, the Q&A input row, `.float-btn`, and `.color-dot` (a 16px circle in a tight row).
   Give **those** `outline-offset: -2px`. Everything else keeps `+2px`.
5. Add the shared `:disabled` rule; convert `tts-controller.js:146` to the `disabled` property;
   delete `.tts-action-btn.disabled`. **Keep `.session-copy-btn:disabled:hover`** (4b). Decide the
   `0.35` vs `0.4` opacity question (4b) and record it.
6. Collapse the five scrollbar rule-sets into one after diffing their declared values; report any
   value that was not identical.
7. Add the ARIA attributes and their JS wiring (4d). Give `#btn-compact` the `.active` class it
   never had.
8. **4e** — normalize toolbar icon sizes and swap the sessions clock glyph for a list glyph.
9. ID-parity grep (no ID changes are expected in this phase; prove it).
10. `powershell.exe -NoProfile -Command "npm test"` from `/mnt/d`; then `npm run tauri build`; stat
   the exe.
11. Hand back for the keyboard smoke gate.

## Verification a Worker Can Do

- `grep -c ':focus-visible' src/styles/main.css` ≥ 1 **and** `grep -c 'outline: none' src/styles/main.css` → `0`
- `grep -c 'webkit-scrollbar' src/styles/main.css` down from 16 selectors to 4
- `grep -rn 'app-region\|classList\.\(add\|remove\|toggle\)(.disabled.' src/ | wc -l` → `0`
  (`grep -c -r` on a directory prints a count *per file*, not a total — it cannot be checked as `0`)
- `grep -c 'aria-' src/index.html` > 0
- `grep -n 'overflow' src/styles/main.css | grep toolbar-zone` → empty (P5's corrected state held)
- ID-parity grep clean. It surfaces six pre-existing JS-only IDs — `check-tts-enabled`,
  `hint-mode-local`, `link-elevenlabs`, `range-tts-speed`, `tts-settings-detail`, `tts-speed-value`,
  all in `settings-form-controller.js`, all `?.`- or `if (el)`-guarded. Expected; do not chase them.
  `tests/js/html-id-bindings.test.js` (added in P5) holds them in its `KNOWN_DEAD` array
- `tests/js/html-id-bindings.test.js` (from P5) green — this is what actually catches a broken
  `index.html` edit in this phase
- Full vitest green, no test weakened or deleted; `cargo test` green
- Windows build artifact on disk

## Verification a Worker Cannot Do

Whether the focus ring is actually visible, actually unclipped, and actually lands in a sensible
tab order. That is the whole point of this phase and only a human at the keyboard can confirm it.

Note also that **`npm test` cannot see an ARIA wiring mistake in `src/index.html` on its own** — no
test read that file until P5 added `tests/js/html-id-bindings.test.js`, and even that only checks id
resolution, not attributes. The new `tests/js/toggle-state.test.js` covers the JS side; the human
gate covers the rest.

## Smoke-Test Gate (HUMAN — blocking)

A keyboard pass, plus the disabled and scrollbar checks.

1. Overlay, mouse untouched: press Tab repeatedly from a cold start. Every control — settings, the
   three source buttons, start, TTS, copy, export, sessions, clear, compact, pin, minimize, close —
   shows a clearly visible blue ring, and **no ring is cut off** at the left or right window edge.
2. Space/Enter on a focused control activates it, same as clicking.
3. Click a button with the mouse — the ring must **not** appear (that is `:focus-visible` doing its
   job; a ring on mouse click means the rule is wrong).
4. Settings view: Tab through every tab, field, slider, colour dot and select. Ring visible on all,
   including the range sliders and colour dots that previously had `outline: none`.
5. Sessions view: Tab through the list, into a session, through the viewer header and the Q&A input.
   Ring never clipped by the panel edge.
6. Switch to two-way translation mode — the TTS button goes inert and **Tab now skips it**. Switch
   back — it is focusable again.
7. Open a session with no AI endpoint configured — Summary and the Q&A ask button look and behave
   disabled, Tab skips them, and **hovering them with the mouse does nothing** (no background or
   colour change).
8. Hover the thumb of each scrollbar — transcript, Settings body, Sessions list, session viewer,
   Q&A — all five now highlight on hover (four of them are new).
9. Toggle pin, TTS and compact. Compact now visibly shows an active state on its button like pin and
   TTS do.
10. Toolbar icons look evenly weighted, nothing looks squashed, and the Sessions button reads as a
    list/document rather than a clock. Click it — it still opens the Sessions view.

Phase closes on user confirmation of steps 1-10.

## Success Criteria

- [ ] Smoke steps 1-10 confirmed by the user
- [ ] Toolbar icons normalized (16px zone-primary / 14px rest), no squashed icon, Sessions shows a
      list glyph — every element ID unchanged
- [ ] A visible `:focus-visible` ring on every interactive control in all three views, never clipped
- [ ] Zero `outline: none` declarations remain in `src/styles/main.css`
- [ ] `.session-copy-btn:disabled:hover` still present — disabled viewer buttons do not react to hover
- [ ] Ring colour is solid `--accent` (pre-computed at 4.46-5.70 : 1 against the panel, clearing
      SC 1.4.11's 3:1 — this is a code check, `grep` for `outline: 2px solid var(--accent)`, **not**
      something the human gate can eyeball)
- [ ] Exactly one `::-webkit-scrollbar` rule-set; all five scrollers share it including `:hover`
- [ ] One disabled mechanism (`disabled` property); `.tts-action-btn.disabled` gone; no
      `pointer-events: none` used to disable a control
- [ ] `aria-pressed` on pin / TTS / compact; `role="radiogroup"` + `aria-checked` on the source picker
- [ ] Accessible names unchanged when state flips
- [ ] Full vitest green with no test weakened or deleted; `cargo test` green
- [ ] Windows exe artifact verified on disk

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Focus ring clipped by `overflow: hidden` on `#overlay-view` and the scrollers | Step 3's per-control inset-ring list; smoke steps 1 and 5 are the gate |
| `:focus-visible` mis-fires on mouse click, adding a ring users read as a bug | Smoke step 3 explicitly tests for its absence. No known Chromium `<button>` quirk here; the one documented quirk is `<select>`-specific |
| Converting `#btn-tts` to the `disabled` property changes the feedback-loop guard's behaviour in two-way mode | `disabled` blocks activation at least as strictly as `pointer-events: none`, and additionally removes it from tab order. Smoke step 6 verifies both directions of the toggle |
| Collapsing scrollbar rules silently changes one scroller's width or colour | Step 5 requires diffing declared values before collapsing and reporting any that differed |
| ARIA attributes drift out of sync with the `.active` class (two sources of truth) | Set both on the same line in the same handler; every wiring site is listed in 4d |
| `:where()` zero-specificity rule loses the cascade to the existing `outline: none` rules — **confirmed by specificity math for 3 of 4** | Step 3 deletes all four; the `grep -c 'outline: none'` → `0` check is a success criterion, and smoke steps 1 and 4 cover the affected controls (colour dots, text/password inputs, range sliders) explicitly |
| Folding `.session-copy-btn:disabled:hover` into the shared rule makes disabled viewer buttons light up on hover | Explicitly kept in 4b; smoke step 7 hovers a disabled Summary button |
| Icon-size and glyph edits touch SVG markup inside buttons that JS binds by id | Only `width`/`height` attributes and inner path geometry change; no id, class or DOM position moves. `tests/js/html-id-bindings.test.js` (from P5) catches an accidental id loss, and smoke step 10 confirms the Sessions button still works |
| Scope creep into hit targets | 4f is a final user decision to leave them alone |

**Rollback**: revert per step group. 4a/4b/4c are `main.css`-only. 4d touches three JS files plus
`index.html` and reverts independently. No schema, no persisted state, no IDs changed.
