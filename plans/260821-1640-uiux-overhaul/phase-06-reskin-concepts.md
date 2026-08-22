---
phase: 6
title: "Reskin Concepts for User Choice"
status: in-progress
priority: P3
effort: "1-1.5d"
dependencies: [3, 4, 7]
---

# Phase 6: Reskin Concepts for User Choice

## Status — 2026-08-21

Artifacts built and committed. **The deliverable decision is still open: it is the user's.**

Done: steps 1, 3 (opaque branch), 4, 5, 6, 7, 8. Concepts live in `concepts/`, comparison in
`concepts/README.md`.

Not done, and why:

- **Step 2's screenshot pair.** No Windows GUI in the worker environment and the release build is
  deliberately skipped this phase, so the real-app half cannot be captured. Fidelity is instead
  demonstrated mechanically (verbatim `main.css` copy, line-sliced `index.html` markup, runtime DOM
  mirrored from the real renderers, ID/class parity checked). The screenshot instructions are in
  `concepts/README.md`; closing it is a user step.
- **Steps 9 and 10.** Both depend on the user's pick. The Validation Log slot is open in `plan.md`.

Settled while building, both with evidence rather than assumption:

- **VQ1(b) — answered: the window is opaque and its base is white.** Measured from
  `plans/ui-screenshots/issue-2-toolbar.png` (rounded-corner wedges read 220-250 near-white while
  the desktop outside reads 11-25; the panel body reads rgb(75,74,79), matching the white-base
  prediction rgb(75,75,79) and not the black-base rgb(11,11,15)). Therefore **no backdrop switcher
  was built** — one fixed `#ffffff` backdrop, per §6a. This also means **phase 07 §7b's white column
  is the real one**, correcting §7d's expectation that an opaque window would give the black column.
- **The Inter font question — answered: embedded, not substituted.** Inter is not installed on this
  machine, so each page base64-embeds the Inter v20 variable font (latin + vietnamese subsets). No
  network request.

## Overview

The user wants a real visual refresh, but only after the systemize phases land (user decision 7).
This phase delivers **2-3 concrete reskin concepts and a decision — not an implementation.**

Building the chosen concept is a separate, later plan. That boundary is the whole point of this
phase: it converts "do you want a reskin?" from an abstract question into a thing the user can look
at, click through, and pick.

Depends on P3, P4 and P7. A concept is expressed as a `:root` token block plus a small set of
component rules; that representation only exists once P3 has extracted the tokens and P4 has unified
the states. Attempting this before them means hand-editing 1892 lines per concept. P7 matters too:
it changes what the opacity slider *does*, so a harness built on the old group-opacity model would
misrepresent every concept at every setting below 100%.

## Requirements

- Deliverable: 2-3 concepts, each covering **colour, typography, spacing and component look**.
- Deliverable: each concept viewable on Windows with **no build step, no dev server, no Rust
  toolchain** — the user double-clicks a file.
- Deliverable: each concept shows the **real** DOM structure and class names from `src/index.html`,
  not a redrawn approximation.
- Deliverable: a recorded decision — one concept chosen, or an explicit "none of these".
- Constraint: **nothing in `src/` or `src-tauri/` is modified by this phase.** All artifacts live
  in this plan directory.
- Constraint: concepts stay within the platform's real limits — vanilla CSS, no build step, dark
  translucent overlay with user-tunable opacity, Windows/WebView2.

## Architecture

### 6a. Presentation format: standalone self-contained HTML, one file per concept

`plans/260821-1640-uiux-overhaul/concepts/concept-{a,b,c}.html` — each an inline `<style>`
containing a copy of the post-P4 `main.css` with the concept's `:root` block substituted at the top,
plus the real markup for the three views lifted from `src/index.html`. Opened from Explorer via
`file://` in Edge — the same Chromium family as WebView2, so `backdrop-filter`, `rgba()` compositing
and group opacity render faithfully.

Rejected: swapping the app's `<link>` and running `npm run tauri dev` (needs a warm Rust toolchain,
a live window and mic permission prompts just to compare colours, and leaves the tree half-edited
between concepts). Rejected: static images — they cannot show `backdrop-filter` over a varying
wallpaper, cannot show hover/pressed/focus states, and bake in one opacity, which hides the exact
risk this app has.

**Each mock page must embed live controls**, because they are what makes the comparison honest for
*this* app:

- an opacity slider (range 20-100%, default 85%) wired **the post-P7 way** — it must set
  `--overlay-opacity` on the panel wrapper so only the background layer fades, exactly as P7 leaves
  `app.js`. Do **not** replicate the old `style.opacity` group-opacity behaviour; a harness that does
  will make every concept look wrong below 100%. **Always required**; and
- a backdrop switcher (white / black / a photo) behind the panel — **required only if VQ1(b)
  confirms the desktop actually composites through the window.** `tauri.conf.json` sets
  `"transparent": false`, so it may not; in that case the panel resolves against a single fixed
  base colour and a three-way backdrop switcher would model a variable that does not exist in
  production — a fidelity *defect* in the harness, colliding with step 2's own gate. Settle the
  question before building; if the window is opaque, ship one fixed backdrop matching the real base.

Every concept must be judged with those controls moved, not at a single flattering setting.

### 6b. What each concept must specify

A concept is not a mood board. Each one states, concretely:

| Axis | Must specify |
|---|---|
| Colour | Full `:root` colour block: surfaces, borders, text tiers, accent + its states, success/warning/error, the named accents from P3 (`--accent-speaker`, `--accent-translation`, …) |
| Typography | The `--font-size-*` scale values, weights, letter-spacing, and the font stack if it changes (must stay web-safe or already bundled — no new network font without a CSP change) |
| Spacing | The `--space-*` scale values and the resulting toolbar/card/panel density |
| Component look | Toolbar zones and dividers, buttons (rest/hover/active/disabled/focus), the transcript card incl. speaker + translation treatment, the session viewer, Settings fields, toast, modal |
| Contrast | Measured worst-case ratio for each text tier at `overlay_opacity` = 100%, 85% **and 20%**, using the double-composite method and the post-P7 model (background-layer opacity only) — see phase 07 §7b for the worked baseline to compare against |
| Cost | Honest estimate of the follow-on implementation: which files, how many rules beyond `:root`, and what cannot be done in tokens alone |

### 6c. Proposed concept directions

Starting points for the concept work, to be refined while building the mocks. Deliberately spread
across the risk range so the choice is real.

- **A — "Quiet Glass" (evolution, lowest risk).** Keeps the dark glassmorphism identity. Tightens
  the type scale from 7 sizes to 4, snaps spacing to a consistent rhythm, calms the accent, lifts
  every text tier one contrast step, unifies the seven control heights to three. Users would
  recognise it instantly. Implementation is close to token-values-only.
- **B — "Focus Dark" (readability-first).** Trades translucency for legibility: a near-opaque panel,
  minimal chrome, noticeably larger transcript type, the accent reserved for state only. Directly
  answers the contrast finding — text stops being at the mercy of the wallpaper. The trade-off is
  that it moves away from the glass overlay aesthetic the app is built around, and it interacts with
  the user-tunable opacity slider (worth asking whether the slider's default should move with it).
- **C — "Warm Slate" (different feel, same structure).** Same layout and density, a genuinely
  different palette: warm neutral greys, a warmer accent pair. Tests whether the wanted change is
  *feel* rather than *structure*. Cost is close to A; the visual delta is much larger.

Two or three of these ship; A is mandatory as the low-risk baseline to compare against.

## Related Code Files

- Create: `plans/260821-1640-uiux-overhaul/concepts/concept-a-quiet-glass.html`
- Create: `plans/260821-1640-uiux-overhaul/concepts/concept-b-*.html`
- Create (optional third): `plans/260821-1640-uiux-overhaul/concepts/concept-c-*.html`
- Create: `plans/260821-1640-uiux-overhaul/concepts/README.md` — the side-by-side comparison table
  (the 6b axes for all concepts in one view) and the contrast measurements
- Modify: `plans/260821-1640-uiux-overhaul/plan.md` — record the decision in the Validation Log
- **Modify nothing under `src/` or `src-tauri/`.**

## Implementation Steps

1. Branch from the P4 tip (concept files are plan artifacts; no shipped file changes).
2. Extract the post-P4 `main.css` and `src/index.html` markup for the three views into a shared mock
   skeleton. **Fidelity is demonstrated, not asserted:** screenshot the real app and the baseline
   mock at identical window size, identical `overlay_opacity`, and identical display scaling, and
   put the pair in `concepts/README.md`. If they differ, fix the mock first — **no concept built on
   an unfaithful baseline is trustworthy.**
   One known gap to close here: `src/index.html:10` loads Inter from `fonts.googleapis.com`. Opened
   offline, or on a machine without Inter installed, the mock falls back to
   `-apple-system, BlinkMacSystemFont, sans-serif` with different metrics — which would make every
   type-scale and spacing judgement wrong. Base64-embed Inter into the mock skeleton, or accept the
   substitution explicitly and say so in the README. Do not leave it undecided.
3. Add the post-P7 opacity slider to the skeleton (sets `--overlay-opacity`, background layer only —
   see 6a), and the backdrop switcher **only if** VQ1(b) confirmed the desktop composites through.
   Otherwise fix the single real backdrop.
4. Build concept A by substituting its `:root` block plus the minimum component rules it needs.
   Record which changes could **not** be expressed in tokens — that list is the honest cost signal
   and feeds 6b's Cost row.
5. Build concepts B and C the same way.
6. Measure contrast for every text tier in every concept at 100% and 85% opacity against white and
   black backdrops, using the double-composite method. Put the numbers in the comparison README.
   Do not eyeball them.
7. Write the comparison README: one row per concept, one column per 6b axis, plus an explicit
   recommendation with reasoning.
8. Present all concepts to the user together with the plain instruction to open each file, move both
   live controls, and pick one.
9. Record the decision — including "none" — in `plan.md`'s Validation Log, with the reason.
10. If a concept is chosen: state the follow-on plan's scope in one paragraph and stop. **Do not
    start implementing it in this phase.**

## Verification a Worker Can Do

- Each concept file opens standalone with no network request and no missing asset (grep for `http`
  and for `src=`/`href=` pointing outside the file)
- The baseline mock's markup matches `src/index.html`'s class names and structure for all three
  views (diff the extracted markup)
- Contrast numbers reproduce from the stated method
- `git status` shows **zero** changes under `src/` or `src-tauri/`

## Verification a Worker Cannot Do

Whether the concepts look good, and which one the user wants. That is the entire deliverable and it
is a human decision by construction.

## Smoke-Test Gate (HUMAN — blocking, and this one is the deliverable)

1. Open each concept file from Explorer. It renders with no missing styles and no console errors.
2. For each concept, if the backdrop switcher is present, switch white → black → photo and confirm
   text stays readable in all three. If the window turned out to be opaque, judge against the single
   real backdrop instead.
3. For each concept, drag the opacity slider 100% → 85% → 60% → 20%. Note where each concept
   becomes unreadable and compare against the current design.
4. Check each concept's toolbar, a transcript card with speaker + translation, the session viewer
   with a summary, and the Settings panel.
5. Hover and focus a few controls in each — states are part of the concept, not an afterthought.
6. Pick one, or say none. The reason matters more than the pick: it scopes the follow-on plan.

## Success Criteria

- [ ] 2-3 concept files exist, each self-contained, each opening offline from Explorer
- [ ] Each concept specifies all six 6b axes concretely, not as adjectives
- [ ] Each concept's contrast is measured, not estimated, at 100% and 85% opacity against both
      worst-case backdrops
- [ ] Baseline-mock fidelity **demonstrated** by a side-by-side screenshot pair at identical size,
      opacity and display scaling, embedded in `concepts/README.md`, before any concept is built
- [ ] The font question is resolved explicitly — Inter embedded, or the substitution documented
- [ ] The comparison README puts all concepts side by side with an explicit recommendation
- [ ] `git status` shows zero changes under `src/` and `src-tauri/`
- [ ] The user's decision — a concept or "none" — is recorded in `plan.md`'s Validation Log with the
      reason
- [ ] If a concept is chosen, the follow-on plan's scope is written down and **no implementation has
      begun**

## Risk Assessment

| Risk | Mitigation |
|---|---|
| The mock drifts from the real app and the user picks something that cannot be built | Step 2's fidelity check is a hard gate; step 4 records what could not be expressed in tokens |
| Concepts get judged at one flattering opacity/backdrop and the contrast problem re-appears in the shipped app | The live backdrop and opacity controls are mandatory, and step 3 of the smoke gate requires moving them |
| The phase slides into implementing the winner | Explicit non-goal in `plan.md`; success criteria require zero `src/` changes; step 10 stops at scope |
| A concept needs a font that is not available offline | CSP allows `fonts.googleapis.com`/`fonts.gstatic.com`, but a network font on a desktop overlay is a startup-latency and offline risk. Any concept proposing one must justify it and state the fallback stack |
| The "opens offline with no `http` reference" criterion collides with the app's own Google-Fonts `<link>`, silently substituting the font and invalidating every type judgement | Step 2 forces the decision: embed Inter as base64 or document the substitution. Not left to the worker |
| The backdrop switcher models a variable that is fixed in production (`transparent: false`) | Gated on VQ1(b), the one still-open question (phase 07 step 1 owns the check); if the window is opaque, ship one fixed backdrop instead |
| The user picks "none" and the phase reads as wasted | It is not: "none" is a valid, recorded decision that closes an open product question the user explicitly wanted answered |
| Three concepts is more than the choice needs | A is mandatory; the third is optional. Two well-differentiated concepts beat three similar ones |

**Rollback**: nothing to roll back — no shipped file is touched. Concept files can be deleted or
archived with the plan.
