---
title: "UI/UX Overhaul — Systemize"
description: "Fix the two reported UI defects, extract a design-token layer, normalize interaction states, clear the small-fix backlog, then present reskin concepts for user choice"
status: in-progress
priority: P1
effort: "1.5-2w"
tags: [ui, ux, css, design-tokens, accessibility, windows]
created: 2026-08-21
blockedBy: []
blocks: []
---

# UI/UX Overhaul — Systemize

## Overview

My Translator v0.6.0 works; its UI does not scale. Two user-reported defects (session-viewer
overflow, unreadable/ungrouped toolbar) are symptoms of structural CSS debt: a half-built token
layer, zero `:focus-visible`, five duplicated scrollbar rule-sets, an undefined `--text-dim`, a
toolbar with no width strategy, and an opacity control that fades the transcript along with the
panel. This plan fixes the two defects (P1, P2 — already implemented, awaiting human smoke), clears
the shipped small-fix backlog (P5), makes the opacity slider stop fading text (P7), extracts the
token layer (P3), normalizes interaction states (P4), and closes with reskin concepts the user
chooses from (P6).

Scope tier is **systemize**, not redesign. Rendered pixels stay the same except where the user
explicitly approved a change: muted-text contrast (decision 4), the toolbar icon pass (VQ3), the
window width change (VQ2), and the opacity restructure (VQ1a) — which deliberately changes how the
overlay looks at low opacity settings.

## Context

- Seed: `plans/reports/thinker-260821-1617-mytranslator-uiux-overhaul-counsel.md` (accepted by
  user 2026-08-21). Source claims re-verified against `969f94e` for this plan; corrections in the
  Counsel Corrections table below.
- P1 + P2 shipped to branch `feat/uiux-p1-p2-session-scroll-toolbar` as commit `969f94e`
  (`feat(ui): single-scroll session viewer and 5-zone toolbar`). Builder report:
  `plans/reports/builder-260821-1617-uiux-p1-p2.md`. 91/91 vitest, 7/7 cargo settings tests,
  Windows exe artifact verified on disk. **Not yet human-smoked.**
- Platform: Tauri 2, WebView2 (Chromium), **Windows only**. Vanilla JS + plain CSS, **no bundler,
  no build step for the frontend** — `src/styles/main.css` (1892 ln) ships raw.
- Frontend reaches Tauri only through `window.__TAURI__` (`withGlobalTauri: true`). There is **no**
  `@tauri-apps/api` npm dependency; `package.json` devDependencies are `@tauri-apps/cli`, `jsdom`,
  `vitest` only.
- ~1000 monthly users. **No visual regression suite exists and none is being built.** Every visual
  acceptance criterion in this plan is a HUMAN smoke-test step run by the user against
  `docs/smoke-test-checklist.md`. A worker can verify only: grep/ID stability, vitest, cargo test,
  and that the Windows build artifact exists on disk.
- All build/test commands run through `powershell.exe -NoProfile -Command "<cmd>"` from a `/mnt/d`
  path (WSL2 host, Windows toolchain). Pipe output through `tr -d '\r'`. Never the WSL Linux
  toolchain — the crate cannot compile for Linux by design.
- Element IDs are load-bearing: `src/js/**` reads **109 distinct** `getElementById` IDs against 120
  in `src/index.html`. **No phase renames or removes an ID without the grep proof named in that
  phase.**
- **No test reads `src/index.html`** (`grep -rn 'index.html' tests/` → empty). `npm test` is green no
  matter what an HTML edit breaks, so for every phase that touches HTML the ID-parity grep is
  currently the *only* net. P5 closes this with `tests/js/html-id-bindings.test.js`; until then, do
  not treat vitest green as evidence about HTML.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Session viewer: one scroll region, summary above transcript, nothing clipped | P1 |
| 2 | Toolbar: five labelled zones, no unreadable controls, nothing clipped at any allowed window width | P1 |
| 3 | Ship-correct small fixes: dynamic version string, dead Electron CSS gone, no duplicate back button | P1 |
| 4 | One design-token layer: spacing / type / z-index / control-height scales; zero orphan `var()`; zero rogue color literals outside `:root` | P2 |
| 5 | Consistent interaction states: `:focus-visible` everywhere, one `:disabled` convention, one scrollbar rule-set, `aria-pressed` on toggles | P2 |
| 6 | Overlay opacity fades the panel, not the text — transcript stays readable at every slider position | P1 |
| 7 | A real reskin proposal the user can choose from — concepts + a decision, not a committed implementation | P3 |

## Non-Goals

- Full visual redesign. P6 delivers **concepts and a decision only**; implementing the chosen
  concept is a separate, later plan.
- Any framework, bundler, CSS preprocessor, or new dependency.
- macOS anything. macOS support was deliberately deleted on `main`; do not reintroduce it.
- Feature/behaviour change. This is a UI/UX pass — every existing action stays reachable and
  behaves the same. **One deliberate exception, approved by the user (VQ1a):** the opacity slider
  keeps its range, its persistence and its meaning, but it no longer fades text and content. At low
  settings the overlay therefore looks materially different from today. That is the point of P7, not
  a regression.
- Touching `transcript-card-renderer.js` or the `.seg-card` render path — phase-5 perf work just
  shipped in v0.6.0 (P3 tokenizes `.seg-card` *colors* only, values unchanged).
- Changing `--bg-*` / `backdrop-filter` token **values**. P7 changes which *element* carries them;
  the values themselves stay byte-identical.
- Adding a window-state restore feature. P5 deletes the dead `window_state` write; the user
  explicitly declined wiring up restore.
- Raising sub-28px hit targets outside the toolbar (VQ6 — final decision to leave them).
- Any responsive/breakpoint strategy for the toolbar (VQ2 chose the window-minimum route; the
  media-query alternative is dropped, not deferred).
- Building a visual regression suite.
- Any GitHub publish, issue creation, push, or wiki publish from this plan.

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 1 | [Session Viewer Single Scroll Region](./phase-01-session-viewer-scroll-region.md) | In progress (code landed, human smoke pending) | P1 |
| 2 | [Toolbar Regroup and Demotions](./phase-02-toolbar-regroup.md) | In progress (code landed, human smoke pending) | P1 |
| 3 | [Design Token Layer](./phase-03-design-token-layer.md) | Pending | P2 |
| 4 | [Interaction State Normalization](./phase-04-state-normalization.md) | Pending | P2 |
| 5 | [Small Fixes and Narrow-Width Hardening](./phase-05-small-fixes.md) | Pending | P1 |
| 6 | [Reskin Concepts for User Choice](./phase-06-reskin-concepts.md) | In progress (concepts built, user decision pending) | P3 |
| 7 | [Overlay Opacity Restructure](./phase-07-overlay-opacity-restructure.md) | Pending | P1 |

### Execution order — deliberately not phase-number order

**P1 → P2 → P5 → P7 → P3 → P4 → P6.**

P5 is pulled ahead of P3/P4. Rationale: P5 fixes defects that are **live in the shipped v0.6.0
build**; P3 and P4 are latent debt with no user-visible symptom.

1. **Wrong version string, everywhere.** The About tab renders a hardcoded `v0.5.2` while the app is
   `0.6.0` (`src/index.html:664`; no JS ever writes `#about-version`).
2. **The toolbar has a hard minimum width the window does not respect.** Re-derived at `969f94e`:
   the bar needs **≈597 CSS px** of window width (full table in phase 05 §5b).
   `src-tauri/tauri.conf.json` permits `minWidth: 400`, so the entire 400-596 band clips the window
   zone — at 400 the deficit is ~197px and close, minimize and pin disappear outright. A user only
   has to drag the window narrower to lose the close button.
3. **The status readout P2 just added is unusable at the default width.** At `width: 600` the bar
   fits with 3px to spare, all of which goes to `.status-area` (`flex: 1; min-width: 0`). Its label
   ellipses to nothing and the dot plus `#status-elapsed` (`flex-shrink: 0`) paint outside their
   0-width parent, over the transcript icons.

**Two corrections to earlier drafts of this rationale, kept visible so they are not re-made:**
an earlier version claimed the bar clips at the 600px default — it does not; it fits by 3px, and the
default-width defect is (3) above, not clipping. And `plans/ui-screenshots/issue-2-toolbar.png` was
cited as evidence for the current bar; it is the **pre-P2** toolbar (it still shows the export-format
pill and the folder button P2 removed), so it documents the original defect only.

P5 is file-disjoint from P3 except for the toolbar rules listed in phase 05, and it lands
`tests/js/html-id-bindings.test.js`, which is what gives P4's HTML edits a safety net.

**P7 slots in after P5 and before P3** for two reasons. It is the user's answer to the contrast
question and delivers the most user-visible improvement in the plan, so it should not queue behind
two quality-debt phases. And it moves `#overlay-view`'s `background` and `backdrop-filter` onto a new
`::after` layer — P3 must tokenize the restructured rules, not rules that are about to move. P7 also
owns every contrast **value** change (including the `--text-provisional` raise-by-deletion), which is
what lets P3 keep a strict "zero rendered pixels change" invariant.

Dependency chain: P1 and P2 are independent of each other but both landed in one commit. P5
depends on P2's smoke gate (it hardens the bar P2 built). P7 depends on P5. P3 depends on P5 and P7
(both rewrite CSS that P3 would otherwise tokenize). P4 depends on P3 (it consumes the tokens P3
defines). P6 depends on P3, P4 and P7 — concepts are token-value sets that only exist after P3, and
its preview harness must model P7's opacity behaviour, not the old group-opacity one.

Because P4 and P5 both edit `src/index.html`, they must not run in parallel. Every phase except P6
edits `src/styles/main.css`; sequential execution only.

### Human smoke checkpoints (mandatory, blocking)

`docs/smoke-test-checklist.md` requires a human on Windows with GUI and audio. No worker can run
it. Every phase in this plan ends with a blocking checkpoint: worker reports done → **user** runs
the phase's smoke steps → phase closes only on user confirmation. Vitest/cargo green gates *merge*;
human smoke gates *release*. Each phase file carries its own `## Smoke-Test Gate` section with the
exact click-path.

P1 and P2 share one combined smoke gate (they shipped in one commit). **The canonical lists are the
`## Smoke-Test Gate` sections of `phase-01` and `phase-02` in this directory** — not the builder
report's list, which numbers its steps differently and asserts as *expected* that the window controls
stay visible at all widths, which is the opposite of what phase 02 step 11 measures. Where they
disagree, this plan's phase files win.

**phase-02 smoke step 11 is a hard prerequisite for P5, not a nice-to-have:** it produces the
measured narrow-width floor that P5 §5b reconciles against its ≈597px derivation. Without it P5
cannot start.

## Counsel Corrections

Claims from the accepted counsel report re-checked against `969f94e`. Everything not listed here
verified as written.

| Counsel claim | Verified state | Effect |
|---|---|---|
| "`getVersion()` from `@tauri-apps/api` (already a dependency)" | **Wrong.** No `@tauri-apps/api` in `package.json`. All Tauri access is `window.__TAURI__` (`withGlobalTauri: true`). | P5 uses `window.__TAURI__.app.getVersion()`, which `core:default` already permits (`core:app:default` → `allow-version`); Rust-command fallback specified in phase 05. |
| "verify/force `minWidth` in tauri.conf" | `minWidth: 400`, `minHeight: 200` are **already set**. The real defect is that the bar's ≈597px minimum sits above `minWidth: 400`, and that at the 600 default the status zone collapses to 3px. | P5 reframed from "add minWidth" to raising it: `minWidth` 400 → 600 and `width` 600 → 680 (VQ2), plus `overflow: hidden` on `.status-area`. |
| "`-webkit-app-region` … main.css 126, 328, 374, 1541, 1642, 774" (6 sites) | 7 sites: 126, 206, 378, 424, 824, 1592, 1693 (at `969f94e`). | P5 deletes all 7. |
| "Scrollbar styling duplicated 4×, missing on `.qa-messages`" | Now **5×** — P2 added the `.qa-messages` set rather than sharing one. Only `#transcript-container` has a `:hover` thumb rule. | P4 consolidates 5 → 1. |
| "About tab hardcodes v0.5.2 (index.html:646)" | True; line is **664** at `969f94e`. | P5. |
| "Toolbar 16 → 12" vs builder's measured "16 → 14" | **Both correct, different counting.** 12 counts the 3-button source picker as one segmented control (1 app + 3 transport + 4 transcript + 4 window). 14 counts DOM buttons. The implemented DOM matches the approved zone spec exactly. | Resolved, not a defect. No action. |
| Not in counsel: `.export-format-select` (`main.css:1793`) still styled with `padding: 2px 4px` while inheriting `width: 100%` + `padding-right: 28px` + arrow at `right 10px` from the global `select` rule (`main.css:1132`) | The **session-viewer** copy of this select (`#select-session-export-format`) still has the bug — it is the wide empty box beside "Copy" in `issue-1-sessions-popup-no-scrollbar.png`. P2 only moved the *toolbar* one. | Added to P5. |
| Not in counsel: `window-manager.js:46` writes `localStorage.window_state` on every close/minimize; **nothing ever reads it** | Confirmed — `grep -rn 'window_state' src/js/` returns the write only, and `tauri.conf.json` has `"plugins": {}`. Dead code. Also means the app always launches at the configured size, which *de-risks* changing the default width. | Deleted in P5 §5g (VQ4). No restore feature added — the user declined it. |
| Not in counsel: `.export-format-select` uses the `background` **shorthand** (`main.css:1794`), which resets `background-image` — and it out-specifies the global `select` rule | The dropdown arrow is **not rendered at all** on that control. P2's recorded cause for the toolbar pill ("text sat under the arrow") was wrong; its fix was right for a different reason. | Corrected in P5 §5d, which no longer prescribes arrow clearance for an absent arrow. |
| Not in counsel: **no test reads `src/index.html`**; `src/js/**` binds **109 distinct** IDs | `npm test` is green regardless of what an HTML edit breaks. | P5 adds `tests/js/html-id-bindings.test.js`; plan.md's ID-risk framing corrected. |

## Cross-Plan Scan

| Plan | Status | Relationship | Constraint it imposes here |
|---|---|---|---|
| `plans/260406-2309-ai-session-summary/` | `completed` | None (no block) | Owns `#session-summary-section`, `#session-viewer-content`, `ai-summary.js`. P1 moved the summary above the transcript in DOM order; its show/hide is `style.display` by ID, so order is safe. P3/P4 must not alter summary-card colors' rendered values. |
| `plans/260406-card-layout-speed/` | `completed` | None | Owns `.seg-card` layout + the unified card model. P3 tokenizes `.seg-card` color literals only; **no layout property may change**. |
| `plans/260821-1053-meeting-focus-optimize-refactor/` | frontmatter says `pending`, **actually shipped and released as v0.6.0** (merge `fbc8250`, tag `v0.6.0`, `plans/reports/release-v0.6.0.md`) | Not a blocker — complete. Its decisions constrain this plan. | Do not undo: keyed incremental card renderer (`ui.js`, phase 5), TTS base-class unification, Windows-only deletion, crash-safe flush, session Q&A, `sessionLog[]`/`segments[]` invariants. No JS file may exceed 600 LOC. |

No `blockedBy`/`blocks` edges are warranted — all three overlapping plans are complete, so no
bidirectional frontmatter update is needed.

**Recorded discrepancy (no action taken by this plan):** all six phase files and the plan
frontmatter of `260821-1053-meeting-focus-optimize-refactor` still read `status: pending` although
the work merged and released. This plan was scoped to write only inside its own directory, so the
stale status was left as-is. Recommend `ak plan check` on those six phase files in a separate,
unrelated pass.

## Success Criteria

- [ ] User confirms the P1+P2 smoke gate: one scrollbar in the session viewer, summary above
      transcript, header and Q&A input always visible, Q&A scrollbar thin and styled, toolbar shows
      five divider-separated zones, export honours the format chosen in Settings across an app
      restart, folder button opens from the Sessions header
- [ ] About tab shows the running version, verified equal to `package.json` `version` after a
      version bump — no hardcoded string remains (`grep -n 'v0\.[0-9]' src/index.html` empty)
- [ ] At the app's minimum allowed window width **after P5**, every window-zone control (compact,
      pin, minimize, close) is fully visible and clickable — human-verified at both minimum and
      default width, with that minimum stated as a number in P5's report
- [ ] At the default launch width the status dot, label and elapsed time are legible and do not
      overlap the transcript icons
- [ ] `grep -c 'app-region' src/styles/main.css` → `0`
- [ ] Only one back button is visible in the session-viewer state
- [ ] `--text-dim` gone; **zero** `var(--x)` in `main.css` references an undefined custom property,
      excepting the two JS-injected properties (`--transcript-font-size`, `--transcript-font-color`)
      held in the guard test's named exemption array
- [ ] Spacing / type / z-index / control-height / radius scales exist in `:root`; every colour
      literal outside `:root` is either tokenized or matched by one of the four allowlist **rules**
      in phase 03 §3b — none unassigned (guarded by the same test)
- [ ] Every P3 token-swap commit is value-identical: a per-commit var-resolution pass produces an
      empty diff, with exactly one documented exception — the 3a commit, whose diff is expected
      (an unresolvable `var(--text-dim, …)` fallback becoming a resolvable `var(--text-muted)`)
      and must be reviewed rather than "fixed"
- [ ] No declaration moved between selectors and no shorthand↔longhand substitution anywhere in P3
- [ ] The opacity slider fades the overlay panel but **not** its text or content: at 20% the panel is
      nearly invisible while the transcript stays fully legible, and the glass blur still blurs
- [ ] `grep -n 'style.opacity' src/js/` → empty; opacity reaches the DOM only as the
      `--overlay-opacity` custom property, guarded by `tests/js/overlay-opacity.test.js`
- [ ] `--bg-*` and `backdrop-filter` values byte-identical after P7 — only their owning element moved
- [ ] `overlay_opacity` still persists across a full restart and still applies at startup
- [ ] The AA claim in the plan is the one computed in phase 07 §7b against the VQ1(b) branch; no
      "AA at ≥98% opacity" wording survives anywhere
- [ ] `minWidth: 600`, `width: 680` in `tauri.conf.json`; no media queries added to the toolbar
- [ ] Toolbar icons normalized (16px zone-primary / 14px rest), no squashed icon, Sessions shows a
      list glyph; every element ID unchanged
- [ ] `saveWindowPosition()` and all three of its call sites deleted; no window-state restore added
- [ ] Tab through the overlay, Settings, and Sessions views: a visible focus ring appears on every
      interactive control and is never clipped. (The 3:1 contrast is a code check — solid `--accent`
      is pre-computed at 4.46-5.70:1 — not something a human can eyeball)
- [ ] `grep -c 'outline: none' src/styles/main.css` → `0`
- [ ] One shared `::-webkit-scrollbar` rule-set; five duplicated sets gone
- [ ] `aria-pressed` correct on pin / TTS / compact; source picker exposes its selected state
- [ ] `npm test` (vitest) green with no test weakened or deleted; `cargo test` green
- [ ] Windows build artifact exists on disk after each phase that touches shipped files
- [ ] P6 ends with the user having **chosen** one reskin concept (or explicitly chosen none), with
      the decision recorded in this plan's Validation Log

## Risks

| Risk | Mitigation |
|------|------------|
| Token refactor silently changes rendered pixels for 1000 users with no regression net | P3 is mechanical literal→`var()` only, token values byte-identical to the literals replaced; one-off var-resolution diff must be empty; human visual spot-check on all three views before merge |
| An element ID is renamed/removed and a `getElementById` binding breaks at runtime (no compile step catches it, and today no test reads the HTML either) | Every phase that touches HTML runs the ID-parity grep specified in that phase and pastes the output in its report. P5 adds `tests/js/html-id-bindings.test.js` so P4's HTML edits have a real net. No ID is removed without proof of zero JS/test references |
| `:focus-visible` ring clipped by an ancestor `overflow: hidden` (`#overlay-view`, `.sessions-body`) or invisible on the glass surface | Technique is specified in one place only — phase 04 §4a: `outline` everywhere, `outline-offset: -2px` on the enumerated at-risk controls. (`box-shadow` would **not** help: an ancestor `overflow: hidden` clips it identically.) Human keyboard pass is the gate |
| Existing `outline: none` rules out-specify the new zero-specificity `:focus-visible` rule, so the ring silently never appears on colour dots, text/password inputs and range sliders | Deleting all four is a numbered build step in phase 04, with `grep -c 'outline: none'` → `0` as a success criterion |
| Raising `minWidth` removes the narrow-overlay use case; widening the default changes the launch size for every user | Cost accepted by the user (VQ2): he never runs narrower than ~600px. Widening the default is verified safe — `window_state` is written but never read and `"plugins": {}` means no window-state plugin, so the app always launches at the configured size and no saved geometry exists to disturb |
| An earlier draft's toolbar-zone `overflow: hidden` would have clipped P4's focus rings on 9 of 14 buttons and the Start-button hover glow at every width | Removed from phase 05; "no `overflow` on any `.toolbar-zone`" is a success criterion in P5 and a pre-build check in P4 |
| Builder's P1/P2 work fails the human smoke and needs rework, invalidating P3-P6 line refs | P1/P2 smoke is a hard gate before P5 starts. All line numbers in this plan are `969f94e`-relative and every phase re-greps before editing |
| `backdrop-filter` ancestors break `position: sticky`/`fixed` descendants (WebView2/Chromium creates a containing block) | Standing rule across all phases: **no `position: sticky` inside the overlay or session viewer.** Pin by keeping the element outside the scroller, as P1 did |
| P7's `::after` layer makes the glass blur go inert because something turns `#overlay-view` into a backdrop root | The design adds no stacking context to the host (no `isolation`, no host `z-index`) and lifts the four children instead. Smoke step 3 of phase 07 checks the blur explicitly, worded so "looks fine" cannot mask it |
| P7 changes how the app looks at low opacity — crisp content on a nearly-invisible panel, with the border and drop shadow still visible | Intended and approved (VQ1a). Called out in phase 07 §7a and confirmed, not discovered, in smoke steps 1-2 |
| P7 buys nothing because the overlay composites against a light base | Exactly what VQ1(b)'s one-minute check determines. Both branches are pre-written in phase 07 step 1, so implementation is never blocked — only the *claim* waits |
| Raising `minWidth` to 600 strands a user who did want a narrow overlay | User confirmed he never runs narrower than ~600px. The responsive alternative is dropped, not deferred; reopening it is a new decision |
| P6 reskin concepts drift into an unrequested implementation | P6's only deliverable is concepts + a recorded decision. Implementation is explicitly a later, separate plan |
| WCAG AA cannot be *guaranteed* on a translucent overlay over an arbitrary desktop background | Contrast criteria in P3/P4 are stated against the worst realistic composite and bounded by the opacity setting, not as an absolute promise. See phase 03 |

## Validation Log

### Session 1 — 2026-08-21

#### Verification Results
- Claims checked: 21 by the planner, then re-attacked by two independent adversarial reviewers
- Planner pass: 21 verified, 7 counsel claims corrected (table above)
- Red-team pass: **4 blockers + 8 majors + 10 minors**, all evidence-backed against `969f94e`
- Evidence: direct `grep`/`sed`/census scripts over `src/styles/main.css`, `src/index.html`,
  `src/js/*.js`, `tests/`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`,
  `package.json`; both UI screenshots read; four subagent reports —
  `researcher-260821-1642-webview2-tauri-constraints.md`,
  `researcher-260821-1642-contrast-tokens-reskin.md`,
  `debugger-260821-1702-css-refactor-hazards.md`,
  `code-reviewer-260821-1642-uiux-plan-red-team.md`

#### What the red-team changed (blockers)
| # | Finding | Change made |
|---|---|---|
| B1 | P5's prescribed `overflow: hidden` on the toolbar zones would clip P4's focus ring on 9 of 14 buttons and the Start-button hover glow at **every** width | Zone clipping removed from P5 entirely; replaced by a window-minimum change (VQ2 chose it over the responsive alternative). "No `overflow` on any `.toolbar-zone`" is now a success criterion in P5 and a pre-build check in P4 |
| B2 | P4's `:where()` ring is specificity `(0,1,0)`; three of the four existing `outline: none` rules beat or tie it, so the ring would never appear on colour dots, text/password inputs or range sliders — and P4's own smoke step 4 tests exactly those | Deleting all four `outline: none` declarations promoted from a footnote to numbered build step 3, with a specificity table and `grep -c 'outline: none'` → `0` as a criterion. The "zero specificity means existing rules win" rationale — which was backwards — was rewritten |
| B3 | The 614px toolbar derivation double-counted `.status-area` (a `flex:1 1 0%; min-width:0` element contributes only its margin to a flex minimum) and omitted `.tts-action-btn`'s 2px border; the real figure is ≈597px, so the bar **fits** at the 600 default. The cited screenshot is also the **pre-P2** toolbar | Table re-derived; the default-width defect restated as the status zone collapsing to 3px (a legibility/overlap defect), clipping restated as the 400-596 band; screenshot demoted to evidence for the *original* defect only; phase-02's measured floor made a hard prerequisite for P5 |
| B4 | plan.md's risk row prescribed a `box-shadow` ring while phase 04 prescribed `outline` — and `box-shadow` is clipped by ancestor `overflow: hidden` identically, so it would not have worked either | Technique now stated in one place (phase 04 §4a); plan.md's row points at it |

#### What the red-team changed (majors and minors, condensed)
- **Colour census completed.** 89 occurrences / 43 distinct outside `:root`; an earlier draft left 28
  unassigned. Now every one is tokenized or matched by one of four allowlist *rules* (alpha-variant-
  of-a-token, black shadows, header washes, one named exception) — rules, not a 59-entry dump that
  would pass vacuously.
- **Guard test made implementable.** Runtime-injected `--transcript-font-*` exemption written into
  rule 1 (it contradicted §3a); balanced-paren parsing mandated (a `var\(...\)` regex mis-terminates
  on two real lines); `url()` values skipped so the `%23888` arrow in the `select` data-URI survives.
- **Value-parity gate honest about itself.** It false-alarms on the 3a commit (documented as
  expected); it is blind to cascade, `!important` position, intra-rule order and shorthand↔longhand.
  Keyed by `selector → property` in source order, plus a hard "move no declaration between selectors,
  never swap shorthand for longhand" rule.
- **`.session-copy-btn:disabled:hover` kept**, not folded — the shared `:disabled` rule sets only
  `opacity`/`cursor` and would have let disabled viewer buttons light up on hover.
- **`.export-format-select` diagnosis corrected.** Its `background` shorthand erases the inherited
  arrow, so there is no arrow to clear; P2's recorded cause was wrong even though its fix was right.
- **Scales made honest.** Spacing census now lists 14px/28px as deliberate exclusions with reasons;
  the control-height scale is labelled a judgement call rather than a frequency rule that did not
  survive counting; `34px` identified as a width, not a height.
- **ID-risk framing corrected.** 109 distinct bound IDs, not ~40, and **no test reads
  `src/index.html`** — so "vitest gates merge" was false for every HTML-touching phase. P5 now adds
  `tests/js/html-id-bindings.test.js`, the highest-value test in the plan.
- **`.status-area { overflow: hidden }`** added — the elapsed timer is `flex-shrink: 0` inside a
  zone that resolves to 0 width, so it paints over the transcript icons.
- **Smoke gates de-conflicted.** phase-01/phase-02's lists are canonical over the builder report's;
  new steps added for the Start-button glow at default width, the elapsed timer during a narrow-width
  recording, and before/after screenshots for the P3 and P5 visual claims.
- **Unmeasurable criteria fixed.** "ring meets 3:1" moved from the human gate to a code check;
  "spacing looks exactly as before" now compares against captured screenshots; "every window width"
  now names a floor.
- **phase-06 fidelity gate given a method** (side-by-side screenshot at identical size/opacity/DPI)
  and the Inter web-font substitution forced to an explicit decision.

#### Decisions
| # | Question | Decision |
|---|----------|----------|
| 1 | Scope tier | Systemize — fix defects + token layer + state normalization. Not a redesign. **User decision, final.** |
| 2 | Session viewer summary placement | Above the transcript, inside one scroll region. **User decision, final.** |
| 3 | Toolbar zones + demotions | Approved as specified (5 zones; export-format select → Settings; folder button → Sessions view). **User decision, final.** |
| 4 | Muted/hint contrast | Raise to WCAG AA; small visible change accepted. **User decision, final.** Landed in P2 as `--text-muted` 0.35 → 0.5. The token bump alone could not reach AA in the overlay because element opacity faded the text too — the user then chose the root-cause fix (VQ1a), now **Phase 7** |
| 5 | Behaviour compatibility | No feature change. **User decision, final.** |
| 6 | macOS | Never. **User decision, final.** |
| 7 | Reskin | Wanted, but only after the systemize phases; delivered as 2-3 concepts to choose from. **User decision, final.** |
| 8 | Execution order | P5 pulled ahead of P3/P4 — planner decision, rationale re-derived after B3 |
| 9 | "16 → 12" vs "16 → 14" | Counting convention (segmented source picker as one control vs three buttons), not a gap. Closed without action |
| 10 | Colour alpha variants: tokenize or allowlist? | Allowlist, by rule. Consistent with rejecting `--accent-rgb`. Planner decision |
| 11 | Focus-ring technique | `outline` + `outline-offset`, solid `--accent`; inset offset on enumerated at-risk controls. Single source of truth in phase 04 §4a |

#### Whole-Plan Consistency Sweep — Session 1
Run 2026-08-21 after applying every red-team finding. Superseded numbers purged; one technique per
decision; frontmatter acyclic; cross-references resolved. Two contradictions left deliberately open
for the user — they are answered in Session 2 below.

### Session 2 — 2026-08-21, validation answers applied

All seven validation questions answered by the user. Answers are final; the plan was updated to
match, and the rejected alternatives were **deleted rather than demoted to fallbacks**.

#### Decisions
| # | Question | Answer | Where it landed |
|---|---|---|---|
| VQ1(a) | Contrast — accept qualified AA wording, or fix the root cause? | **Fix the root cause.** Stop applying group opacity to text; opacity hits a background layer only. New scope, cost accepted | **New [Phase 7](./phase-07-overlay-opacity-restructure.md)**, executed after P5 and before P3 |
| VQ1(b) | Does the desktop actually composite through the window? | **Not yet checked.** Do not block, do not assume | phase 07 step 1 — a numbered, blocking, **user-owned** prerequisite with both branches pre-written; also still gates phase 06's backdrop switcher |
| VQ2 | Toolbar width — raise the window minimum, or make the bar responsive? | **Raise the minimum.** `minWidth` 400 → 600, `width` 600 → 680. User never runs narrower than ~600px. Responsive alternative dropped entirely | phase 05 §5b; phase-02 smoke step 11 retained as the hard prerequisite |
| VQ3 | Toolbar icon sizes + Sessions clock glyph | **Build both** | phase 04 §4e, ungated |
| VQ4 | Dead `window_state` write | **Delete it.** No restore feature | phase 05 §5g |
| VQ5 | `--text-provisional` at 3.55:1 | **Raise to match `--text-muted`** | phase 07 §7c — implemented as raise-by-deletion, since "matching" makes it a duplicate token |
| VQ6 | Sub-28px hit targets outside the toolbar | **Leave them.** Not deferred either | phase 04 §4f |
| VQ7 | Session-viewer format dropdown | **Restore the arrow and constrain the width** | phase 05 §5d; arrowless alternative dropped |
| — | "16 → 12" vs "16 → 14" | **14 is correct.** The source picker is three real buttons; merging them would be an unapproved behaviour change | phase 02, Control count |
| — | Elapsed-time digit colour | **Stay always-muted**; only the status label changes colour by state | phase 02, Architecture |
| — | Double stacked back button | **Fix it** | phase 05 §5e, no longer conditional |
| — | `260821-1053` stale phase statuses | **Authorized to correct the `status:` field only** | Done — see Cross-Plan Scan |
| — | `docs/smoke-test-checklist.md` never executed | **Leave the doc alone**; the P1+P2 smoke run is its first real pass | P5 step 12 still fixes the Copy/Export staleness |

#### What VQ1(a) actually buys — computed, not asserted
Double-composite model, `--bg-primary` `rgba(15,15,20,0.88)`, bounding bases white and black:

- **Dark composite base:** the fix is complete. `--text-muted` goes 4.09 → **5.33** at 85% opacity and
  holds **5.29** at 20%, where today it collapses to 1.20. Contrast becomes effectively independent
  of the slider, and every text tier clears AA at every position.
- **White composite base:** before and after are **identical** — fading a dark panel toward white
  destroys white text's contrast regardless of the text's own alpha. Physics, not implementation.

Hence VQ1(b) is now decision-critical rather than cosmetic: it determines which column is real. Full
table and both branches in phase 07 §7b/§7d.

#### Whole-Plan Consistency Sweep — Session 2
Re-read `plan.md` and all seven phase files after applying the answers. Greps run for every option
that is now dead:

| Dead thing | Grep | Result |
|---|---|---|
| Responsive/breakpoint toolbar | `max-width:`, `media quer`, `breakpoint`, `flex-shrink: 3` | Only as an explicitly-dropped alternative in phase 05 §5b and this log |
| "AA at ≥98% opacity" wording | `98%`, `≥ 98` | Gone; phase 03 §3d states it is dead and must not return |
| `minWidth` staying at 400 | `minWidth: 400`, `minWidth` | Only in the historical framing of the defect (the 400-596 clipping band), never as a target |
| Raising hit targets | `hit target`, `≥28px` | Only in phase 04 §4f as a final decision to leave them |
| Window-state restore | `window_state`, `restore` | Only in phase 05 §5g as a deletion, with "do not wire up restore" |
| `--text-provisional` revival | `text-provisional` | Deleted in phase 07 §7c; phase 03 §3a confirms and does not revive it |
| "16 → 12" as a live figure | `16 → 12` | Only as the corrected counting note in phase 02 and this log |
| Arrowless format select | `arrowless` | Only as the dropped alternative in phase 05 §5d |
| VQ gating language | `Validation Question`, `CONFIRM BEFORE` | All now read as answered decisions; the only live one is VQ1(b), correctly scoped to phase 07 step 1 and phase 06 §6a |

Also verified: frontmatter `dependencies` — p1 `[]`, p2 `[]`, p5 `[2]`, p7 `[5]`, p3 `[1,2,5,7]`,
p4 `[3]`, p6 `[3,4,7]` — acyclic and consistent with P1→P2→P5→P7→P3→P4→P6. All numbered step
sequences contiguous. One technique per decision still holds (focus ring, disabled mechanism, width
strategy, opacity mechanism). No unresolved contradictions remain.

## Unresolved Questions

**One, and it is owned by the user, not the plan.**

**VQ1(b) — does the desktop composite through the window?** `tauri.conf.json` sets
`"transparent": false` and no window background is configured in `src-tauri/src/`, so the overlay may
resolve against a single fixed colour rather than the wallpaper. One minute to settle: run the app
over a bright wallpaper, drag opacity to 20%, and report whether the wallpaper shows through.

It does **not** block implementation — phase 07 step 1 pre-writes both branches and both build the
same code. It determines two things: what the finalised AA claim says (a dark base makes P7 a
complete fix; a light one makes it neutral), and whether phase 06's concept harness needs a
three-way backdrop switcher or a single fixed backdrop.

Everything else is decided. See the Validation Log → Session 2 for the full answer set.

<!-- slug: uiux-overhaul -->

### Session 3 — 2026-08-21, Phase 6 concepts delivered

Artifacts: `concepts/baseline-current.html`, `concepts/concept-a-quiet-glass.html`,
`concepts/concept-b-focus-dark.html`, `concepts/concept-c-warm-slate.html`, `concepts/README.md`.
Zero changes under `src/` or `src-tauri/`; vitest 108/108.

#### VQ1(b) — CLOSED. The window is opaque and the base is white.

The plan's last open question, answered by measurement rather than assumption. `"transparent": false`
with no `backgroundColor` set anywhere; `plans/ui-screenshots/issue-2-toolbar.png` read pixel by
pixel shows the window's rounded-corner wedges at 220-250 (near-white) while the desktop just
outside reads 11-25, and the panel body at rgb(75,74,79) — which is exactly
`rgba(15,15,20,0.88)` × 0.85 over **white** (predicted rgb(75,75,79)); over black it would be
rgb(11,11,15).

Two consequences, both recorded rather than acted on:

1. **Phase 06's backdrop switcher was not built** — one fixed `#ffffff` backdrop, exactly the branch
   §6a prescribes for an opaque window.
2. **Phase 07 §7b's white column is the real one, not the black one.** §7d expected the opposite
   ("that is the good branch"). P7's restructure is still correct as built and still delivers what
   the user asked for — text no longer fades with the panel — but it does **not** deliver contrast
   independence from the slider, because against a white base fading a dark panel destroys white
   text's contrast regardless of the text's own alpha. Measured: `--text-muted` reaches AA only at
   **≥98%** opacity on the shipped design. (The "AA at ≥98% opacity" wording purged in Session 1 was
   purged on the assumption of a dark base; against the real base it is the accurate figure.)

**No phase changed any code in response.** Phase 07 is closed; correcting its claim is a
documentation matter, and the remedy below is a `src/` change outside Phase 6's scope.

#### Highest-value finding, deliberately not implemented

Every concept — and the baseline — collapses below ~55% opacity against the white base. The cliff
exists only because the base is white. Giving the webview an opaque dark base (one `backgroundColor`
in `tauri.conf.json`, or an opaque `background` on `html, body`) makes **every text tier of every
concept clear AA at every slider position from 20% to 100%**, and removes the near-white wedges
visible in the window's rounded corners. It is worth more than any reskin and is independent of
which concept is chosen. Out of scope for Phase 6 (`src/` is untouchable there) — it belongs to the
follow-on plan.

#### Decision — OPEN

| # | Question | Decision |
|---|----------|----------|
| 12 | Which reskin concept ships? | **Pending.** Open A, B and C, move the opacity slider on each, pick one or say "none". Recorded here with the reason once given. Worker recommendation: **A — Quiet Glass**, plus the dark-base fix as a separate one-line change. |
