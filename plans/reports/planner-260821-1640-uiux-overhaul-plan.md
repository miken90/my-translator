# Planner report — my-translator UI/UX overhaul, deep plan

Deliverable: `plans/260821-1640-uiux-overhaul/` — `plan.md` + `phase-01..07`. 2331 lines.
`ak plan validate` → OK. No application code written. Nothing under `src/` or `src-tauri/` was
touched; no git state-changing command run.

> **Read Session 2 at the bottom for the current state.** Everything above it is the Session-1
> record, written before the user's validation answers arrived. Where the two disagree — the phase
> count, the execution order, the `260821-1053` status note — **Session 2 is authoritative.**

**Baseline moved mid-session.** The builder finished P1+P2 and committed `969f94e`
(`feat(ui): single-scroll session viewer and 5-zone toolbar`) while this plan was being written, so
the whole plan was re-baselined onto it rather than onto `b4cdf50`. P1 and P2 are therefore planned
as `in-progress` — code landed, human smoke outstanding — exactly as the dispatch required, and
their phase files document the agreed approach without redesigning it.

**ak CLI note:** `ak plan create` generates its own `<timestamp>-<slug>` directory and could not
produce the mandated `260821-1640-uiux-overhaul` path, so files were written by hand in the house
style of `plans/260821-1053-meeting-focus-optimize-refactor/` and validated with
`ak plan validate`. No stub-read step was skipped because no stubs were generated.

## Phase table

| # | Phase | Status | Pri | Effort | Deps | Human smoke gate |
|---|---|---|---|---|---|---|
| 1 | Session Viewer Single Scroll Region | in-progress (code in `969f94e`) | P1 | 0.5d | — | 8 steps — one scrollbar, summary above transcript, header + Q&A pinned |
| 2 | Toolbar Regroup and Demotions | in-progress (code in `969f94e`) | P1 | 1d | — | 11 steps — zones, export format across restart, drag, narrow-width **measurement** |
| 5 | Small Fixes and Narrow-Width Hardening | pending | P1 | 3-5h | 2 | 12 steps — version, width floor, drag re-test, glow, overlap |
| 3 | Design Token Layer | pending | P2 | 4-6h | 1,2,5 | 7 steps — visual spot-check, all three views + compact + toast |
| 4 | Interaction State Normalization | pending | P2 | 4-6h | 3 | 9-10 steps — keyboard pass, disabled, scrollbar hover |
| 6 | Reskin Concepts for User Choice | pending | P3 | 1-1.5d | 3,4 | 6 steps — **the gate is the deliverable**: user picks a concept or "none" |

**Execution order is P1 → P2 → P5 → P3 → P4 → P6**, not phase-number order. P5 carries the only
defects live in shipped v0.6.0; P3/P4 are latent debt. Frontmatter `dependencies` encode this and are
acyclic. All phases edit `main.css`, and P4+P5 both edit `index.html` — sequential only, no
parallelism.

*(Session 2 inserted Phase 7 into this order: **P1 → P2 → P5 → P7 → P3 → P4 → P6**.)*

Every visual acceptance criterion is written as a human smoke step, and each phase says plainly what
a worker can verify (ID-parity grep, vitest, cargo, artifact on disk) versus what only the user can.

## Cross-plan scan

| Plan | Status | Relationship | Constraint |
|---|---|---|---|
| `260406-2309-ai-session-summary` | completed | none | Owns `#session-summary-section` / `ai-summary.js`. P1 reordered its DOM (safe — toggles are `style.display` by ID) |
| `260406-card-layout-speed` | completed | none | Owns `.seg-card`. P3 tokenizes its colours only; no layout property may change |
| `260821-1053-meeting-focus-optimize-refactor` | frontmatter says `pending`, **actually merged `fbc8250` and released as v0.6.0** | none (complete) | Do not undo: keyed renderer, TTS base class, Windows-only deletion, crash-safe flush, Q&A, `sessionLog`/`segments` invariants, no JS file >600 LOC |

No `blockedBy`/`blocks` edges warranted — all three overlapping plans are complete, so no
bidirectional frontmatter update was needed. **Recorded, not acted on in Session 1:** all six phase
files of `260821-1053` still read `status: pending` despite shipping; I was scoped to write only
inside my own plan directory. *(Session 2: the user authorized the correction — the six `status:`
lines now read `completed`. Nothing else in those files was touched.)*

## Red-team: what was found, what changed

Two adversarial reviewers ran against the plan and the source (`code-reviewer`, `debugger`), plus two
researchers (WebView2/Tauri constraints; contrast/tokens/reskin methodology). Reports in
`plans/reports/`. Between them: **4 blockers, 8 majors, 10 minors** — all evidence-backed. Every one
was applied.

### Blockers

1. **P5's toolbar-zone `overflow: hidden` would have destroyed P4.** My draft prescribed
   `min-width: 0; overflow: hidden` on the transport and transcript zones. Zones have zero padding,
   so their clip box is exactly their children's bounding box — a 2px focus ring at 2px offset would
   have been clipped on all four sides for **9 of 14 toolbar buttons**, and
   `.action-btn:hover`'s `box-shadow: 0 0 12px` glow clipped at **every** width for every user.
   → Zone clipping removed entirely. Width handled by an explicit decision instead.
   "No `overflow` on any `.toolbar-zone`" is now a P5 criterion and a P4 pre-build check.

2. **My focus-ring specificity reasoning was backwards.** `:where(...):focus-visible` is `(0,1,0)`.
   `input[type="text"], input[type="password"]` and `input[type="range"]` are `(0,2,0)` and beat it;
   `.color-dot` ties and wins on source order. Three of four controls would have stayed ring-less —
   and P4's own smoke step tests exactly those three. Deleting the four `outline: none` declarations
   was a footnote, not a step. → Promoted to numbered build step 3 with a specificity table and
   `grep -c 'outline: none'` → `0` as a criterion; the "zero specificity means existing rules win"
   rationale rewritten as the liability it is.

3. **My ~614px toolbar derivation was wrong, and it was the stated reason for reordering P5.**
   `.status-area` is `flex: 1` **plus** explicit `min-width: 0`, so it contributes only its 4px
   margin to a flex minimum — I had counted its 23px content width. I also omitted
   `.tts-action-btn`'s 2px border. Real figure: **≈597px**, so the bar *fits* at the 600 default with
   3px to spare. Worse, I cited `issue-2-toolbar.png` as evidence for the current bar — it is the
   **pre-P2** toolbar (still shows the export pill and folder button P2 removed).
   → Table re-derived. The clipping defect restated honestly as the 400-596 band that `minWidth: 400`
   permits. The default-width defect restated as what actually happens: the status zone collapses to
   3px, so P2's new label ellipses to nothing and the dot + elapsed timer paint over the transcript
   icons. Phase-02's *measured* floor is now a hard prerequisite for P5, overriding the arithmetic.

4. **plan.md prescribed `box-shadow` where phase-04 prescribed `outline`** — and `box-shadow` is
   clipped by ancestor `overflow: hidden` identically, so it would not have worked either.
   → One technique, one place (phase 04 §4a).

### Majors and minors, condensed

- **Colour census completed.** 89 occurrences / 43 distinct outside `:root`; my draft left **28
  unassigned** — systematically, every alpha companion of the solids it tokenized. Now every literal
  is either tokenized or matched by one of four allowlist **rules** (alpha-variant-of-a-token,
  black shadows, header washes, one named exception). Rules rather than a 59-entry dump, which is
  what keeps the guard test from passing vacuously.
- **Guard test made implementable.** Rule 1 contradicted §3a — a worker following it literally would
  have defined the JS-injected `--transcript-font-*` in `:root`, which *changes rendering*.
  Exemption array written in; balanced-paren parsing mandated (a `var\(...\)` regex mis-terminates on
  two real lines); `url()` skipped so the `%23888` arrow in the `select` data-URI survives.
- **The value-parity gate now admits its limits.** It false-alarms on exactly the 3a commit it must
  bless (documented as expected, so nobody "fixes" a correct change), and it is blind to cascade,
  `!important` position, intra-rule order and shorthand↔longhand. Keyed by `selector → property` in
  source order, plus hard rules: move no declaration between selectors, never swap shorthand for
  longhand.
- **`.session-copy-btn:disabled:hover` kept, not folded** — the shared `:disabled` rule sets only
  `opacity`/`cursor`, so folding it would let disabled viewer buttons light up on hover.
- **`.export-format-select` re-diagnosed.** Its `background` **shorthand** resets `background-image`
  and it out-specifies the global `select` rule, so there is **no arrow on it at all** — my §5d was
  prescribing 24px of clearance for an arrow that does not exist. (P2's fix for the toolbar twin was
  right; its recorded cause was wrong.)
- **Scales made honest.** Spacing census now names 14px/28px as deliberate exclusions with reasons;
  the control-height scale is labelled a judgement call rather than a frequency rule that does not
  survive counting; `34px` identified as a *width*, never a height.
- **ID-risk framing corrected.** 109 distinct bound IDs, not ~40 — and **no test reads
  `src/index.html`**, so "vitest gates merge" was false for every HTML-touching phase. P5 now adds
  `tests/js/html-id-bindings.test.js`; it is the highest-value test in the plan and it lands before
  P4 needs it.
- **`.status-area { overflow: hidden }`** added — `#status-elapsed` is `flex-shrink: 0` inside a zone
  that resolves to 0 width, so it paints over the transcript icons during a narrow-width recording.
- **Smoke gates de-conflicted.** phase-01/02's lists are canonical over the builder report's (which
  numbers steps differently and asserts as *expected* that window controls stay visible at all
  widths — the opposite of what P5 fixes). New steps: Start-button glow at default width; elapsed
  timer during a narrow-width recording; before/after screenshots for P3's and P5's visual claims.
- **Unmeasurable criteria fixed.** "ring meets 3:1" moved from the human gate to a code check
  (pre-computed 4.46-5.70:1); "spacing looks exactly as before" now compares against captured
  screenshots; "at every window width" now names a floor.
- **phase-06 fidelity gate given a method** — side-by-side screenshot at identical size, opacity and
  DPI — and the Inter web-font substitution forced to an explicit decision rather than left to
  collide with the "opens offline" criterion.

### What survived verification

All phase-frontmatter dependencies; the 7 `-webkit-app-region` sites; `about-version:664`;
`window_state` written-never-read; the `--text-dim` fallbacks matching their replacement tokens
byte-for-byte; inline group opacity on `#overlay-view` only; all five scrollbar rule-sets being
byte-identical; `.icon-btn`'s `min-width: 32px` binding; the TTS `disabled`-property conversion being
behaviour-safe (both entry points guard inside `toggle()`); and every spot-checked line number.

## Corrections to the accepted counsel report

Re-checked at `969f94e`; seven claims needed correcting, recorded in `plan.md` → Counsel Corrections.
The two that change what gets built: **`@tauri-apps/api` is not a dependency** (all Tauri access is
`window.__TAURI__`, so `getVersion()` comes from the global, with a Rust `env!` fallback specified),
and **`minWidth`/`minHeight` are already set** — the defect is that 400 sits below the bar's floor,
not that the setting is missing.

## Contrast: the finding that most affects user decision 4

User decision 4 ("raise muted/hint text to WCAG AA") landed in P2 as `--text-muted` 0.35 → 0.5. That
clears AA (4.685:1 worst case) in the **Settings and Sessions views**. It does **not** clear AA in
the overlay, because `app.js:263` applies `overlay_opacity` (default 0.85, range 20-100%) as CSS
**group** opacity on `#overlay-view`, which re-composites the already-translucent text and panel
together: **3.515:1 at the shipped default**, and AA would need ~98% opacity.

Raising the alpha further cannot fix it — it would have to exceed 1.0 to compensate — and it washes
out the design at 100%. So the plan states a *qualified* criterion rather than promising AA it cannot
deliver. This is not a re-litigation of the decision; it is what the decision physically buys, and
what remains is Validation Question 1.

---

## Validation questions for the user

Seven. **None blocks starting P5's other items or P3's first two steps.** Q1 and Q2 do block one
item each; the rest are preference calls with a recommendation attached.

**1. Contrast — how should the AA promise be worded, and does the desktop actually show through?**
Two linked parts.
(a) `--text-muted` passes AA in Settings and Sessions but fails in the overlay at the default 85%
opacity (3.5:1), because opacity is applied as group opacity to the whole overlay. Options:
**(i)** accept and document "AA guaranteed in Settings/Sessions, and in the overlay at ≥98% opacity"
*(recommended — honest, costs nothing, changes no pixels)*; **(ii)** raise the default
`overlay_opacity` above 85%; **(iii)** treat overlay muted text as decorative and drop the AA claim
there; **(iv)** stop applying group opacity to text (restructure so opacity hits a background layer
only — a real change, outside the current scope).
(b) A 60-second check that changes the wording and phase 06's concept harness: `tauri.conf.json` has
`"transparent": false`, so the desktop may never composite through at all. **Run the app over a
bright wallpaper at opacity 20% and tell me whether the wallpaper shows through.** Either way the AA
conclusion holds (3.5-4.1:1); only the phrasing and whether phase 06 needs a backdrop switcher
depend on it.

**2. Toolbar width — raise the window minimum, or make the bar responsive?**
The bar needs ≈597px; `minWidth` is 400, so anywhere in the 400-596 band the close button is clipped
away. Options: **(i)** `minWidth: 400 → 600`, `width: 600 → 680` — clipping becomes impossible and
the status readout becomes legible, but a narrow overlay strip is no longer possible *(recommended
unless you actually use a narrow window)*; **(ii)** keep `minWidth: 400` and hide the transcript zone
below a breakpoint — preserves the narrow overlay, but copy/export/sessions/clear vanish until you
widen. Both are fully specified in phase 05 §5b. **Do you ever run the window narrower than ~600px?**

**3. Toolbar icon work — build it or drop it?** The counsel's toolbar spec asked for normalized icon
sizes (16px zone-primary / 14px rest; they are currently 13/14/16/18 plus one squashed non-square
icon) and swapping the Sessions **clock** icon for a list/document glyph. Neither is in the dispatch's
enumeration of decision 3, and P2 did not build them. Both are visible changes. Build in P4, or drop?

**4. Dead `window_state` write.** `window-manager.js` saves window position/size to `localStorage` on
every close and minimize; nothing ever reads it, and there is no window-state plugin. Delete the dead
code *(recommended)*, wire up restore (a small new feature, outside this plan's scope), or leave it?

**5. `--text-provisional` (alpha 0.4) is 3.55:1 even at full opacity** — below AA. It is currently
unused; after P3 it styles `.session-summary-block strong` in the Sessions view. Raise it to match
`--text-muted`, or accept it as decorative emphasis?

**6. Sub-28px hit targets outside the toolbar.** Five controls are 22-26px: the float buttons, the
session-viewer header buttons, and the Settings row-remove buttons. Raising them relayouts Settings
and the viewer header. Leave them *(recommended — unrequested visual change)*, or raise them?

**7. Session-viewer format dropdown — arrow or no arrow?** It currently has none (its `background`
shorthand erased it) and stretches full-width. Fix as **(i)** restore the arrow and constrain the
width *(recommended — proper dropdown affordance)*, or **(ii)** just constrain the width and leave it
arrowless (smaller change, weaker affordance).

**Also worth a decision, though not blocking:** `docs/smoke-test-checklist.md` still says *"Status:
not yet run — this checklist is a template until a human completes the first pass."* Every phase gate
in this plan delegates release safety to it. Its Copy/Export section is already stale post-P2 (P5
step 12 fixes that), but nothing fixes "never executed once against 1000 live users."

---

# Session 2 — validation answers applied (2026-08-21)

All seven questions answered. Plan updated; **rejected alternatives deleted, not demoted to
fallbacks**. `ak plan validate` → OK. Plan is now **7 phase files + plan.md**.

## Where each answer landed

| Q | Answer | Landed |
|---|---|---|
| VQ1(a) | Stop applying group opacity to text — the root-cause fix | **New phase 7** (see below) |
| VQ1(b) | Wallpaper check not yet run | phase 07 step 1 — numbered, blocking, **user-owned**, both branches pre-written |
| VQ2 | `minWidth` 400→600, `width` 600→680; responsive alternative dropped | phase 05 §5b, Related Files, steps, smoke, risks |
| VQ3 | Build the icon normalization + Sessions list glyph | phase 04 §4e, ungated |
| VQ4 | Delete the dead `window_state` write, no restore | phase 05 §5g (new), 3 call sites named |
| VQ5 | Raise `--text-provisional` to match `--text-muted` | phase 07 §7c — as raise-by-deletion |
| VQ6 | Leave sub-28px hit targets | phase 04 §4f, final |
| VQ7 | Restore the dropdown arrow, constrain width | phase 05 §5d, alternative dropped |
| — | 16 → **14** is correct | phase 02, Control count rewritten |
| — | Elapsed digits stay muted | phase 02, Architecture |
| — | Fix the double back button | phase 05 §5e, unconditional |
| — | `260821-1053` stale statuses | **Corrected** — six `status: pending` → `completed`, status field only, nothing else touched |
| — | Leave `smoke-test-checklist.md` alone | Unchanged; P5 step 12 still fixes the Copy/Export staleness |

## Where the contrast work landed — new Phase 7

`plans/260821-1640-uiux-overhaul/phase-07-overlay-opacity-restructure.md`, executed **after P5,
before P3** (order is now P1 → P2 → P5 → **P7** → P3 → P4 → P6).

**Mechanism.** `app.js:263`'s `overlayView.style.opacity` is CSS *group* opacity — it flattens the
whole subtree and fades text with the panel. Move `background` + `backdrop-filter` off
`#overlay-view` onto a new `#overlay-view::after` layer, put the opacity there, and drive it from a
custom property: `overlayView.style.setProperty('--overlay-opacity', …)`. One JS line; content and
text render above the layer at full strength.

Design decisions worth flagging, each with its reason in the phase file:

- **`::after`, not `::before`** — `::before` on this element is already the compact-mode hover strip
  (`.compact-mode` is applied to `#overlay-view` itself).
- **Child-lifting (`z-index: 1` on the four direct children), not `isolation: isolate` + `z-index: -1`
  on the host.** Making the host a stacking context risks turning it into a *backdrop root*, which
  would leave the moved `backdrop-filter` with nothing to sample — the glass blur would silently go
  inert. Smoke step 3 checks the blur explicitly for exactly this reason.
- **Border and box-shadow stay on the host**, so they do not fade. Moving the border would change the
  content box by 2px and disturb the toolbar-width arithmetic P5 just settled; moving the shadow
  would need `overflow: hidden` dropped. Consequence — a faint outline still marks the window at 20%
  opacity — is called out and put in the smoke gate rather than left to be discovered.
- **VQ5 implemented as deletion.** "Match `--text-muted`" makes `--text-provisional` a duplicate
  token, so P7 deletes it and rewrites the one 0.4 site to `var(--text-muted)`. That also lets **P3
  keep a strict "zero rendered pixels change" invariant** — every contrast *value* change now lives
  in P7, and P3 does representation only.

**What it actually buys — computed, not asserted.** Double-composite model, `--bg-primary`
`rgba(15,15,20,0.88)`, bounding bases white and black:

| Tier | opacity | base | before | after |
|---|---|---|---|---|
| `--text-muted` | 0.85 | black | 4.09 | **5.33** |
| `--text-muted` | 0.20 | black | 1.20 | **5.29** |
| `--text-muted` | 0.85 | white | 3.52 | 3.52 |
| `--text-secondary` | 0.20 | black | 1.23 | **6.26** |
| `--text-primary` | 0.20 | black | 1.55 | **17.30** |

Two conclusions, and they are the whole story:

1. **Against a dark composite base the fix is complete** — contrast becomes essentially *independent
   of the slider*. Every tier clears AA at every position, including 20%.
2. **Against a white composite base it changes nothing** — the before/after columns are identical.
   Fading a dark panel toward white destroys white text's contrast no matter what the text's own
   alpha does. Physics, not implementation.

Which means **VQ1(b) is now decision-critical rather than cosmetic.** `tauri.conf.json` has
`"transparent": false` and no window background is configured, so the base may well be fixed — and if
it is dark, branch 1 is the real one and this phase is a clean win. Both branches build the *same*
code, so implementation is never blocked; only the finalised AA claim waits. phase 07 step 1 is
written as a blocking, user-owned prerequisite with both outcomes pre-specified.

Branch-B remedies (an opacity floor on the background layer, or a backdrop-independent text
treatment such as a dark `text-shadow`) are **specified but explicitly not built** — both are visible
changes beyond what was approved, and they are presented for a separate decision.

## Consistency sweep — Session 2

Re-read `plan.md` + all seven phase files. Greps run for every option that is now dead:
responsive/breakpoint toolbar, "AA at ≥98% opacity", `minWidth: 400` as a target, hit-target raising,
window-state restore, `--text-provisional` revival, "16 → 12" as a live figure, arrowless format
select, and VQ-gating language. Every surviving hit is either historical framing (the 400-596
clipping band), an explicitly-labelled dropped alternative, or the sweep table itself. Three real
leftovers were found and fixed: phase 05's Related-Files line still offering the media-query route,
and two plan.md rows still describing VQ2 and VQ4 as open.

Frontmatter dependencies re-checked and acyclic: p1 `[]`, p2 `[]`, p5 `[2]`, p7 `[5]`,
p3 `[1,2,5,7]`, p4 `[3]`, p6 `[3,4,7]`. All numbered step sequences contiguous (phase 07: 1-11).

**One cross-phase catch found during the sweep, not in the answers file:** phase 06's concept harness
specified an opacity slider "mirroring `app.js:263` exactly as it applies it". After P7 that
mechanism is different, so a harness built the old way would misrepresent every concept below 100%
opacity. phase 06 now requires the post-P7 wiring (`--overlay-opacity`, background layer only),
gained `7` in its dependencies, and its contrast axis now requires a 20% measurement as well.

## NEW unresolved question from this round

**One, and it is a consequence of VQ1(a) rather than a gap in it.**

The opacity slider's *meaning* changes. Today it fades the whole window; after P7 it fades the panel
while text, card tints, dividers and toolbar zone backgrounds stay at full strength. At 20% the app
will look materially different from today — crisp content floating on a nearly-invisible panel, with
a faint border and drop shadow still marking the window edge. That is the direct, intended
consequence of the decision, and the phase is written to have the user *confirm* it at the smoke gate
rather than discover it. **If the user expected "everything fades except the transcript text" rather
than "everything except the background fades", that is a different design** — worth one sentence of
confirmation before P7 is built, though it does not block writing the plan.

Everything from Session 1 is otherwise closed.

Status: DONE
Summary: All seven validation answers applied to `plans/260821-1640-uiux-overhaul/`; the contrast decision (VQ1a) became a new Phase 7 — Overlay Opacity Restructure — executed after P5 and before P3, with a computed before/after contrast table showing the fix is complete against a dark composite base and neutral against a light one.
Concerns/Blockers: VQ1(b) (does the desktop composite through the window) is still unanswered and is now decision-critical rather than cosmetic — it determines which contrast column is real. It does not block implementation: phase 07 step 1 pre-writes both branches and both build the same code; only the finalised AA claim waits. One new question this round: P7 deliberately changes what the opacity slider looks like at low settings, and it is worth confirming the user expected that shape of change.
