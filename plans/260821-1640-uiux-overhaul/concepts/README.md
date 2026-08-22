# Phase 6 — Reskin concepts

Three concepts plus a baseline, each a standalone HTML page. **Nothing under `src/` or
`src-tauri/` was touched.** This phase delivers concepts and a decision; implementing the winner is
a separate, later plan.

## Open them (double-click, no build, no dev server, works offline)

```
D:\WORKSPACES\PERSONAL\my-translator\plans\260821-1640-uiux-overhaul\concepts\baseline-current.html
D:\WORKSPACES\PERSONAL\my-translator\plans\260821-1640-uiux-overhaul\concepts\concept-a-quiet-glass.html
D:\WORKSPACES\PERSONAL\my-translator\plans\260821-1640-uiux-overhaul\concepts\concept-b-focus-dark.html
D:\WORKSPACES\PERSONAL\my-translator\plans\260821-1640-uiux-overhaul\concepts\concept-c-warm-slate.html
```

Edge is the right browser — same Chromium family as WebView2, so `backdrop-filter` and `rgba()`
compositing render the way the app renders them.

Each page has: a view switch (Overlay / Settings / Sessions), an overlay-content switch
(Transcript / Listening / Empty), a Sessions switch (List / Viewer + summary), a transient switch
(Toast / Recovery dialog), a recording toggle, an **opacity slider (20–100%)**, a live contrast
table that recomputes as you drag the slider, and the concept's palette.

**Judge with the controls moved, not at one flattering setting.** Drag the slider to 100, 85, 60,
20 on every page. Hover controls and press <kbd>Tab</kbd> inside the frame — hover and focus states
are part of the concept.

## Two questions the phase said to settle before building. Both settled, with evidence.

### 1. VQ1(b) — does the desktop composite through the window? **No. The base is white.**

This was the plan's last open question and it gates the backdrop switcher. It is now answered from
measurement, not assumption:

- `src-tauri/tauri.conf.json` → `"transparent": false`, `"decorations": false`. No `backgroundColor`
  is set anywhere in `src-tauri/`, and `main.css` has `html, body { background: transparent }`, so
  the base is WebView2's own default.
- `plans/ui-screenshots/issue-2-toolbar.png`, read pixel by pixel:
  - the window's **rounded-corner wedges** — the area inside the window rect but outside
    `#overlay-view`'s 14px `border-radius` — read **220–250** (near-white) at both top corners,
    while the desktop just outside the window reads 11–25 (dark). If the desktop composited
    through, that wedge would be dark too.
  - the panel body reads **rgb(75, 74, 79)**. Predicted for `rgba(15,15,20,0.88)` at 85% over a
    **white** base: `0.88 × 0.85 = 0.748` → `0.748×15 + 0.252×255 = 75.5` → **rgb(75, 75, 79)**.
    Over a black base it would be rgb(11, 11, 15). The screenshot matches white to within one unit
    per channel.

**Therefore the three-way backdrop switcher was NOT built** — per phase 06 §6a, modelling a
variable that is fixed in production is a fidelity defect. Every page ships one fixed backdrop:
`#ffffff`, the measured real base.

**This corrects an assumption in phase 07 §7d**, which said that if the window turned out opaque
"the black-base column is the real one. That is the good branch." It is the opposite: the base is
white, so **phase 07 §7b's white column is the real one**, and P7's restructure bought contrast
nothing against the actual base. P7 is still correct as built (it stopped the *text* fading, which
is visibly true and was the user's stated goal); it just does not deliver the AA independence the
dark-base column promised. See "The finding that matters most" below.

### 2. The Inter web font. **Embedded, not substituted.**

`src/index.html:10` loads Inter from `fonts.googleapis.com`. Inter is **not** installed on this
machine (`C:\Windows\Fonts` and the per-user font directory both checked — Segoe and MesloLGS only),
so an offline mock would silently fall back to Arial and every type-scale and spacing judgement
would be wrong.

Each page therefore **base64-embeds the Inter v20 variable font** (latin + vietnamese subsets,
`font-weight: 300 700`) as a `data:` URI. No network request. Vietnamese is included because the
sample transcript is EN→VI. Cost: ~78 KB of the ~178 KB page size.

## Fidelity — what is demonstrated, and what is still owed

The mocks are **mechanically derived from the shipped source**, not redrawn:

| Ingredient | How it got into the page |
|---|---|
| Stylesheet | `src/styles/main.css` copied verbatim; only the `:root` block is swapped, and the concept's component rules are appended after it. The 1 866 lines after `:root` are byte-identical in all four files (checked, not asserted). |
| Markup | The four slabs of `src/index.html` (overlay view 183 ln, settings view 493 ln, sessions view 91 ln, recovery dialog 18 ln) lifted as exact line slices. |
| Runtime DOM | The harness JS mirrors the real renderers: `ui.js` `showPlaceholder()` / `_ensureContent()` for the transcript area, `transcript-card-renderer.js` `_buildCardInnerHtml()` for `.seg-card`, `session-manager.js:337` for session rows and `_renderSummaryResult()` for the summary block, `toast.js` for the toast, `status-indicator.js` for the status zone. |
| Opacity | `overlayView.style.setProperty('--overlay-opacity', v)` — the same single line as `src/js/app.js:265`. Only `#overlay-view::after` fades. Settings and Sessions are unaffected by the slider, exactly as in the app. |

Three documented deltas from `src/index.html`, all auditable:

1. **100 `<option>` elements** removed from the two `<optgroup label="All Languages">` blocks. A
   closed `<select>` renders only its selected option, so no rendered pixel changes.
2. `.toast` and `.modal-overlay` are `position: fixed` in `main.css`, i.e. viewport-relative. In
   production the window *is* the viewport; the harness pins them to the 680×400 frame, which
   reproduces the production result rather than deviating from it.
3. `html, body` are re-opened for scrolling so the harness chrome can sit around the frame. The
   frame itself is 680×400 — the app's default launch size after P5 (`width: 680`).

**Still owed, and it is yours, not mine:** phase 06 step 2 wants a side-by-side *screenshot* pair of
the real app and `baseline-current.html` at identical size, opacity and display scaling, embedded
here. **I cannot produce it** — no Windows GUI in this environment, and the release build is
deliberately not run this phase. To close it:

1. Launch the app, default width, opacity 85%, a transcript on screen. Screenshot the window.
2. Open `baseline-current.html` in Edge at 100% browser zoom and the same Windows display scaling,
   opacity slider at 85, content = Transcript. Screenshot the frame.
3. Put the pair side by side. If they differ, say where — the mock is wrong and the concepts built
   on it are not yet trustworthy.

Two `http` strings survive in every page and **neither is a network reference**: an `xmlns` inside
the `select` arrow's `data:` URI (`main.css:1243`) and the AI-endpoint input's placeholder text
(`index.html:642`). Both are inherited verbatim from the shipped source. Automated check confirms
**zero** `src=`/`href=` attributes pointing outside the file, in all four pages.

## The concepts

| Axis | Baseline (shipped) | **A — Quiet Glass** | **B — Focus Dark** | **C — Warm Slate** |
|---|---|---|---|---|
| **Thesis** | — | Evolution. Same identity, everything one step calmer and one step more legible. | Readability first. Near-opaque panel, minimal chrome, big transcript type. | Same structure, genuinely different temperature. |
| **Colour** | Cool near-black glass `rgba(15,15,20,.88)`; blue `#638cff`; amber speaker `#f5a623`; pink translation rule | Same family, panel to `.92`; text tiers .92/.55/.50 → **.96/.72/.60**; accent calmed to `#7a97e0`; borders .06/.10 → .08/.14 | Panel to **`.985`** (near-opaque); text **1.0/.78/.62**; accent `#6e96fa` used **only** for state; translation rule goes neutral white | Warm neutrals `rgba(26,23,21,.90)`; **copper `#d08a58` + amber `#dbab54`**; sage speaker `#9fbfa4`; warm-tinted whites |
| **Typography** | 6 sizes: 10/11/12/13/14/16 + five em-relative card sizes + an 8px `.btn-label` | **4 rendered sizes: 11/12/14/16.** Card em-sizes and `.btn-label` pinned to the scale | Every tier **+1**: 11/12/13/14/15/17; transcript default **16 → 19px** | **Unchanged scale.** The change is weight (600 → 700 on titles) and tracking |
| **Spacing** | 2/4/6/8/10/12/16/20/24 | **4px rhythm: 2/4/8/12/16/20/24.** Chrome one notch denser | Chrome tighter, reading gutters wider (`--space-xl` 16 → 18); control bar 42 → 40 | **Identical to today** — deliberately, that is C's question |
| **Component look** | Filled glass cards, 8px radius, gradient Start button, accent-tinted source picker | Same components; **7 control heights → 3** (22/24/26 all → 28); card radius and padding tokenized | Cards become **ruled rows** (no fill, 1px bottom rule); source picker + Start + TTS go neutral until active; blur cut 30px → 12px | Softer corners throughout (radius 2/4/6/10/14 → **3/5/8/12/16**); warm card fill; header wash de-cooled |
| **Contrast** | `text-muted` AA only at **≥98%** opacity | AA from **83%** | AA from **76%** | AA from **93%** |
| **Cost** | — | **Lowest.** `:root` + **11 selectors**. No JS, no Rust, no layout change. | **Highest.** `:root` + **13 selectors**, *plus* a Rust settings-default change for the transcript size, *plus* an opacity-default change 85 → 95, *plus* a decision to rewrite `.seg-card`'s look. | **Low.** `:root` + **9 selectors**. Close to A's cost, much larger visual delta. |

Each page lists its own "what this concept could NOT express in tokens alone" — that list is the
honest cost signal, and all three hit the same four gaps in the current token layer: literal control
heights, em-relative card type, `.seg-card`'s literal radius/padding, and three card text colours
that are still raw `rgba()`.

## Measured contrast

Method, reproducible: panel = `--bg-primary` at its own alpha × the slider, composited over the
window base; text = its own `rgba()` over that surface; "on a card" inserts `--surface-1` between
them. This is the post-P7 model — the background layer fades, the text does not. Bold = passes
WCAG AA for body text (4.5:1). The **white** columns are the real ones (see VQ1(b) above); the black
columns are the hypothetical figure for a transparent window over a dark desktop and are shown only
for reference — nothing renders against them.

| Concept | Text tier | 100% white | 85% white | 20% white | 100% black | 85% black | 20% black |
|---|---|---:|---:|---:|---:|---:|---:|
| Baseline (shipped) | `text-primary` | **12.03** | **7.61** | 1.43 | **16.34** | **16.54** | **17.30** |
| Baseline (shipped) | `text-secondary` | **5.34** | 3.90 | 1.24 | **6.25** | **6.26** | **6.26** |
| Baseline (shipped) | `text-muted` | **4.69** | 3.52 | 1.22 | **5.34** | **5.33** | **5.29** |
| Baseline (shipped) | `accent-speaker` | **6.88** | 4.25 | 1.38 | **9.55** | **9.68** | **10.19** |
| Baseline (shipped) | `accent` | 4.46 | 2.76 | 2.12 | **6.20** | **6.28** | **6.62** |
| A — Quiet Glass | `text-primary` | **14.65** | **9.19** | 1.48 | **17.75** | **17.98** | **18.92** |
| A — Quiet Glass | `text-secondary` | **8.81** | **6.01** | 1.35 | **10.10** | **10.18** | **10.45** |
| A — Quiet Glass | `text-muted` | **6.56** | **4.73** | 1.28 | **7.25** | **7.28** | **7.35** |
| A — Quiet Glass | `accent-speaker` | **8.14** | **5.05** | 1.30 | **9.93** | **10.07** | **10.63** |
| A — Quiet Glass | `accent` | **5.52** | 3.42 | 1.91 | **6.73** | **6.83** | **7.21** |
| B — Focus Dark | `text-primary` | **19.06** | **12.52** | 1.56 | **19.57** | **19.78** | **20.70** |
| B — Focus Dark | `text-secondary` | **11.67** | **8.30** | 1.42 | **11.88** | **11.96** | **12.30** |
| B — Focus Dark | `text-muted` | **7.65** | **5.89** | 1.33 | **7.72** | **7.74** | **7.82** |
| B — Focus Dark | `accent-speaker` | **12.13** | **7.96** | 1.01 | **12.45** | **12.59** | **13.17** |
| B — Focus Dark | `accent` | **6.72** | 4.42 | 1.82 | **6.90** | **6.98** | **7.30** |
| C — Warm Slate | `text-primary` | **11.68** | **7.34** | 1.37 | **15.65** | **16.06** | **17.44** |
| C — Warm Slate | `text-secondary` | **6.97** | **4.77** | 1.24 | **8.68** | **8.83** | **9.21** |
| C — Warm Slate | `text-muted` | **5.25** | 3.79 | 1.19 | **6.23** | **6.30** | **6.40** |
| C — Warm Slate | `accent-speaker` | **6.70** | 4.15 | 1.37 | **9.08** | **9.33** | **10.20** |
| C — Warm Slate | `accent` | **4.78** | 2.96 | 1.92 | **6.48** | **6.65** | **7.27** |

| Concept | Text tier (on a `.seg-card`) | 100% white | 85% white | 20% white |
|---|---|---:|---:|---:|
| Baseline (shipped) | `text-primary` | **10.72** | **6.83** | 1.41 |
| Baseline (shipped) | `text-secondary` | **4.95** | 3.61 | 1.23 |
| Baseline (shipped) | `text-muted` | 4.38 | 3.28 | 1.21 |
| A — Quiet Glass | `text-primary` | **12.72** | **7.96** | 1.45 |
| A — Quiet Glass | `text-secondary` | **7.87** | **5.33** | 1.32 |
| A — Quiet Glass | `text-muted` | **5.97** | 4.25 | 1.27 |
| B — Focus Dark | `text-primary` | **17.53** | **11.07** | 1.53 |
| B — Focus Dark | `text-secondary` | **10.97** | **7.47** | 1.40 |
| B — Focus Dark | `text-muted` | **7.35** | **5.39** | 1.31 |
| C — Warm Slate | `text-primary` | **10.16** | **6.47** | 1.35 |
| C — Warm Slate | `text-secondary` | **6.23** | 4.31 | 1.23 |
| C — Warm Slate | `text-muted` | **4.77** | 3.46 | 1.18 |

### Lowest opacity at which each concept still clears AA (white base, the real one)

| Concept | `text-primary` AA from | `text-muted` AA from |
|---|---:|---:|
| Baseline (shipped) | 68% | **98%** |
| A — Quiet Glass | 64% | 83% |
| B — Focus Dark | 57% | 76% |
| C — Warm Slate | 70% | 93% |

## The finding that matters most — and it is not a reskin

Against the real white base, **every** concept collapses below ~55% opacity. At 20% the best of them
reaches 1.56:1. That is physics, not palette: fading a dark panel toward white destroys white text's
contrast no matter what the text's own alpha is. A reskin can move the cliff (98% → 76%) but cannot
remove it.

The cliff exists **only because the window base is white**. Give the webview an opaque dark base —
one `backgroundColor` in `tauri.conf.json`, or an opaque `background` on `html, body` — and the
black columns above become the real ones: **every tier of every concept, including today's baseline,
clears AA at every slider position from 20% to 100%.** It would also remove the near-white wedges
currently visible in the window's rounded corners.

That is a `src/` change and therefore **out of scope for this phase — not implemented, not
attempted.** It belongs in the follow-on plan, and it is worth more than any of the three concepts.
It does not conflict with picking one; it multiplies whichever is picked.

## Recommendation

**A — Quiet Glass**, plus the dark-base fix above as a separate one-line change.

Reasoning:

- The user asked for a *refresh*, not a redesign, and every prior decision in this plan
  (scope tier = systemize, no behaviour change) points the same way. A is recognisable instantly and
  costs `:root` plus 11 selectors — no JS, no Rust, no layout change, no migration for 1 000 users.
- A closes the four real token-layer gaps (control heights, card type, card radius/padding, card
  text colours) as a by-product. Whatever ships later inherits a cleaner layer.
- B is the strongest on legibility, but it buys its win by nearly deleting the translucency the app
  is built around — and once the dark-base fix lands, **A at 20% opacity is already AA on a dark
  base**, so B's main advantage evaporates while its costs (Rust settings default, opacity default,
  `.seg-card` rewrite, dead blur) do not. Pick B only if the user has decided the glass identity is
  not worth keeping.
- C is the answer if the complaint is "it feels cold", not "it's hard to read". Same cost bracket as
  A, much bigger visual delta, and it is the only one that changes nothing structural — so it is the
  cleanest test of whether *feel* was the real ask.

If none of the three lands, that is a valid outcome: it says the wanted change is structural, and
the follow-on plan should be a layout pass, not a palette pass.

## What a worker verified, and what only you can

Verified here:

- All four pages: **0** external `src=`/`href=`, **0** duplicate element IDs, **all 120**
  `src/index.html` element IDs and **all 91** of its class names present, and `main.css`'s
  post-`:root` tail (1 866 lines) byte-identical in every file.
- All four pages parsed and their harness script executed under jsdom with **zero** errors, driving
  every control: 3 views, 5 card variants, 3 session rows, 3 Q&A rows, summary block, toast,
  recovery dialog, Settings tab switch, and the opacity slider writing `--overlay-opacity: 0.2`.
- `npm test` (vitest) still **108/108** — nothing under `src/` or `tests/` was touched.
- `git status` shows zero changes under `src/` and `src-tauri/`.

Not verified, by construction:

- **Whether any of this looks good.** That is the deliverable and it is a human decision.
- The baseline-vs-real-app screenshot pair (see "Fidelity" above).
