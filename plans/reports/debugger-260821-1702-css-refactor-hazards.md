# CSS Refactor Hazard Review — Phase 3 (tokens) + Phase 4 (state normalization)

Target: `src/styles/main.css` (1892 ln), `src/index.html` (808 ln) @ 969f94e. Static analysis only, read-only.

## 1. Scrollbar consolidation (Phase 4c)

Pasted, declaration by declaration:

```
#transcript-container (467-482):
  ::-webkit-scrollbar        { width: 4px; }
  ::-webkit-scrollbar-track  { background: transparent; }
  ::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.1); border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }   <-- ONLY ONE with :hover

.settings-body (883-894):        width 4px / transparent / rgba(255,255,255,0.1)+2px  — no :hover
.sessions-body (1557-1568):      width 4px / transparent / rgba(255,255,255,0.1)+2px  — no :hover
.session-scroll-region (1711-1722): width 4px / transparent / rgba(255,255,255,0.1)+2px — no :hover
.qa-messages (1834-1845):        width 4px / transparent / rgba(255,255,255,0.1)+2px  — no :hover
```

**All 5 sets are byte-identical** on width/track/thumb. Zero divergent values found (no set uses a
different width or colour). Only difference: `#transcript-container` alone has the `:hover` thumb
rule. Plan's own description ("Only #transcript-container has a :hover thumb rule") is accurate.

PASS — plan's assumption holds. Collapse is mechanically safe. Net visible change = 4 scrollers gain
hover highlight, which the plan explicitly calls out as intended (not a hidden side effect).

One non-issue worth recording: `#session-viewer` (src/index.html:712) carries `class="sessions-body"`
so `.sessions-body::-webkit-scrollbar` matches it too, but `#session-viewer{overflow:hidden}`
(main.css:1654-1657, ID beats class) suppresses any visible scrollbar there — dead match, no bug,
unaffected by the consolidation.

Severity: none (informational). No fix needed.

## 2. `:focus-visible` zero-specificity rule (Phase 4a) — BLOCKER

Specificity of `:where(button, input, select, textarea, [role="radio"], a[href]):focus-visible` =
`(0,1,0)` — `:where()` contributes 0, the trailing `:focus-visible` pseudo-class outside it still
counts as 1 class-level selector.

Four existing `outline: none` rules (grep confirms exactly these 4, no 5th):

| Rule | Line | Specificity | vs new rule (0,1,0) | Outcome if old rule not deleted |
|---|---|---|---|---|
| `.color-dot` | 724 | `(0,1,0)` | **tie** | later source wins → **`.color-dot` wins (it's declared after)** → ring dead |
| `input[type="text"], input[type="password"]` | 1118 | `(0,1,1)` | higher | **always wins regardless of order** → ring dead on BOTH text and password inputs |
| `select` | 1141 | `(0,0,1)` | lower | new rule already wins **without any deletion needed** |
| `input[type="range"]` | 1232 | `(0,1,1)` | higher | **always wins** → ring dead |

Evidence (main.css:1108-1120):
```css
input[type="text"],
input[type="password"] {
  ...
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
```
Plan's phase-04 doc (4a) lists only `input[type="password"]` (~1118) as one of the four culprits —
it misses that `input[type="text"]` shares the exact same rule and is equally affected. Not a
functional gap (both element types are covered by the generic `input` in the new `:where()` list so
both need the same fix), but the plan's own inventory undercounts by one control type.

**Root cause of the blocker**: Implementation Steps 1-10 in phase-04-state-normalization.md never
contain an explicit numbered step "delete the four `outline: none` declarations." That instruction
exists ONLY in the "Related Code Files" bullet ("delete the four bare outline: none rules'
now-redundant halves") and in the Risk table ("Verify no outline: none remains that is not paired
with a :focus-visible replacement" — phrased as a *verification* check, not a build step). A worker
following the numbered Implementation Steps literally can ship the new `:where()` rule, run the
smoke gate on inputs that happen to look fine (select — the one where the new rule already wins),
and miss that `.color-dot`, text/password inputs, and range inputs are silently still ring-less,
because those are exactly the ones the plan lists as "at risk" and easy to skip if the deletion
isn't an explicit checklist line.

Also checked: `input[type="text"]:focus` / `input[type="password"]:focus` (1122-1126) and
`select:focus` (1152) only set `border-color`/`box-shadow`, not `outline` — no additional conflict
beyond the 4 above.

Fix: turn the Risk-table note into Implementation Step 2.5 — explicitly: "delete `outline: none` at
lines 724, 1118 (both input types), 1232; leave `select`'s alone or delete it too for consistency (no
functional difference since the new rule already wins there)." Then re-verify with
`grep -n "outline: none" src/styles/main.css` returns nothing outside `input[type=range]::-webkit-slider-thumb`-style vendor resets (none exist here).

Also checked per your ask:
- `pointer-events: none` sites: `.tts-action-btn.disabled` (233, being deleted anyway), `.status-area`
  (298 — no focusable descendants, just spans, non-issue), `.toast` (1361 — not focusable, non-issue).
- Overflow-clipping ancestors: `#overlay-view` (93, overflow:hidden), `#session-viewer`/`.sessions-body`
  variants (1655/879), `.session-scroll-region` (1708), `.qa-messages` (1827 overflow-y:auto),
  `#transcript-container` (461). Toolbar buttons (`#btn-settings`, `#btn-close`) sit inside
  `.control-bar { padding: 0 8px }` (108) — 8px clearance is ample for a 2px-offset/2px-wide ring
  (4px total reach); **not actually at risk** despite being named in the plan's 4a clipping list.
  Real risk is narrower: `.font-controls`/`.color-controls` (padding 2-4px, main.css:668-671,
  707-713) hold 26px/16px buttons with only 2-4px gap — a `+2px` outline-offset ring there can visibly
  collide with the sibling control or the small container padding. Plan's Step 3 "enumerate at-risk
  controls" doesn't name `.float-btn`/`.color-dot` for inset-ring treatment even though they sit in
  the tightest-padded containers in the file — worth adding to the inset-ring list alongside
  `.float-btn` (which IS already named).

Severity: **BLOCKER** (silent no-op on 3 of 4 target controls if the deletion step is skipped, which
the plan's own step numbering makes easy to skip) — but trivially fixable by promoting the deletion
from a risk-table footnote to a numbered step.

## 3. `:disabled` unification (Phase 4b)

Checked every disable mechanism in src/index.html and src/js/*.js:

- `#btn-tts`: only site using class+`pointer-events:none` (`.tts-action-btn.disabled`, main.css:231-235,
  toggled by tts-controller.js:146 `classList.toggle('disabled', isTwoWay)`).
- Everything else (`summarizeBtn`, `qaAskBtn`, `qaInput`, session-manager.js:398/404/405/425/461/546/561)
  already uses the native `disabled` property.
- No `<select>` is ever disabled anywhere in the app today (grep confirms zero `select.disabled`
  assignments and no `disabled` attribute in index.html) — the shared rule's `select:disabled` clause
  is inert now, pure future-proofing, zero current visual effect. PASS.
- Grepped for `classList.contains('disabled')` and any read of the class anywhere in `src/js` — **zero
  hits**. Nothing reads the class for logic; it is purely a CSS hook. Converting to the `disabled`
  property does not break any JS branch that depends on `classList`. PASS on the plan's own risk item.

**Real behavior nuance the plan self-documents but is worth confirming precisely** — verified via
tts-controller.js:78-119 and app.js:209: the global Ctrl+T shortcut (`'t': () =>
this.ttsController.toggle()`, app.js:209) calls `toggle()` **directly**, bypassing the button element
entirely. `toggle()` has its own independent two-way guard (tts-controller.js:83-87, shows a toast and
returns). This guard is unaffected by whether `#btn-tts` is `pointer-events:none` or native `disabled`
— Ctrl+T behavior is **identical before and after** the 4b change. PASS — confirms plan's claim that
"disabled blocks activation at least as strictly."

The one path that DOES change: mouse-click was already blocked by `pointer-events:none` (click event
never dispatched), but Tab+Enter on the old CSS-only-disabled button WAS possible (pointer-events
doesn't remove tab order) and would trigger `toggle()`'s internal guard, showing the "disabled in
two-way mode" toast. After switching to the native `disabled` property, the button leaves the tab
order entirely and Enter/Space never fires a click — so a keyboard user tabbing through in two-way
mode gets **no toast anymore** for this specific path (Ctrl+T still gives the toast; only
Tab-to-button-then-Enter loses it). This is exactly what the plan's own risk table and smoke step 6
anticipate ("Tab now skips it") — self-aware, not a blind spot. Severity: minor, already covered by
plan's smoke gate.

**Real gap found — `.session-copy-btn:disabled:hover` (main.css:1787-1790) is not accounted for**:

```css
.session-copy-btn:disabled        { opacity: 0.4; cursor: not-allowed; }     /* 1782-1785 */
.session-copy-btn:disabled:hover  { background: rgba(255,255,255,0.05); color: var(--text-secondary); }  /* 1787-1790 */
```

Phase-04's 4b table says `.session-copy-btn:disabled` is "already `:disabled` ... folded into the
shared rule" — it names only the base `:disabled` rule, never the `:disabled:hover` override. If a
worker deletes both because "already disabled" reads as "already covered," the disabled-hover
override disappears. Consequence: `.session-copy-btn:hover` (main.css:1697-1700, specificity
`(0,2,0)`) sets `background: rgba(255,255,255,0.1); color: var(--text-primary);` — properties
disjoint from the shared `button:disabled`'s `opacity`/`cursor` (no cascade conflict, both apply). On
mouse-over a disabled Summary/Export/Copy button (e.g. no AI endpoint configured,
session-manager.js:398), the button would go bright/hover-styled while still being `opacity:0.4` —
looks interactive when it is inert. Chromium still matches `:hover` on native-disabled buttons (hover
tracks cursor geometry, not interactivity), so this is a real rendering path, not theoretical.

Fix: keep `.session-copy-btn:disabled:hover` (or fold its two declarations into the shared rule as
`button:disabled:hover, input:disabled:hover, select:disabled:hover, textarea:disabled:hover { background: inherit; color: inherit; }`-style guard, but simplest is just retain the existing override verbatim).

Severity: **MAJOR** (visible interaction bug on 3 buttons in Sessions view if the override is dropped
during the "fold" — easy to miss since the plan's Related-Code-Files table lumps it under "already
:disabled").

`.qa-input-row input:disabled` (1890-1892) has no analogous `:hover` override and no divergent value
— safe to fold as-is. PASS.

## 4. Token swap hazards (Phase 3b/3c)

- **`box-shadow` shorthand containing a swap target**: `#overlay-view` (89-92):
  ```css
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 2px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  ```
  `rgba(255, 255, 255, 0.04)` here is one of the plan's 8 `--surface-1` sites — confirmed by grep,
  exactly 8 hits total including this one (lines 92, 375, 504, 591, 1179, 1755, 1863, 1882). Plan's
  "×8" count is accurate and already includes this shorthand occurrence — not an oversight. `var()`
  substitutes fine inside a comma-separated `box-shadow` shorthand in Chromium/WebView2. PASS, no
  breakage, but flag that the plan's table doesn't call out *where* this occurrence lives (worth a
  one-line note in the PR so reviewers aren't surprised to see `var()` inside a shorthand).
  `rgba(255,255,255,0.05)` → `--surface-2`: exactly 5 hits confirmed (202, 1073, 1629, 1687, 1788),
  matches plan's "×5" claim exactly. PASS.

- **`data:image/svg+xml` URL colour literal**: main.css:1145, the global `select` background-image,
  contains `stroke='%23888'`. This is **percent-encoded** (`%23` = `#`), not a literal `#` character —
  a regex hunting for `#[0-9a-f]{3,6}` will NOT match it (no bare `#` in the string). Confirmed by
  grep: the raw text is `%23888`, never `#888`. PASS — ruled out. The guard test's rule 3 ("no raw
  colour literal outside :root") will not false-flag this line, and no sweep in the plan's token
  table targets `#888` at all.

- **`!important`**: confirmed exactly one cluster worth noting, `.shortcut-hint` (500-509):
  `font-size: 11px !important` (501), `color: var(--text-muted) !important` (502, already a token,
  untouched), `padding: 2px 10px !important` (505). `background: rgba(255,255,255,0.04)` at line 504
  is NOT `!important` and is one of the 8 `--surface-1` swap sites — swapping it is unaffected by the
  sibling `!important` declarations (different property). Also `.save-btn-top`/`:hover` (1089-1096)
  use `!important` on `color`/`background`, both already tokens or untouched literals. PASS — no
  `!important` collides with a planned swap.

- **`@keyframes` literals**: `recordPulse` (445-455) contains `rgba(248,113,113,0.3)` and
  `rgba(248,113,113,0.2)` — these ARE colour literals inside a keyframe, but the plan's own allowlist
  (3b) explicitly keeps `rgba(248,113,113,*)` as literal/allowlisted, so no swap is attempted here.
  PASS — correctly out of scope, not silently missed.
  `pulse`, `wave`, `blink`, `fadeInUp`, `viewFadeIn` keyframes: no colour literals, only opacity/height/
  transform. PASS.

- **`@media` blocks**: none exist in the file (`grep -c "@media"` = 0). N/A — no hazard surface here.

- **Spacing/type scale collision (Phase 3c)**: the plan's own Step 4 warns "a 16px that is a
  line-height, border-radius, width, height, or SVG size is not spacing." Confirmed this warning is
  necessary, not paranoia — `16px` alone appears as: `height`/`width` (183, 717-718), `padding`
  shorthand (463, 584, 1330, 1357), `gap` (518), `font-size` (581, 949, 1480), `margin-bottom` (901),
  `padding-bottom` (1046). `12px` appears as `font-size` (many), `padding` (many), AND as a
  **box-shadow blur radius** (429: `0 0 12px var(--accent-glow)`; 1344: `0 4px 12px rgba(99,140,255,0.25)`)
  — box-shadow blur radius is **not in the plan's named exception list** (line-height/border-radius/
  width/height/SVG size), so a worker relying only on that list (rather than reading every property
  name as instructed) could tokenize a shadow blur as `--space-*`/`--font-size-*` incorrectly, though
  it would still be *byte-identical* value-wise (harmless numerically) but semantically wrong (a
  `--space-lg` token used for a blur radius desyncs from future spacing-scale changes). Same issue at
  `10px`: also used for `background-position: right 10px center` (1147, a select-arrow offset — not
  spacing/typography at all) and `backdrop-filter: blur(10px)` (1368, toast blur radius). **Fix**:
  extend the plan's exception list explicitly to include box-shadow blur/spread values, backdrop-filter
  blur radii, and background-position offsets before Step 4 executes.
  Severity: **MINOR** (the mandated manual per-hit review, if actually followed, still catches these;
  this is a documentation-completeness gap in the exception list, not a mechanical certainty of
  breakage — but exactly the kind of thing that gets rubber-stamped mid-sweep).

## 5. Group opacity + `backdrop-filter` interactions (z-index tokens)

`backdrop-filter` rules: `#overlay-view` (87-88), `#settings-view` (848-849), `#sessions-view`
(1520-1521), `.toast` (1368), `.modal-overlay` (1407-1408). Each creates its own stacking context
(backdrop-filter, like filter, always establishes one, per spec). `#settings-view`/`#sessions-view`/
`#overlay-view` are mutually exclusive siblings via `.view.active` (only one has `display:flex` at a
time; `display:none` removes the others from the render/stacking tree) — they never actually
composite against each other, so no reordering risk between them regardless of any z-index change.

`#overlay-view`'s inline `opacity` (app.js:263, default 0.85, no explicit `z-index` on the element
itself) additionally creates its own stacking context (CSS opacity < 1 always creates one, spec
"Adding Transparency to Elements"). This is **pre-existing shipped behavior** (v0.6.0), not something
Phase 3 introduces. Because `#overlay-view` carries no `z-index` property, its position in its
*parent's* stacking order is plain DOM order (auto), same as before. Its own descendants' z-index
values (`.floating-controls` 10, `.compact-mode::before` 100, the compact-reveal bar 99) are scoped
**inside** that local stacking context and can never escape above the box `#overlay-view` occupies in
the root context — so `.toast`/`.modal-overlay` at `z-index: 1000` (root-context siblings, both also
independently establishing their own stacking contexts via `position: fixed` + z-index) will always
paint above the entire overlay subtree, regardless of what the tokenized z-index values resolve to,
**because the token values are required to be byte-identical to the originals** (10/99/100/1000
unchanged — confirmed by grep against main.css: 655, 280, 270, 1364, 1412 match the plan's table
exactly). PASS — renaming these to `var(--z-*)` with unchanged numeric values cannot reorder anything;
the opacity-driven stacking context is orthogonal to the token rename and was never dependent on
these specific values in the first place.

## Summary of PASS vs hazard

| # | Area | Verdict |
|---|---|---|
| 1 | Scrollbar consolidation | PASS — declarations identical, safe to merge |
| 2 | `:focus-visible` zero-specificity rule | **BLOCKER** — 3 of 4 named controls (`.color-dot`, text+password inputs, range) will keep their old `outline: none` and stay ring-less unless deletion is made an explicit build step, not a risk-table footnote |
| 3 | `:disabled` unification | PASS on JS-read risk and Ctrl+T; **MAJOR** gap: `.session-copy-btn:disabled:hover` override likely to be dropped during the "fold," causing hover-styled-but-disabled buttons |
| 4 | Token swap hazards | PASS on SVG data-URI, `!important`, `@keyframes`, `@media`, box-shadow-shorthand var() support; MINOR — exception list for scale swaps is incomplete (box-shadow blur, backdrop-filter blur, background-position offsets not named) |
| 5 | Group opacity + backdrop-filter + z-index | PASS — stacking-context math unaffected by a byte-identical rename |

## Unresolved questions

- Does the team want the `select`'s bare `outline: none` (1141) deleted too for consistency, even
  though specificity math means the new ring already wins there without deletion?
- Should `.float-btn`/`.color-dot` be added to Phase 4a's inset-ring list given their containers'
  2-4px padding, even though `#overlay-view`'s outer edge itself isn't the constraint?

Status: DONE_WITH_CONCERNS
Summary: scrollbar merge and z-index/backdrop-filter reasoning check out clean; found one blocker (focus-ring specificity ties/wins mean 3 of 4 flagged controls stay ring-less unless the `outline:none` deletion is promoted from a risk-table note to an actual build step) and one major gap (`.session-copy-btn:disabled:hover` override likely lost in the disabled-rule fold, producing hover-styled disabled buttons); token-swap hazards are otherwise handled correctly by the plan except an incomplete exception list for the spacing/type scale sweep.
