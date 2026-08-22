# Adversarial Plan Review — `plans/260821-1640-uiux-overhaul/`

Reviewer: code-reviewer (hostile pass). Read-only. Baseline: HEAD `969f94e` (P1+P2 landed).
Plan files were being edited concurrently during this review; findings reflect the state read
2026-08-21 ~17:10 (phase-03 3a already updated to cover `--radius-md` / `--transcript-font-*`).

---

## BLOCKERS

### B1. P5's `overflow: hidden` on toolbar zones kills P4's focus rings and clips the Start-button glow at *every* width
**Targets:** phase-05 §5b.1 (the prescribed CSS) × phase-04 §4a "Clipping" enumeration.

phase-05 prescribes:
```css
.toolbar-zone-transcript { flex-shrink: 3; min-width: 0; overflow: hidden; }
.toolbar-zone-transport  { flex-shrink: 1; min-width: 0; overflow: hidden; }
```
P5 runs **before** P4. phase-04 §4a enumerates clipping ancestors as `#overlay-view`,
`.sessions-body`, `.session-scroll-region`, `.qa-messages` — the two new zone clippers are absent,
and phase-04 step 3's at-risk list names only `#btn-close` / `#btn-settings` at the *bar's* ends.

The zones have zero padding, so the clip box is exactly the children's bounding box:
```
src/styles/main.css:170  .toolbar-zone { display:flex; align-items:center; gap:6px; flex-shrink:0; }
src/styles/main.css:177  .toolbar-zone-transcript { gap: 8px; }
src/styles/main.css:113  .icon-btn { min-width:32px; height:32px; ... }
```
`outline: 2px solid; outline-offset: 2px` draws 4px outside the button box → **fully clipped on all
four sides** for every control in the transport and transcript zones: `#btn-source-*`, `#btn-start`,
`#btn-tts`, `#btn-copy`, `#btn-export`, `#btn-sessions`, `#btn-clear`. That is 9 of the 14 toolbar
buttons. phase-04 smoke step 1 ("Every control … shows a clearly visible blue ring") fails by
construction.

Second impact, independent of P4 and visible to all 1000 users the moment P5 ships:
```
src/styles/main.css:427-430
.action-btn:hover { background: var(--accent-hover); box-shadow: 0 0 12px var(--accent-glow); }
```
The 12px accent glow on the Start button is now clipped by its zone at **all** widths, not just
narrow ones. No P5 smoke step covers this — steps 3/4 only look at narrow widths and only at the
window zone.

**Fix:** (a) do not put `overflow: hidden` on the zones; achieve the same by giving the zones
`min-width: 0` and letting the *bar* clip (`#overlay-view` already does `overflow: hidden`), or
accept half-drawn buttons which is what clipping produces anyway; or (b) if the zone clip is kept,
add `padding: 4px; margin: -4px;` to the zones so the outline/glow have room inside the clip box,
and add both the glow and the ring to P4 step 3's at-risk enumeration. Either way, phase-04 §4a must
list `.toolbar-zone-transcript` / `.toolbar-zone-transport` as clipping ancestors.

### B2. phase-04 §4a `:where()` specificity reasoning is backwards — 3 of the 4 `outline: none` rules defeat the ring
**Target:** phase-04 §4a, bullet "`:where()` keeps specificity at 0, so any existing per-component rule still wins."

That is stated as a *benefit*. For this rule it is the failure mode. Evidence:
```
src/styles/main.css:716   .color-dot { ... outline: none; }            → (0,1,0)
src/styles/main.css:1108  input[type="text"],
src/styles/main.css:1109  input[type="password"] { ... outline:none; } → (0,1,1)
src/styles/main.css:1132  select { ... outline: none; }                → (0,0,1)
src/styles/main.css:1225  input[type="range"] { ... outline: none; }   → (0,1,1)
```
The proposed `:where(button,input,select,textarea,[role="radio"],a[href]):focus-visible` is
**(0,1,0)** (`:where()` = 0, `:focus-visible` = one class-level).

- `input[type="password"]`, `input[type="text"]`, `input[type="range"]` → (0,1,1) **beats** (0,1,0). No ring.
- `.color-dot` → (0,1,0) ties, and phase-04 step 2 places the focus rule "near the top of `main.css`
  … before the view sections", i.e. *earlier* → `.color-dot` at line 716 wins. No ring.
- Only `select` (0,0,1) loses.

phase-04 smoke step 4 explicitly checks "the range sliders and colour dots that previously had
`outline: none`" — as specified, three of the four are guaranteed to fail. The removal of these
declarations appears only in a Related-Code-Files bullet and a Risk row; it is **not** an
implementation step.

**Fix:** make it an explicit numbered step: delete `outline: none` from lines 716, 1118, 1141, 1232
and verify `grep -n 'outline: *none' src/styles/main.css` → empty before adding the ring. Drop the
"any existing per-component rule still wins" rationale — it is the opposite of the requirement.

### B3. The ~614px toolbar derivation is wrong; the "toolbar clips at the 600 default" premise does not hold, and the cited screenshot is the pre-P2 toolbar
**Target:** phase-05 §5b table + "the bar overflows by ~14px **at the default launch size**"; plan.md
→ Execution order, item 2 (the stated reason P5 is pulled ahead of P3/P4).

The arithmetic sums correctly (16+48+32+4+203+23+140+146 = 612), and `.icon-btn min-width: 32px`
does bind (`*{box-sizing:border-box}` at main.css:12; content is an 18px SVG + 8px padding = 26 < 32).
Two inputs are wrong:

**(a) The status zone contributes 4px to the minimum, not 23px.**
```
src/styles/main.css:291-299
.status-area { display:flex; align-items:center; gap:6px; margin-left:4px;
               flex: 1; min-width: 0; pointer-events: none; }
```
`flex: 1` = `1 1 0%` **plus** an explicit `min-width: 0`. Its flex base is 0 and its automatic
minimum size is overridden, so at a deficit it resolves to width 0 and its children *overflow*
rather than push. Contribution to `.control-bar`'s minimum content width = `margin-left: 4px` only.
The plan's 23px (dot 7 + 2×6 gap + margin 4) is the zone's *content* width, which is not what a
flexbox minimum is. **Overcount: 19px.**

**(b) The TTS button's border is missing.**
```
src/styles/main.css:194-208
.tts-action-btn { ... height:30px; padding: 0 10px; border: 1px solid rgba(255,255,255,0.12); gap:4px; }
```
Content-sized element: 20 (padding) + **2 (border)** + 13 (icon) + 4 (gap) + ~22 ("TTS") = **61**, not 59.
**Undercount: 2px.**

Corrected minimum: 612 − 19 + 2 = **≈595 CSS px of content**, + 2px `#overlay-view` border = **≈597
window px**. `tauri.conf.json` default `width: 600` → available content width 598 (decorations:false,
so outer == inner). **The bar fits at 600.** What actually happens at 600 is that the status text
collapses to nothing — a legibility defect, not a clipping defect. The claim "overflows by ~14px at
the default launch size" is unsupported; only the `minWidth: 400` case (~197px deficit) is real.

**(c) The evidence photo is a different DOM.** `plans/ui-screenshots/issue-2-toolbar.png` shows the
**pre-P2** bar: settings, status, 3 source icons, play, TTS, trash, copy, *the blue export-format
pill*, download, *folder*, clock, then the compact icon cut at the edge. The pill and the folder
button were removed by P2 (`#select-export-format` → Settings, `#btn-open-transcripts` → Sessions
header). Citing it as "This matches …" for a post-`969f94e` derivation is a category error.

Consequences: the second of the two "live defects in the shipped v0.6.0 build" that justify
reordering P5 ahead of P3/P4 is, at the default width, not a defect; and the `600 → 640` config
change loses its stated basis. (The `v0.5.2` defect is real and verified — see Survived list.)

**Fix:** re-derive with `.status-area` at 4px and the TTS border at 61px; restate the defect as
"clipping below ~597px window width, i.e. anywhere in the 400-597 band that `minWidth` permits";
either drop the `600 → 640` change or re-justify it on status-text legibility rather than clipping;
stop citing `issue-2-toolbar.png` as evidence for the current bar; and make phase-02 smoke step 11
(the empirical width measurement) a hard prerequisite for P5 rather than a nice-to-have.

### B4. plan.md's focus-ring risk mitigation directly contradicts phase-04, and is wrong on its own terms
**Target:** plan.md → Risks, row 3: *"P4 uses `box-shadow` ring, not `outline`, on controls that sit
against a clipping edge"* vs phase-04 §4a: *"`outline`, not `box-shadow`: it does not affect layout,
and it survives Windows High Contrast mode, which drops `box-shadow` entirely."*

Two different techniques prescribed for the same decision in the same plan. Worse, the plan.md
version does not solve the stated problem: `box-shadow` paints outside the border box exactly like
an outline and is clipped by an ancestor `overflow: hidden` identically. Only `outline-offset: -2px`
(inset), an inset `box-shadow`, or giving the clipper padding actually escapes the clip — and
phase-04 already knows that.

**Fix:** delete the plan.md row's technique claim; point it at phase-04 §4a step 3.

---

## MAJOR

### M5. The whole contrast model may be built on a backdrop that cannot occur (`transparent: false`)
**Target:** phase-03 §3d ("worst-case **white desktop** backdrop", the verbatim contrast criterion),
phase-06 §6a (mandatory "backdrop switcher (white / black / a photo)"), and
`plans/reports/researcher-260821-1642-contrast-tokens-reskin.md`'s double-composite method.

```
src-tauri/tauri.conf.json:
  "transparent": false,
  "decorations": false
src/styles/main.css:59  html, body { ... background: transparent; }
grep -rn "background|transparent|WindowBuilder" src-tauri/src/  → no window background/transparency setup
```
With `transparent: false` the window is opaque: the desktop **never** composites through. `opacity`
on `#overlay-view` (app.js:263) and `backdrop-filter: blur(30px)` (main.css:87) resolve against the
webview's own background, not the user's wallpaper. If that is so, "worst-case white desktop
backdrop" is a coincidence of the WebView2 default background colour, the "arbitrary wallpaper"
framing is wrong, and phase-06's mandatory three-way backdrop switcher is a fidelity *defect* in the
concept harness (it models a variable that is fixed in production) — which collides with phase-06
step 2's hard gate "if the baseline mock is not faithful, no concept built on it is trustworthy."

I could not settle this statically — it needs one 60-second empirical check. **Label: verified
config, unverified rendering.**

**Fix:** before P3 §3d's verbatim criterion is committed and before P6's harness is built, run the
app over a bright wallpaper at `overlay_opacity` = 20% and photograph the result. If the wallpaper
does not show through, rewrite §3d against the actual composite base and replace P6's backdrop
switcher with the single real backdrop.

### M6. `src/index.html` has **zero** automated coverage; plan.md's ID-risk framing is factually wrong
**Target:** plan.md → Context ("Element IDs are load-bearing: ~40 `getElementById` bindings plus
vitest tests") and → Risks row 2 ("Vitest/cargo green gates *merge*").

```
grep -rn "index.html|readFileSync" tests/          → (empty)
grep -rho "getElementById('[^']*'" src/js/ | sort -u | wc -l   → 109
grep -o 'id="[^"]*"' src/index.html | sort -u | wc -l          → 120
```
No test reads `src/index.html`. `npm test` cannot detect a dropped ID, a broken `aria-*` wiring, or
a moved element — it is green regardless. And the binding count is 109 distinct IDs, not ~40.

P4 edits `index.html` (ARIA on 4+ controls) and 3 JS files; P5 edits `index.html` (`#about-version`,
`#btn-sessions-back` icon/title, 10 inline styles). For all of it, the ID-parity grep is the *only*
net, and `npm test` green proves nothing.

**Fix:** correct the count and delete the "vitest gates merge" claim for HTML-touching phases. If a
net is wanted cheaply, add one jsdom test that loads `src/index.html` and asserts every
`getElementById` literal in `src/js/**` resolves (minus the 6 known dead ones below) — that is the
single highest-value test this plan could add, and it is cheaper than the CSS token test.

### M1. phase-03 §3e rule 3's allowlist is incomplete — 28 of 89 colour-literal occurrences are unaccounted for
**Target:** phase-03 §3b table + the Allowlist paragraph + §3e rule 3.

Machine count of colour literals outside `:root` at `969f94e`: **89 occurrences, 43 distinct.**
§3b tokenizes ~30 and the allowlist names `#ffffff@582`, `rgba(99,140,255,*)` (6), `rgba(0,0,0,*)`
(10), `rgba(248,113,113,*)` (9), `rgba(20,20,30,*)` (5) = 31. **28 occurrences are in neither list:**

| Unaccounted | × |
|---|---|
| `rgba(255,255,255,*)` at 0.08/0.12/0.15/0.2/0.25/0.3/0.4/0.5/0.55/0.7/0.8 | 20 |
| `rgba(74,222,128,*)` (success alphas: 0.15/0.2/0.4) | 4 |
| `rgba(251,191,36,*)` (warning alphas: 0.1/0.5) | 2 |
| `rgba(250,204,21,0.15)` (alpha companion of `#facc15`, which §3b *does* tokenize) | 1 |
| `rgba(99,179,237,0.2)` (alpha companion of `#63b3ed`, which §3b *does* tokenize) | 1 |

The pattern is systematic: §3b tokenizes the solid colours but misses every one of their alpha
companions. The guard test as written fails on day one, and the worker at step 6 will either dump 28
entries into the allowlist (gutting rule 3, exactly the "phantom test" outcome) or invent tokens the
plan never approved (unplanned value coupling before P6 changes those values).

**Fix:** enumerate all 89 and assign each to tokenize / allowlist *in the plan*, with the alpha-vs-
solid policy decided once (recommend: allowlist all alpha companions, matching the `--accent-rgb`
decision already made for `rgba(99,140,255,*)`).

### M2. phase-03 §3e rule 1 contradicts §3a row 4, and cannot be implemented with a naive parser
**Target:** phase-03 §3a (updated) row 4 vs §3e rule 1.

§3a now correctly identifies `--transcript-font-size` / `--transcript-font-color` as JS-injected
(`src/js/ui.js:63,67 container.style.setProperty`) and says they "must be exempted from the guard
test in 3e". §3e was not updated — rule 1 still reads absolutely: *"Every `var(--x)` in the file
references an `--x` defined in the `:root` block."* A worker following §3e verbatim will define them
in `:root` to make the test pass, which **changes rendering**: a `:root` definition beats the
`var()` fallback, so line 582's `#ffffff` default and line 622's `var(--text-primary)` default stop
applying in the pre-`configure()` window.

Also, rule 1's parser must survive:
```
src/styles/main.css:622  color: var(--transcript-font-color, var(--text-primary));
src/styles/main.css:1749 color: var(--text-dim, rgba(255, 255, 255, 0.5));
```
A `var\(\s*(--[\w-]+)[^)]*\)` regex mis-terminates on both.

**Fix:** write the exemption array into §3e rule 1 explicitly, and specify balanced-paren parsing
(or `postcss-value-parser`-equivalent hand-rolled) rather than a regex.

### M3. The value-parity script — the phase's "primary gate" — false-alarms on the one change it must bless, and is blind to whole classes of regression
**Target:** phase-03 Implementation step 5 + Success Criterion "value-parity diff empty".

**(a) It fires on the intended 3a change.** Before: `color: var(--text-dim, rgba(255,255,255,0.5));`
(`--text-dim` undefined → nothing to expand from `:root`). After: `color: var(--text-muted);` →
`rgba(255,255,255,0.5)`. The declaration strings differ unless the resolver also resolves *fallbacks
of undefined properties*. Step 5's instruction — *"If it is not [empty], the sweep changed a value —
stop and fix"* — is wrong for 3a, and a worker who "fixes" it will revert a correct change.

**(b) Concrete miss classes** for a script that emits a *sorted list of resolved declarations*:
1. **Selector / cascade changes are invisible.** Moving `color: rgba(255,255,255,0.5)` from
   `.session-qa-title` to a shared rule produces the identical sorted line. Specificity and source
   order — the only things that decide which of two same-property declarations wins — are discarded.
2. **`!important` position.** `src/styles/main.css:501-505` (`.shortcut-hint`) carries three
   `!important`s including `color: var(--text-muted) !important`. A sorted-declaration diff cannot
   tell that the *rule containing it* moved relative to a competing rule.
3. **Declaration order within a rule.** `padding` followed by `padding-left` renders differently from
   the reverse; sorted output is identical for both.
4. **Multiset vs set.** If the script dedupes ("sorted list" is ambiguous), deleting one of two
   identical declarations is invisible.
5. **Properties/at-rules it does not model.** The file has 6 `@keyframes` blocks (328/445/565/791/
   804/1389) and a data-URI `background-image` on `select` (1146) containing `%23888` — a hex colour
   the literal scanner will either miss or mangle.
6. **Shorthand resets.** See M7: `background: var(--surface-N)` silently resets `background-image`.
   A resolved-value diff shows the shorthand as unchanged text while the *computed* background-image
   changes. This is the exact failure mode phase-03's own "Verification a Worker Cannot Do" section
   hand-waves at.

**Fix:** state the expected non-empty diff for 3a up front (or run parity per-commit, exempting the
3a commit); require the script to key each declaration by `selector → property` rather than sorting
a flat list; and add a "no shorthand may replace a longhand and vice versa" rule to §3c step 4.

### M4. Smoke-gate numbering is inconsistent across three documents; P5's authoritative measurement may never be produced
**Target:** plan.md → "Human smoke checkpoints" vs phase-02 → Smoke-Test Gate vs phase-05 §5c and step 3.

plan.md: *"P1 and P2 share one combined smoke gate — steps 1-11 of
`plans/reports/builder-260821-1617-uiux-p1-p2.md`, reproduced in phase 01 and phase 02."*
They are **not** the same list:

| # | builder report | phase-02 |
|---|---|---|
| 8 | Q&A scrollbar is thin/styled | **drag by gap / divider / status area** |
| 9 | "compact/pin/minimize/close **stay visible and clickable the whole time**" | compact-mode hover-reveal |
| 10 | drag by gaps/dividers/status area | keyboard shortcuts |
| 11 | compact mode hover-reveal | **"note how narrow … before … disappearing, and report that width"** |

- phase-05 §5c: *"re-run P2 smoke step 8"* → correct against phase-02, wrong against the builder list
  plan.md points the user at (there, step 8 is the Q&A scrollbar).
- phase-05 step 3 and its Risk row: *"the P2 smoke gate's step-11 measurement is the authority"* →
  exists only in phase-02's list. If the user runs the builder's 11 steps as plan.md instructs, no
  width is ever measured, and B3's derivation has nothing to reconcile against.
- Builder step 9 **asserts as expected behaviour** that the window controls stay visible at all
  widths, which is the exact opposite of phase-02 step 11's "Known limitation until Phase 5" and of
  P5's entire premise. Whichever list the user runs, one of the two documents is wrong.

**Fix:** make phase-02's list canonical, delete the builder-report pointer from plan.md, and make
step 11 a numbered pass/fail prerequisite of P5 rather than "a measurement, not a pass/fail".

### M7. phase-05 §5d prescribes padding for an arrow that does not exist (and inherits P2's wrong diagnosis)
**Target:** phase-05 §5d; phase-02 Architecture → Demotions bullet 1.

```
src/styles/main.css:1794-1802
.export-format-select {
  background: var(--bg-hover);      /* SHORTHAND */
  ... padding: 2px 4px; ...
}
```
`background` is a **shorthand**: it resets `background-image` to `none`. `.export-format-select`
(0,1,0) beats `select` (0,0,1) regardless of order, so the dropdown arrow declared at
`src/styles/main.css:1146` is **not rendered at all** on this element. That matches
`plans/ui-screenshots/issue-1-sessions-popup-no-scrollbar.png`, where the `.md` box is wide and
empty with **no arrow visible**.

So: the real defect is `width: 100%` inherited from `select` (1133), full stop. §5d's prescription
"`padding: 2px 24px 2px 6px` so the text clears the arrow" adds 24px of dead right padding and
off-centres the text. Same for P2's recorded explanation of the original toolbar pill ("at toolbar
width the `.md` text sat under the arrow") — P2's *fix* (drop the class) was correct, but only
because dropping the class restored the arrow; the stated cause was not.

**Fix:** §5d becomes `width: auto; min-width: <fits ".txt">;` and keep `padding: 2px 6px` — or, if an
arrow is wanted, change `background:` to `background-color:` so the inherited `background-image`
survives, and *then* the 24px padding is justified. Decide which; do not ship both.

### M8. `#status-elapsed` will visibly overflow onto the transcript zone once P5 makes narrow widths usable
**Target:** phase-05 §5b; no smoke step covers it.

```
src/styles/main.css:291  .status-area { flex: 1; min-width: 0; }      /* no overflow */
src/styles/main.css:340-348 .status-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
src/styles/main.css:362-369 .status-elapsed { ... flex-shrink: 0; }   /* cannot shrink */
```
`.status-area` shrinks to 0 (B3a) but has `overflow: visible`, and `#status-elapsed` is
`flex-shrink: 0`. During a recording at narrow width, the elapsed timer paints **outside** its
0-width parent, on top of the following divider and the transcript zone. `pointer-events: none`
means it is a purely visual overlap — the worst kind for smoke testing, because P5 smoke steps 3/4
tell the human to expect "transcript-zone icons disappear first", so overlapping text reads as
"expected clipping".

This is latent today; P5 is what makes narrow widths survivable and therefore commonly used.

**Fix:** add `overflow: hidden` to `.status-area` (main.css:291) in §5b, and add a smoke step:
"start a recording, then shrink the window — the elapsed timer truncates or disappears; it never
overlaps the icons to its right."

---

## MINOR

- **m1.** phase-03 §3c claims the spacing scale is "1:1 with the literals in use", then omits `14px`
  and `28px`, both of which are in use in padding/margin/gap (full set: 1,2,3,4,6,8,10,12,**14**,16,
  20,24,**28**). Only 1px and 3px are called out as deliberate exclusions. `28px` is `select`'s arrow
  clearance (main.css:1147) — arguably not rhythm — but the plan should say so rather than lose it.
- **m2.** phase-03 §3c's control-height rationale ("`--control-h-sm/md/lg`: the three that recur;
  22/26/34/42 one-offs stay literal") does not survive counting: `height:` literals are 22×2, 24×2,
  26×2, 28×2, 30×2, 32×2 — 28/30/32 recur exactly as often as 22/24/26. Also `34px` is a **`width`**
  (`.action-btn`, main.css:415), never a height, and `42px` is already `--control-bar-height`. Pick a
  different criterion or state it as a judgement call, since "cannot change a value" depends on it.
- **m3.** phase-05 §5f miscounts the inline styles: actual is **10** margin attributes
  (`margin-top:8px` ×**5** not ×4, `margin-top:12px`, `margin-bottom:8px`, `margin-bottom:10px`,
  `margin:0` ×2), not 12. Total inline `style=` attributes = 23 = 10 margin + 10 `display:` + 3
  `.color-dot`. The `display:` and `.color-dot` counts are correct.
- **m4.** phase-04 "Verification a Worker Can Do": `grep -c 'app-region\|classList.*disabled' src/ -r`
  → `0` is not a runnable check — with `-r` on a directory, `grep -c` prints one count per file
  (verified: 30+ lines of `path:0`). Rewrite as `grep -rn ... src/ | wc -l` → 0.
- **m5.** phase-04 Related Code Files: *"extend an existing test file if one already asserts the
  source-picker or TTS-toggle state"*. None exists — `grep -rn "disabled|btn-tts|updateButton" tests/`
  is empty, and the 14 test files cover session/settings/soniox/ui only. State that P4 must **add** a
  test file, or the "extend if it exists" phrasing licenses adding nothing.
- **m6.** The ID-parity grep will surface 6 pre-existing JS-only IDs
  (`check-tts-enabled`, `hint-mode-local`, `link-elevenlabs`, `range-tts-speed`,
  `tts-settings-detail`, `tts-speed-value`, all in `settings-form-controller.js`, all `?.`-guarded).
  phase-02 documents them; phase-04 and phase-05 do not. Copy that note forward or the worker will
  chase them.
- **m7.** phase-06 has contradictory success criteria: "each opening **offline** from Explorer" /
  "grep for `http` … → none" versus step 2's hard gate "the baseline mock renders indistinguishably
  from the real app". `src/index.html:10` loads Inter from `fonts.googleapis.com`. Offline (or on a
  machine without Inter installed) the mock falls back to `-apple-system, BlinkMacSystemFont,
  sans-serif` with different metrics, so type-scale and spacing judgements are made against the wrong
  font. Resolve by bundling/base64-ing Inter into the concept files, or by explicitly accepting the
  font substitution and saying so in the comparison README.
- **m8.** `docs/smoke-test-checklist.md` line 8: **"Status: not yet run … This checklist is a
  template until a human completes the first pass."** Every phase gate in this plan delegates release
  safety to a document that has never been executed once against 1000 live users. Its Copy/Export
  section is also already stale post-P2 ("Overlay: Export button (.md)" — the format now lives in
  Settings). phase-05 step 10 covers the staleness; nothing covers "never run".
- **m9.** phase-05 §5f: *"If P3 has already landed when this is built, use its `--space-*` tokens"* is
  dead text — the declared order is P5 → P3. It also means P5's new margin utility classes introduce
  literals that phase-03 §3c's list (derived at `969f94e`) does not know about, weakening §3c's
  "cannot change a value" property. Delete the conditional; add "re-derive §3c's literal set from the
  P5 tip".
- **m10.** plan.md Success Criteria: *"a one-off var-resolution pass … byte-identical … except the
  already-landed `--text-muted` bump"*. The P3 baseline is the P5 tip, which is post-P2, so the bump
  is already in both sides of the diff and no exception is needed. Confusing as written; a worker may
  build an exception mechanism for nothing.

---

## What survived (verified, do not re-litigate)

- **Sequencing frontmatter is consistent** with the declared P1→P2→P5→P3→P4→P6 order:
  p1 `[]`, p2 `[]`, p5 `[2]`, p3 `[1,2,5]`, p4 `[3]`, p6 `[3,4]`. No cycle, no contradiction. The
  "all phases edit main.css → sequential only" constraint is correct, and P4/P5 both editing
  `index.html` is correctly called out as non-parallelizable.
- **Seven `-webkit-app-region` sites at exactly 126, 206, 378, 424, 824, 1592, 1693**; `grep -c` → 7.
  Counsel's "6 sites" correction was right.
- **`src/index.html:664`** = `<span class="about-app-version" id="about-version">v0.5.2</span>`;
  `grep -rn 'about-version' src/js/` empty. `grep -c 'v0\.[0-9]' src/index.html` → 1. Real defect.
- **`window_state` written, never read**: only `src/js/window-manager.js:46 localStorage.setItem`.
  `tauri.conf.json` `"plugins": {}` — no window-state plugin. The de-risking argument for changing
  the default width holds.
- **`--text-dim` fallbacks match byte-for-byte.** 1749/1821/1871 = `rgba(255, 255, 255, 0.5)` ==
  `--text-muted`; 1772 = `rgba(255, 255, 255, 0.4)` == `--text-provisional`. Including the spaces.
  3a's swap is genuinely value-neutral.
- **Only `#overlay-view` gets inline group opacity**: `grep -rn "style.opacity" src/js/` → one hit,
  `src/js/app.js:263`. `#settings-view` / `#sessions-view` are untouched, as §3d says.
- **All five `::-webkit-scrollbar` sets are byte-identical** (`width:4px`, track `transparent`, thumb
  `rgba(255,255,255,0.1)` + `border-radius:2px`), and only `#transcript-container` has the `:hover`
  rule (main.css:480). phase-04 §4c's updated claim is exactly right.
- **`.icon-btn { min-width: 32px }` binds.** `*{box-sizing:border-box}` (main.css:12) → min-width is
  a border-box constraint; largest content is an 18px SVG + 8px padding = 26px < 32px.
- **Every spot-checked line number is correct at `969f94e`**: 254 `#facc15`, 421 `#fff`, 442
  `#ef4444`, 623 `rgba(255,140,200,0.4)`, 696 `#63b3ed`, 739 `#f5a623`, 1334 `#fff`, 582/622
  `--transcript-font-color`, 655/270/280/1364/1412 z-indexes, 1132 `select`, 1793 the
  `.export-format-select` comment. Line-reference discipline in this plan is unusually good.
- **phase-04 §4b's TTS `disabled`-property conversion is behaviour-safe.** Both entry points are
  already guarded inside the controller, not by CSS: `tts-controller.js:78-87 toggle()` returns early
  on `two_way`, and the Ctrl+T shortcut (`app.js:209`) goes through the same `toggle()`. Converting
  from `pointer-events: none` to `disabled` cannot open the feedback-loop hole. Bonus: it restores
  the `title` tooltip, which `pointer-events: none` currently suppresses.
- **`window.__TAURI__.app.getVersion()` timing is a non-issue here.** `src/js/app.js:23-24` already
  destructures `window.__TAURI__.core` / `.window` at module top level in shipping code, so the
  global is injected before module evaluation. The researcher's flagged Windows timing bug
  (tauri-apps/tauri#12990) does not apply. The `core:default → core:app:default → allow-version`
  chain is plausible but rests on the researcher's own admitted indirect source — the plan's
  "test the primary in a real build first" instruction is the right hedge.
- **Type scale is genuinely 1:1**: exactly 7 distinct `font-size` px literals (8, 10, 11, 12, 13, 14,
  16), matching §3c's 6 tokens + `8px` left literal.
- **`--radius-md` and the JS-injected `--transcript-font-*`** are now correctly handled in §3a (they
  were the two gaps I found before the file was updated mid-review). Only §3e still needs the
  matching exemption (M2).

---

## Regression risk the specified smoke steps would NOT catch

Ranked, with the inadequate step named:

1. **Start-button hover glow clipped at all widths** (B1). Nearest step: P5 smoke 3/4, which look
   only at narrow widths and only at the window zone. **Missing step:** "at the default width, hover
   Start — the blue glow around it is unchanged from before."
2. **Elapsed-timer overlap at narrow width** (M8). Nearest step: P5 smoke 3, which primes the human
   to expect things disappearing. **Missing step:** the recording-active narrow-width check in M8.
3. **Focus ring absent on password fields, range sliders, colour dots** (B2). P4 smoke 4 *would*
   catch it — which is the point: as specified, the phase is designed to fail its own gate.
4. **A P3 token swap that changes a computed value while the parity diff stays empty** (M3 b6):
   `background: <literal>` → `background: var(--surface-N)` on any element that also relies on an
   inherited `background-image`. P3 smoke 1-4 are "looks the same as before" eyeballing with no
   side-by-side required ("ideal but not required"). **Missing step:** a before/after screenshot pair
   of the same three views at the same window size and opacity, which is the only way an untrained
   eye catches a 0.04-alpha surface shift.
5. **Nothing verifies the `#about-version` value is the *running* build's version** rather than a
   value baked at build time from a stale `Cargo.toml`. P5 smoke 1 compares against `package.json`,
   which is the *source* file on the dev machine, not the artifact. Minor, but the criterion as
   written ("verified equal to `package.json` `version` after a version bump") cannot be checked by
   a user who does not have the repo.

---

## Unverifiable / hand-wavy acceptance criteria

- plan.md: *"`--text-dim` either defined in `:root` or gone; **zero** `var(--x)` … references an
  undefined custom property (guarded by a new vitest test)"* — false as an absolute; two JS-injected
  properties must be exempt (M2). Criterion needs the exemption written in.
- plan.md: *"no raw color literal outside `:root` except the documented allowlist"* — the allowlist is
  not documented to completeness (M1). Not checkable until it is.
- plan.md: *"a visible focus ring … meets 3:1 against its surface"* — a human cannot measure 3:1 by
  eye. Either pre-compute it in the plan (the researcher already did: 4.46-5.70:1 for solid
  `--accent`) and drop it from the human gate, or ship a screenshot + sampled hex.
- phase-05: *"at **every** window width the app permits, `#btn-compact/pin/minimize/close` are fully
  visible and clickable"* — with `minWidth: 400` unchanged and the fixed cost being
  16+48+32+4+146 = 246px plus at least a sliver of transport, this is satisfiable, but "fully
  visible" needs a stated floor width or the human cannot fail it deterministically.
- phase-06: *"The baseline mock is verified faithful to the real app before any concept is built"* —
  no method given, and m7 (font) plus M5 (backdrop) both attack fidelity. Specify *how* faithful is
  demonstrated (side-by-side screenshot at identical window size, opacity and DPI).
- phase-05 smoke 8: *"every panel's spacing looks **exactly** as before"* after moving 10 inline
  margins to classes — unfalsifiable by memory. Needs a before screenshot.

## Scope check

- **Scope creep:** none material. §4e (icon sizes) and §4f (hit targets) are correctly gated behind
  user confirmation and explicitly not built — that is the right call and it matches the counsel
  report's "normalize icon sizes" being outside the enumerated user decision 3. phase-06's
  "concepts only, zero `src/` changes" boundary is enforced by a checkable criterion.
- **Under-scoping:** phase-03's deliberate non-consolidations (`--border-light` vs `--surface-3`,
  no `--accent-rgb`) are argued, not lazy, and I agree with both. The genuine under-scope is M1
  (28 unassigned literals) and m1/m2 (spacing/height scales that do not actually cover what is in
  the file) — the token layer as specified would leave P6 unable to reskin ~28 colour sites and two
  spacing values from `:root` alone, which is the stated payoff of the whole phase.

## Unresolved questions

1. Does the desktop actually composite through the window (M5)? Everything in §3d, §4a's contrast
   numbers, and §6a's harness depends on the answer, and it is one screenshot away.
2. Which list is the P1+P2 smoke gate — the builder report's or phase-02's (M4)? The width
   measurement P5 declares "the authority" exists in only one of them.
3. If B3 is accepted, does the `600 → 640` default-width change survive on legibility grounds, or is
   it dropped and replaced by raising `minWidth` (the plan's own Validation Question 2)?
4. Is an arrow wanted on `.export-format-select` at all (M7)? The fix differs materially.

Status: DONE_WITH_CONCERNS
Summary: Line-reference and grep discipline in this plan is genuinely good and most cited facts
survived verification, but four blockers stand: P5's zone `overflow: hidden` destroys P4's focus
rings on 9 toolbar buttons and clips the Start-button glow at all widths; P4's `:where()` specificity
reasoning is inverted so three of four `outline: none` rules defeat the ring; the ~614px toolbar
derivation double-counts a `flex:1 1 0%; min-width:0` element and is backed by a pre-P2 screenshot,
so the "clips at the 600 default" premise that justifies the whole P5 reordering does not hold; and
plan.md prescribes `box-shadow` where phase-04 prescribes `outline`. Beneath those, P3's guard test
and its value-parity gate are both under-specified enough to pass vacuously.
