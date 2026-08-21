# Phase 6 — Reskin Concepts: implementation report

Branch `feat/uiux-p1-p2-session-scroll-toolbar`, on top of `d6dced3` (P3+P4). Phase 6 only — the
last phase. No branch created, nothing pushed, no PR. Release build deliberately skipped per
dispatch.

Spec: `plans/260821-1640-uiux-overhaul/phase-06-reskin-concepts.md` + `plan.md`. Read all four
prior reports (P1+P2, P5, P7, P3+P4) and the current `src/styles/main.css` (1967 ln) and
`src/index.html` (812 ln) before designing anything — the concepts are built against the source at
`d6dced3`, not the pre-overhaul file the plan describes.

**Zero changes under `src/` or `src-tauri/`** (`git status --porcelain -- src src-tauri` → empty).

## Deliverables — Windows paths, double-click to open

```
D:\WORKSPACES\PERSONAL\my-translator\plans\260821-1640-uiux-overhaul\concepts\baseline-current.html
D:\WORKSPACES\PERSONAL\my-translator\plans\260821-1640-uiux-overhaul\concepts\concept-a-quiet-glass.html
D:\WORKSPACES\PERSONAL\my-translator\plans\260821-1640-uiux-overhaul\concepts\concept-b-focus-dark.html
D:\WORKSPACES\PERSONAL\my-translator\plans\260821-1640-uiux-overhaul\concepts\concept-c-warm-slate.html
D:\WORKSPACES\PERSONAL\my-translator\plans\260821-1640-uiux-overhaul\concepts\README.md
```

Open in Edge — same Chromium family as WebView2. No build, no dev server, no Rust, no network.
~175-180 KB each, self-contained.

## What each concept argues

**Baseline** — no concept. Current `:root` + unmodified `main.css`, so the three have something
honest to be compared against, and so the fidelity check has a subject.

**A — Quiet Glass (lowest risk).** Evolution, not replacement. Same dark-glass identity; every text
tier lifted one step (.92/.55/.50 → .96/.72/.60), accent calmed `#638cff` → `#7a97e0`, six rendered
type sizes collapsed to four (11/12/14/16), spacing snapped to a 4px rhythm, seven control heights
unified to three. Thesis: the app does not need a new look, it needs its existing look to stop
being seven slightly different opinions.

**B — Focus Dark (readability first).** Panel to `rgba(11,12,16,0.985)` — near-opaque; minimal
chrome; cards become ruled rows instead of filled boxes; transcript type 16 → 19px; accent demoted
to a state-only colour (nothing is tinted just to look branded). Thesis: the transcript is the
product, everything else should get out of its way. Trades the glass identity away and is the only
concept that changes what the app *is*.

**C — Warm Slate (different feel, same structure).** Identical layout, identical spacing scale,
identical type scale. Warm neutrals `rgba(26,23,21,0.90)`, copper + amber accent pair, sage speaker
label, softer radii. Thesis: a direct test of whether the wanted change is *feel* rather than
*structure* — if C reads as "yes, that's it", the follow-on plan is a palette pass, not a layout one.

## What differs between them

| | A | B | C |
|---|---|---|---|
| Identity | preserved | traded away | preserved, re-tempered |
| Type scale | 6 sizes → 4 | every tier +1 | unchanged (weight/tracking instead) |
| Spacing | 4px rhythm | chrome tighter, gutters wider | unchanged |
| Cards | filled, tokenized | ruled rows, no fill | filled, warm, rounder |
| Accent | calmed, same role | state-only | copper/amber pair, same role |
| `--text-muted` clears AA from | 83% opacity | 76% | 93% |

## Cost to actually implement later

| | A | B | C |
|---|---|---|---|
| `:root` block | yes | yes | yes |
| Component rules beyond `:root` | **11 selectors** | **13 selectors** | **9 selectors** |
| Files touched | `main.css` only | `main.css`, **`src-tauri/src/settings.rs`** (transcript-size default 16 → 19 and an opacity default 85 → 95) | `main.css` only |
| Migration risk for ~1000 users | none | existing users keep their saved font size and opacity, so most never see the concept as designed unless defaults are force-migrated | none |
| Other | — | `.seg-card` look rewritten (colour-only per plan's non-goals, but a judgement call the user must make); the 30px blur becomes dead weight at 0.985 alpha and should be deleted | header wash `rgba(20,20,30,.4)` must be de-cooled in 2 rules or the top strip stays cold |

All three hit the **same four gaps** in the post-P3 token layer, which is the real cost signal:
literal control heights (26/24/22px in 5 selectors), em-relative card type (0.7em/0.85em in 5
selectors) plus `.btn-label`'s 8px, `.seg-card`'s literal 8px radius / 14px padding, and three card
text colours still written as raw `rgba()`. Whoever ships a concept closes those as a by-product.

## Where the concepts had to compromise for WebView2 / the platform

1. **No backdrop switcher.** Phase 06 §6a gates it on VQ1(b). Settled below — the window is opaque,
   so a three-way switcher would model a variable that does not exist in production. One fixed
   `#ffffff` backdrop, which is the measured real base.
2. **No new web font.** `src/index.html:10` pulls Inter from Google Fonts. Inter is **not** installed
   on this machine (checked `C:\Windows\Fonts` and the per-user font dir — Segoe and MesloLGS only),
   so an offline mock would have fallen back to Arial and invalidated every type judgement. Each
   page base64-embeds the Inter v20 variable font (latin + vietnamese subsets, `font-weight: 300
   700`, ~78 KB). No concept proposes a font that is not already shipped.
3. **`.toast` / `.modal-overlay` are `position: fixed`.** In production the window *is* the viewport,
   so the harness pins them to the 680×400 frame — reproducing production, not deviating from it.
4. **B's blur.** At 0.985 panel alpha `backdrop-filter: blur(30px)` is nearly invisible but still
   costs a compositor pass every frame in WebView2. B cuts it to 12px in the mock and the report
   recommends deleting it outright if B ships.

## VQ1(b) — the plan's last open question, now closed with evidence

`src-tauri/tauri.conf.json` → `"transparent": false`, `"decorations": false`, no `backgroundColor`
anywhere in `src-tauri/`; `main.css:111` → `html, body { background: transparent }`. So the base is
WebView2's own default. Measured from `plans/ui-screenshots/issue-2-toolbar.png`:

- The window's **rounded-corner wedges** — inside the window rect, outside `#overlay-view`'s 14px
  radius — read **220-250** (near-white) at both top corners; the desktop just outside the window
  reads **11-25**. Geometry checks out against a Win11 rounded window boundary plus the app's own
  14px radius.
- The panel body reads **rgb(75, 74, 79)**. Predicted for `rgba(15,15,20,0.88)` at 85%:
  over white → `0.748×15 + 0.252×255` = **rgb(75, 75, 79)**; over black → rgb(11, 11, 15).
  Matches white to within one unit per channel.

**The window is opaque and its base is white. The desktop never composites through.**

### Consequence the dispatch asked me to surface rather than improvise around

Phase 07 §7d says an opaque window means "the black-base column is the real one. That is the good
branch." **That is backwards.** The base is white, so **phase 07 §7b's white column is the real
one**. P7 is still correct as built and still delivers what the user asked for — text no longer
fades with the panel, which is visibly true — but it does **not** buy contrast independence from the
slider. Recorded in `plan.md`'s Validation Log; no code changed in response (P7 is closed, and the
remedy is a `src/` change Phase 6 may not make).

## Measured contrast — the number that should drive the decision

Double composite, post-P7 model, reproducible from the method in `concepts/README.md`. Lowest
opacity at which each design still clears WCAG AA against the **real** white base:

| Design | `--text-primary` AA from | `--text-muted` AA from |
|---|---:|---:|
| Baseline (shipped) | 68% | **98%** |
| A — Quiet Glass | 64% | 83% |
| B — Focus Dark | 57% | 76% |
| C — Warm Slate | 70% | 93% |

Below ~55% opacity **every** design collapses (best case 1.56:1 at 20%). Physics: fading a dark
panel toward white destroys white text's contrast regardless of the text's own alpha.

**The cliff exists only because the base is white.** Give the webview an opaque dark base — one
`backgroundColor` in `tauri.conf.json`, or an opaque `background` on `html, body` — and **every text
tier of every design, including today's baseline, clears AA at every slider position from 20% to
100%**. It also removes the near-white wedges in the window's rounded corners. This is a `src/`
change, therefore **out of scope for this phase: not implemented, not attempted.** It is worth more
than any of the three concepts, is independent of which one is picked, and belongs in the follow-on
plan.

## Recommendation

**A — Quiet Glass**, plus the dark-base fix as a separate one-line change. Reasoning in
`concepts/README.md`; short version: A matches the plan's own systemize scope tier, costs `:root`
plus 11 selectors with no JS/Rust/layout change, closes the four token-layer gaps as a by-product,
and once the dark base lands A is already AA at 20% opacity — which is B's entire advantage, without
B's costs. Pick B only if the glass identity is judged not worth keeping. Pick C if the complaint is
"it feels cold" rather than "it's hard to read".

## Verification

**Done by a worker:**

| Check | Result |
|---|---|
| External `src=`/`href=` in any concept file | **0** (all four) |
| Duplicate element IDs | **0** (all four) |
| `src/index.html` IDs present in each page | **120 / 120** |
| `src/index.html` class names present in each page | **91 / 91** |
| `main.css` post-`:root` tail byte-identical in each page | **yes**, 1866 lines |
| jsdom parse + harness script execution, driving every control | **4/4 pass, 0 errors** — 3 views, 5 card variants, 3 session rows, 3 Q&A rows, summary block, toast, recovery dialog, Settings tab switch, slider writing `--overlay-opacity: 0.2` |
| `git status --porcelain -- src src-tauri` | **empty** |
| `npm test` via `powershell.exe` from `/mnt/d` | **17 files, 108 passed** (unchanged from `d6dced3`; nothing under `src/` or `tests/` touched) |
| `cargo test` | not run — `src-tauri/` untouched this phase |
| Windows release build | **not run**, per dispatch |

Two `http` strings survive in every page and neither is a network reference: an `xmlns` inside the
`select` arrow's `data:` URI (`main.css:1243`) and the AI-endpoint input's placeholder
(`index.html:642`). Both inherited verbatim from shipped source.

**Not done, cannot be done here:** phase 06 step 2's side-by-side screenshot pair of the real app
and `baseline-current.html`. No Windows GUI in this environment and the release build is skipped by
instruction. Fidelity is instead demonstrated mechanically (table above). Exact capture
instructions are in `concepts/README.md`. **I did not open any concept in a browser and make no
claim about how they look.**

## What the user has to do

1. Open all four files. Start with `baseline-current.html` beside the running app to close the
   fidelity gate.
2. On each concept: drag the opacity slider 100 → 85 → 60 → 20 and note where it stops being
   readable. The live contrast table updates as you drag.
3. Check the toolbar, a transcript card with speaker + translation, the session viewer with a
   summary, and the Settings panel. Hover and <kbd>Tab</kbd> a few controls.
4. Pick one, or say "none". The reason matters more than the pick — it scopes the follow-on plan.
   The Validation Log slot in `plan.md` (decision 12) is open and waiting.

## Commit

One commit on the existing branch. It adds the whole
`plans/260821-1640-uiux-overhaul/` directory, which was untracked: committing only `plan.md` and
`phase-06-*.md` (the phase's declared file list) would have left every relative link in `plan.md`
pointing at an untracked file. Nothing outside `plans/` is in the commit.

## Unresolved questions

1. **The pick itself.** Which concept, or none, and why. That is the phase's entire deliverable and
   it is a human decision by construction.
2. **The fidelity screenshot pair** is still owed and is a user step. Until it is done, the concepts
   rest on mechanical fidelity (verbatim CSS, line-sliced markup, ID/class parity) rather than
   demonstrated visual fidelity. If the pair disagrees, the mock is wrong and the concepts built on
   it are not yet trustworthy.
3. **The dark-base fix.** Worth more than the reskin, one line, out of this phase's scope. Should it
   go into the follow-on plan, or be pulled forward as a standalone fix before the final build?
4. **If B is chosen**, its transcript-size and opacity defaults live in `src-tauri/src/settings.rs`,
   not CSS. Existing users keep their saved values, so a decision is needed: force-migrate, or let
   B ship looking like today's app for everyone who already ran v0.6.0.
5. **Phase 07 §7d's stale claim.** Corrected in `plan.md`'s Validation Log but the wording in
   `phase-07-overlay-opacity-restructure.md` §7d still reads as written. Left alone — Phase 6 was
   scoped not to rewrite another phase's file. Fix it if you want the phase files self-consistent.

Status: DONE_WITH_CONCERNS
Summary: Three reskin concepts plus a baseline shipped as self-contained offline HTML in `plans/260821-1640-uiux-overhaul/concepts/`, each with the real markup, a verbatim `main.css` copy, the post-P7 opacity slider and a live contrast readout; VQ1(b) closed by measurement (opaque window, white base) and 108/108 vitest green with zero `src/` changes.
Concerns/Blockers: The deliverable — the user's pick — is still open. Phase 06 step 2's screenshot fidelity pair cannot be produced in this environment and is owed by the user. Measurement also shows phase 07 §7d's expectation was inverted: the base is white, so P7 did not buy the AA-independence the dark-base column promised, and the real remedy is a one-line dark webview base that is out of Phase 6's scope.
