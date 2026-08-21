---
phase: 3
title: "Design Token Layer"
status: pending
priority: P2
effort: "4-6h"
dependencies: [1, 2, 5, 7]
---

# Phase 3: Design Token Layer

## Overview

Finish the half-built token layer in `src/styles/main.css`: resolve the two broken custom
properties, tokenize the rogue colour literals, and add spacing / type / z-index / control-height
scales. **Zero rendered pixels change.** Every token's value is byte-identical to the literal it
replaces.

**Why this earns its place:** it is the enabling phase for P6. Today a reskin means a 1892-line
sweep. After P3, a reskin concept is a `:root` block. That is the payoff — not the tokens
themselves.

Executes **after** Phase 5 and Phase 7 (see plan.md → Execution order). P5 deletes seven
`-webkit-app-region` declarations and rewrites two toolbar rules; P7 moves `#overlay-view`'s
`background` and `backdrop-filter` onto a new `::after` layer and deletes `--text-provisional`.
Tokenizing before either lands would mean tokenizing rules that are about to move. **Re-derive every
census in this file from the immediately preceding tip, not from `969f94e`.**

## Requirements

- Functional: none. No behaviour, no layout, no colour changes.
- Non-functional: `main.css` has zero `var(--x)` referencing an undefined custom property; zero
  raw colour literals outside `:root` except a documented allowlist; spacing, type, z-index and
  control-height scales defined in `:root`.
- Constraint: **token values must equal the literals they replace, byte for byte.** The only
  already-approved value change (`--text-muted` 0.35 → 0.5) landed in P2 and is not repeated here.
- Constraint: `--bg-*`, `--accent*`, opacity and `backdrop-filter` **values** stay untouched — the
  user tunes window opacity at runtime and it interacts with them.
- Constraint: `.seg-card` and the transcript render path get colour tokenization only. No layout
  property may change (the keyed renderer and card layout shipped in v0.6.0).

## Architecture

### 3a. The broken custom properties — resolve with zero pixel change

The file has **four** kinds of custom-property defect, not the one the counsel named. Verified at
`969f94e` by diffing `grep -o 'var(--[a-z0-9-]*'` against the `:root` block.

| Property | State at `969f94e` | Fix |
|---|---|---|
| `--text-dim` | Referenced 4×, **never defined**. Every site silently falls through to its `var()` fallback: `.session-summary-title` (1749) `0.5`, `.session-summary-block strong` (1772) `0.4`, `.session-qa-title` (1821) `0.5`, `.qa-message-system` (1871) `0.5` | **P7 already handled the `0.4` site** (rewritten to `var(--text-muted)` as the approved 3.55:1 → 4.69:1 raise). P3 rewrites the remaining **three** `0.5` sites to `var(--text-muted)` — byte-identical to their fallbacks — and deletes the property. Rendered values identical. |
| `--text-provisional` | Was defined `rgba(255,255,255,0.4)` and referenced zero times | **Deleted by P7**, not revived. Nothing to do here; just confirm it is gone (`grep -c 'text-provisional'` → `0`). |
| `--radius-md` | **Defined** (`10px`), referenced **zero** times — while a raw `border-radius: 10px` literal exists elsewhere in the file | Point that literal at `var(--radius-md)`. Zero pixel change; the token stops being dead. |
| `--transcript-font-size`, `--transcript-font-color` | Referenced in `main.css` (582, 622) but **injected at runtime by JS**, not declared in `:root` (`src/js/ui.js:63/67`, `container.style.setProperty`) | **Legitimate — leave alone.** They must be exempted from the guard test in 3e, or it will report them as orphans forever. |

All contrast **value** changes live in P7. P3 is representation only, so its "zero rendered pixels
change" invariant holds without exception.

Also noted, **not fixed here**: `--transcript-font-color` has two different fallbacks for the same
property — `#ffffff` at 582 and `var(--text-primary)` at 622. Harmless today because JS always sets
the property, but it is a latent inconsistency. Left alone because changing either one is a pixel
change in the failure path; recorded so the next reader does not "fix" it blind.

This resolves every orphan with no new token and no value change.

### 3b. Colour literals — complete assignment, no leftovers

Machine census at `969f94e`, colour literals **outside** the `:root` block: **89 occurrences, 43
distinct.** Every one is assigned below. An earlier draft tokenized ~30 and allowlisted 31, leaving
28 unassigned — which would have forced the worker at step 6 either to dump them into the allowlist
(gutting the guard test) or to invent tokens this plan never approved.

**Policy, decided once:** tokenize *solid* theme colours and the three recurring white surfaces;
**allowlist every alpha variant of a colour that already has a token.** This matches the
`--accent-rgb` decision below — a reskin moves the token, and the alpha variants are derived shades
of it that would need per-site judgement anyway.

**Tokenize — 30 occurrences:**

| Literal | × | Site | New token |
|---|---|---|---|
| `rgba(255,255,255,0.04)` | 8 | panel inset surface | `--surface-1` |
| `rgba(255,255,255,0.05)` | 5 | control surface | `--surface-2` |
| `rgba(255,255,255,0.1)` | 10 | hover / scrollbar-thumb surface — **same value as `--border-light`** | `--surface-3`. Do **not** collapse into `--border-light`: identical value, different intent (background vs border). Collapsing fuses two things a reskin must move independently. |
| `#fff` | 2 | button + toast text on accent (421, 1334) | `--text-on-accent` |
| `#63b3ed` | 1 | float-btn active (696) | `--accent-alt` |
| `#f5a623` | 1 | speaker label (739) | `--accent-speaker` |
| `#facc15` | 1 | minimize hover (254) | `--accent-minimize-hover` |
| `#ef4444` | 1 | `.action-btn` recording (442) | `--error-strong` (keep `--error: #f87171` as well — different colours) |
| `rgba(255,140,200,0.4)` | 1 | translation card left border (623) | `--accent-translation` (a standalone colour, not an alpha variant of any token) |

**Allowlist — 59 occurrences, expressed as three rules plus one exception, not as 59 entries:**

1. **Alpha variants of a tokenized colour** (43 occurrences). Checkable programmatically: parse the
   literal's RGB triple and match it against the triple of every `:root` colour token. Covers
   `rgba(255,255,255,*)` ×20 (`--text-primary`), `rgba(248,113,113,*)` ×9 (`--error`),
   `rgba(99,140,255,*)` ×6 (`--accent`), `rgba(74,222,128,*)` ×4 (`--success`),
   `rgba(251,191,36,*)` ×2 (`--warning`), `rgba(250,204,21,*)` ×1 (`--accent-minimize-hover`),
   `rgba(99,179,237,*)` ×1 (`--accent-alt`).
2. **Black shadows** — `rgba(0,0,0,*)` ×10. No token is black; `box-shadow` colour is not a theme
   surface.
3. **Header washes** — `rgba(20,20,30,*)` ×5 (`#drag-region`, `.sessions-header`,
   `.session-viewer-header`, the compact-reveal bar). Deliberately not `--bg-*`: they sit *inside*
   the panel, and folding them into a bg token would couple them to the opacity-sensitive
   background stack.
4. **One named exception** — `#ffffff` at 582, the fallback of the JS-injected
   `--transcript-font-color`. Not a theme colour; it is a user-set property's default.

30 + 59 = 89. Nothing is unassigned.

**Explicitly not doing: `--accent-rgb: 99, 140, 255` + `rgba(var(--accent-rgb), 0.25)`.** It makes
`--accent` and its alpha variants two sources of truth that a reskin can desynchronise. Rule 1 above
is the alternative and it costs nothing.

**Census currency.** These numbers are `969f94e` and **will be wrong by the time this phase runs.**
P5 and P7 both land first: P7 removes one `rgba(255,255,255,0.4)` (the `--text-dim` fallback it
rewrote) and moves `--bg-primary`'s use onto `#overlay-view::after`; step 2 here removes three
`rgba(255,255,255,0.5)`; P5's new margin utility classes may add spacing literals. **Re-run the
census against the immediately preceding tip** before step 3 and reconcile. The assignment policy
above holds regardless of the counts.

### 3c. Scales

Named against the literals actually present, so the sweep cannot change a value. Semantic names
(not value-derived names) so P6 can shift them without the names lying. The spacing, type and radius
scales are mechanical 1:1 mappings; the control-height scale is an explicit judgement call, flagged
as such below.

```css
/* Spacing — covers the recurring literals in gap/padding/margin. Census at 969f94e:
   1px ×8, 2px ×10, 3px ×2, 4px ×21, 6px ×27, 8px ×25, 10px ×15, 12px ×16,
   14px ×1, 16px ×9, 20px ×4, 24px ×4, 28px ×1.
   Left literal on purpose: 1px and 3px (hairlines), 14px (one-off), and 28px — which is
   `select`'s arrow clearance (main.css:1147), a mechanical offset, not rhythm. */
--space-3xs: 2px;  --space-2xs: 4px;  --space-xs: 6px;   --space-sm: 8px;
--space-md: 10px;  --space-lg: 12px;  --space-xl: 16px;  --space-2xl: 20px;  --space-3xl: 24px;

/* Type — 1:1 with the 7 font-size literals in use. 8px (single use, a badge) stays literal. */
--font-size-xs: 10px;   --font-size-sm: 11px;  --font-size-base: 12px;
--font-size-md: 13px;   --font-size-lg: 14px;  --font-size-xl: 16px;

/* Z-index — named by stacking intent; VALUES UNCHANGED so relative order cannot shift. */
--z-floating: 10;        /* .floating-controls (655) */
--z-compact-reveal: 99;  /* .compact-mode:hover #drag-region.compact-hidden (280) */
--z-compact-catch: 100;  /* .compact-mode::before (270) */
--z-overlay: 1000;       /* .toast (1364), .modal-overlay (1412) */

/* Control heights — a JUDGEMENT CALL, not a frequency rule (see note below).
   These three are the interactive-control heights of the overlay chrome. */
--control-h-sm: 28px;  --control-h-md: 30px;  --control-h-lg: 32px;

/* Radius — completes the existing --radius-sm/-md/-lg. Raw literals in use today:
   4px ×11, 2px ×8, 6px ×2 (= --radius-sm), 10px ×1 (= --radius-md), 5px ×1, 8px ×1. */
--radius-2xs: 2px;  --radius-xs: 4px;   /* new */
/* --radius-sm: 6px, --radius-md: 10px, --radius-lg: 14px already exist — unchanged */
```

**On the control-height scale — say the quiet part.** The `height:` census is 22px ×2, 24px ×1,
26px ×2, 28px ×2, 30px ×2, 32px ×2, so "the three that recur" is not a real criterion: 22 and 26
recur exactly as often as 28 and 30. The tokenized three are the heights of the *overlay chrome's*
interactive controls (`.source-btn` 28, `.action-btn`/`.tts-action-btn` 30, `.icon-btn` 32); 22 and
26 belong to Settings row-remove buttons and the session-viewer header buttons and stay literal.
That is a judgement call about which surface a future reskin resizes together, and it is recorded as
one rather than dressed up as arithmetic. Also note `34px` is `.action-btn`'s **width**
(`main.css:415`), never a height, and `42px` is already `--control-bar-height` — neither belongs in
this scale.

The two raw `6px` and the single raw `10px` `border-radius` literals point at the existing
`--radius-sm` / `--radius-md`. The `5px` and `8px` one-offs stay literal. `50%` (dots) is not a
radius-scale value and stays literal.

Deliberately **not** doing: collapsing the seven control heights to three, or snapping spacing to a
4px rhythm. Both change pixels, which is out of scope. They become candidate proposals in P6.

### 3d. Contrast — settled in P7, restated here for the token work

P7 (Overlay Opacity Restructure) resolved this. The relevant facts for P3:

- `--text-muted` is `rgba(255,255,255,0.5)` and **must not change value here**.
- `--text-provisional` no longer exists — P7 deleted it.
- The old qualified wording ("AA only at `overlay_opacity` ≥ 98%") is **dead**. It described the
  behaviour of group opacity, which P7 removed. Do not reintroduce it anywhere.
- The live AA claim is written in `phase-07` §7b and finalised there against the Validation
  Question 1(b) branch. P3 must not restate or re-derive it.

The one thing P3 owes contrast: the token layer is what makes the claim maintainable — after this
phase, every text tier is a single `:root` line, so a future change moves one value instead of
sweeping the file. That is the only contrast-relevant deliverable of this phase.

### 3e. Guard test (new, permanent)

`tests/js/css-tokens.test.js` — pure text analysis of `src/styles/main.css`, no DOM, no browser.

**Rule 1 — no orphan `var()`.** Every `var(--x)` references an `--x` defined in `:root`, **except**
the runtime-injected properties in a named `RUNTIME_INJECTED = ['--transcript-font-size',
'--transcript-font-color']` array, commented with `src/js/ui.js:63,67`. Without that exemption a
worker following this rule literally will define them in `:root` to make the test pass — which
**changes rendering**, because a `:root` definition beats the `var()` fallback and would silence
line 582's `#ffffff` and line 622's `var(--text-primary)` defaults in the window before
`configure()` runs.

**Parsing.** Use balanced-paren scanning, not a regex. `var\(\s*(--[\w-]+)[^)]*\)` mis-terminates
on both of these, which are real lines in the file:
```
main.css:622   color: var(--transcript-font-color, var(--text-primary));
main.css:1749  color: var(--text-dim, rgba(255, 255, 255, 0.5));
```

**Rule 2 — no dead token.** Every custom property defined in `:root` is referenced at least once.
*(This is the rule that would have caught `--text-provisional` and `--radius-md`, both dead at
`969f94e`.)*

**Rule 3 — no unassigned colour literal.** No colour literal outside `:root` except:
(a) an alpha variant whose RGB triple matches a `:root` colour token's triple — computed, not
listed; (b) `rgba(0,0,0,*)`; (c) `rgba(20,20,30,*)`; (d) `#ffffff` at the
`--transcript-font-color` fallback. Encoding the allowlist as *rules* rather than 59 literal entries
is what keeps this test meaningful — a 59-entry dump would pass vacuously.

**Skip `url(...)` values entirely.** The global `select` rule (`main.css:1145`) embeds a
`data:image/svg+xml` whose arrow is drawn with `stroke='%23888'` — a URL-encoded `#888`. A raw-hex
regex will not match it (fine), but a decode-then-scan implementation would, and any *replacement*
sweep that touched it would silently erase the dropdown arrow. Step 4 must never rewrite inside a
`url()` either.

This is the only automated regression net this refactor can have. It is cheap, it is not a visual
test, and it does not pretend to be one. It cannot catch a cascade or shorthand regression — see the
limits under step 5.

## Related Code Files

- Modify: `src/styles/main.css` — `:root` block; mechanical `var()` swaps throughout all three
  sections (base 1-78, OVERLAY VIEW 79-840, SETTINGS VIEW 841-1512, SESSIONS VIEW 1513-end).
- Create: `tests/js/css-tokens.test.js`.
- Untouched: all `src/js/**`, `src/index.html`, `src-tauri/**`.

**Every line number in this file is relative to `969f94e` and will shift once Phase 5 lands.
Re-grep before editing — do not trust these numbers.**

## Implementation Steps

1. Branch from the P5 tip. Snapshot the baseline: `git show HEAD:src/styles/main.css > /tmp/css-before.css`.
2. **3a** — P7 already rewrote the `0.4` site. Replace the remaining **three** whole
   `var(--text-dim, rgba(255, 255, 255, 0.5))` expressions with `var(--text-muted)` — byte-identical
   values — then confirm `--text-dim` has no references left. Commit alone.
   First re-grep: `grep -n 'text-dim' src/styles/main.css` must show exactly three hits. If it shows
   four, P7's 7c did not land — stop and fix that first.
3. **3b** — add the colour tokens to `:root`; replace each listed literal. One commit per token
   group (`--surface-*`, then the named accents), never one big sweep.
4. **3c** — add the scales to `:root`; replace literals **only where the property matches the
   scale's intent**. Before each batch run `grep -n '<literal>' src/styles/main.css` and read the
   property name on **every** hit. A matching number is **not** spacing when it is a `line-height`,
   `border-radius`, `width`, `height`, an SVG attribute, a `box-shadow` blur/spread radius
   (`main.css:429`, `1344`), a `backdrop-filter: blur()` radius (`main.css:1368`), or a
   `background-position` offset (`main.css:1147`). One commit per scale.
   Never rewrite inside a `url(...)` value — see the data-URL hazard in 3e.
5. **Value-parity proof — and its limits.** Run a one-off Node script (not committed) that reads a
   CSS file and emits, for **every declaration, keyed by `selector → property` in source order**,
   the value with `var(--x)` expanded one level from `:root`. Run it before and after; `diff` it.

   **Expect exactly one non-empty diff, and only on the 3a commit.** Before,
   `color: var(--text-dim, rgba(255,255,255,0.5))` cannot expand (`--text-dim` is undefined, so the
   resolver has nothing in `:root` to substitute); after, `color: var(--text-muted)` expands to
   `rgba(255,255,255,0.5)`. The strings differ although the rendered value does not. Run the parity
   check **per commit** and record 3a's diff as expected-and-reviewed; a worker who "fixes" it will
   revert a correct change. Every other commit's diff must be empty.

   **What this gate cannot see** — do not treat an empty diff as proof of no regression:
   - **Cascade.** Moving a declaration between selectors, or changing source order, is invisible if
     the script sorts or dedupes. Keying by `selector → property` in source order is what makes
     order-sensitivity partially visible; specificity changes still are not. So: **this phase moves
     no declaration between selectors.** Token swaps only.
   - **`!important` position.** `.shortcut-hint` (`main.css:501-505`) carries three, including
     `color: var(--text-muted) !important`. Relative rule order still decides the winner.
   - **Declaration order inside a rule.** `padding` then `padding-left` differs from the reverse.
   - **Shorthand vs longhand.** `background: <colour>` resets `background-image`;
     `background-color: <colour>` does not. A resolved-value diff shows the same text either way
     while the computed background-image changes. **Rule for step 4: never replace a shorthand with
     a longhand or vice versa.** This is exactly the bug that made
     `.export-format-select` lose its dropdown arrow (see phase 05 §5d).
   - `@keyframes` blocks (6 of them: 328/445/565/791/804/1389) and `url()` values, which the script
     does not model and step 4 must not touch.

6. **3e** — write `tests/js/css-tokens.test.js` with the allowlist; make it pass.
7. `powershell.exe -NoProfile -Command "npm test"` from `/mnt/d`, `tr -d '\r'` the output.
8. `powershell.exe -NoProfile -Command "npm run tauri build"`; stat the exe.
9. Update `docs/code-standards.md` with a short "CSS tokens" subsection: the scales, the allowlist
   rule, and a pointer at the guard test. This is the only doc change P3 warrants — no user-visible
   behaviour changed.
10. Hand back for the smoke gate.

## Verification a Worker Can Do

- Value-parity diff empty (step 5) — **this is the phase's primary gate**
- `grep -c 'text-dim' src/styles/main.css` → `0`
- `npm test` green including the new guard test; no existing test weakened or deleted
- Windows build artifact on disk with a fresh mtime
- `git diff --stat` shows `src/styles/main.css` + `tests/js/css-tokens.test.js` only

## Verification a Worker Cannot Do

Whether the app still *looks* right. The value-parity diff proves the CSS resolves identically; it
does not prove WebView2 paints it identically (e.g. a token used in a shorthand where the literal
was longhand). The human visual pass below is the real gate.

## Smoke-Test Gate (HUMAN — blocking)

A visual spot-check, not the full checklist — no behaviour changed.

1. Overlay: start a session. Cards, speaker labels, provisional (grey) text, the pink-bordered
   translation line, placeholder and shortcut hints all look exactly as before.
2. Toolbar: all five zones, dividers, the blue Start button, the red recording state, the amber
   minimize hover, the accent-blue pin — all unchanged.
3. Settings: open every tab. Labels, hints, placeholders, badges, sliders, selects unchanged.
4. Sessions: list and viewer. Session meta text, summary card, Q&A block unchanged.
5. Toast + the crash-recovery modal both still appear **above** everything else (z-index tokens).
6. Compact mode: hover-reveal still reveals the bar (z-index tokens again — this is the pair most
   likely to break).
7. Drag the opacity slider from 100% to 20% and back — nothing renders differently from before.

Side-by-side with a pre-P3 build is ideal but not required. Phase closes on user confirmation.

## Success Criteria

- [ ] Per-commit value-parity diff empty for every commit except 3a, whose single expected diff is
      recorded and reviewed (step 5)
- [ ] No declaration moved between selectors; no shorthand↔longhand substitution anywhere in the diff
- [ ] `tests/js/css-tokens.test.js` passes: no orphan `var()` (bar the two `RUNTIME_INJECTED`
      exemptions), no unused `:root` property, no colour literal outside the four allowlist rules
- [ ] Every colour literal in the post-P5 census is assigned to tokenize or to a named allowlist
      rule — none left over
- [ ] `grep -c 'text-dim' src/styles/main.css` → `0`; `grep -c 'text-provisional' src/styles/main.css` → `0` (P7 deleted it)
- [ ] Spacing, type, z-index and control-height scales present in `:root`
- [ ] Full vitest suite green; no test weakened or deleted; `cargo test` green
- [ ] Windows exe artifact verified on disk
- [ ] Smoke steps 1-7 confirmed by the user
- [ ] `docs/code-standards.md` documents the token conventions and the allowlist rule

## Risk Assessment

| Risk | Mitigation |
|---|---|
| A batch replace changes a value that only *looked* like spacing (a `16px` line-height becoming `--space-xl`) | Step 4's mandatory per-hit property-name read; step 5's value-parity diff catches anything that slips |
| One big commit makes a bad swap unbisectable | One commit per token group; `git bisect` stays useful |
| Collapsing `--border-light` and `--surface-3` (identical values) fuses two intents a reskin needs separate | Explicitly not collapsed; rationale in 3b |
| `--accent-rgb` split desynchronises `--accent` from its alpha variants | Explicitly not doing it; the six accent alphas stay literal and allowlisted |
| Custom properties cannot be used in `@media` conditions or animated directly | No breakpoint or `@property` work is in scope; swapping a literal for a `var()` inside a transitioned property is safe because the transition targets the resolved property, not the token |
| P6 later changes a token value and silently breaks a component that relied on the literal coincidence | The guard test does not catch this. P6's own gate is a human visual pass across all three views |

**Rollback**: revert the phase's commits in reverse order. `main.css` is the only shipped file
touched; `tests/js/css-tokens.test.js` is additive and can be deleted independently.
