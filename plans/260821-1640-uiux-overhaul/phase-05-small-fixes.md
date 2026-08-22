---
phase: 5
title: "Small Fixes and Narrow-Width Hardening"
status: pending
priority: P1
effort: "3-5h"
dependencies: [2]
---

# Phase 5: Small Fixes and Narrow-Width Hardening

## Overview

Clear the small-fix backlog. Two of these items are **live defects in the shipped v0.6.0 build**,
not latent debt, which is why this phase runs immediately after the P1+P2 smoke gate and **ahead of
P3 and P4** (see plan.md → Execution order):

- the About tab renders a hardcoded `v0.5.2` in a `0.6.0` app;
- the control bar's minimum content width exceeds both the window's default and minimum widths, so
  the window-zone controls are clipped away.

The rest — dead Electron CSS, the confusing double back button, the still-broken session-viewer
format select, inline layout styles — are cheap and belong together.

## Requirements

- Functional: the About tab shows the version the app is actually running, with no hardcoded string
  anywhere.
- Functional: at every window width the app permits **after this phase**, `#btn-compact`,
  `#btn-pin`, `#btn-minimize` and `#btn-close` are fully visible and clickable. The floor is stated
  explicitly so the human can fail the test deterministically: whichever 5b option is chosen, drag
  the window to its minimum and all four must be whole.
- Functional: at the default launch width the status readout (dot + label + elapsed time) is legible
  and does not overlap the transcript-zone icons.
- Functional: the session-viewer's export-format select is legible and correctly sized.
- Functional: in the session-viewer state, the two back buttons are visually and semantically
  distinguishable.
- Non-functional: zero `-webkit-app-region` declarations remain; static layout margins live in CSS
  classes, not inline `style` attributes.
- Constraint: JS-managed `style="display:…"` attributes (10 of them in `src/index.html`) are
  **left alone** — they are runtime state, not styling.
- Constraint: no element ID renamed or removed.

## Architecture

### 5a. Dynamic version string

`src/index.html:664` hardcodes `<span class="about-app-version" id="about-version">v0.5.2</span>`.
No JS ever writes `#about-version` (`grep -rn 'about-version' src/js/` → empty). The app is 0.6.0.

**Do not** use `@tauri-apps/api` — it is not a dependency. `package.json` devDependencies are
`@tauri-apps/cli`, `jsdom`, `vitest` only, and every Tauri call in the app goes through
`window.__TAURI__` (`withGlobalTauri: true`).

Primary: `window.__TAURI__.app.getVersion()`. `src-tauri/capabilities/default.json` already grants
`core:default`, which transitively includes `core:app:default` → `allow-version`, so **no capability
change is needed** (verified: `plans/reports/researcher-260821-1642-webview2-tauri-constraints.md`).

Fallback if it resolves `undefined` at runtime: add a Rust command returning
`env!("CARGO_PKG_VERSION")`, register it in `generate_handler!` (`src-tauri/src/lib.rs:24-39`), and
call it through `window.__TAURI__.core.invoke` like every other command. Decide by testing the
primary in a real build first — do not add the Rust command speculatively.

Wire it in `app.js`'s existing startup path, guarded, writing `v${version}`. Leave the HTML text
node empty or as a `—` placeholder so a failure is visible rather than showing a stale number.

### 5b. Toolbar minimum width — the bar has a hard floor the window does not respect

`#overlay-view { overflow: hidden }` (`main.css:93`). `.control-bar` cannot wrap. Every
`.toolbar-zone` is `flex-shrink: 0`. So once the bar's content exceeds the window width the overflow
goes right and the **last** children — the window zone — are clipped. P2's report reasoned that being
last keeps them out of the shrink path; that is true for shrinking and exactly backwards for
overflow.

Minimum content width, re-derived at `969f94e` (this table was corrected twice — see the two notes
under it; do not reuse an earlier version of it):

| Part | Derivation | px |
|---|---|---|
| `.control-bar` padding | `0 8px` | 16 |
| gaps between 9 direct children | `gap: 6px` × 8 | 48 |
| `#btn-settings` | `.icon-btn` `min-width: 32px` (binds: `box-sizing:border-box` globally, content 18px SVG + 8px padding = 26 < 32) | 32 |
| 4 × `.toolbar-divider` | `width: 1px` | 4 |
| zone: transport | `.source-controls` (2px padding ×2 + 2px gap ×2 + 3 × `min-width:30`) = 98; + 6 + `.action-btn` `width:34` + 6 + `.tts-action-btn` (10px padding ×2 + **1px border ×2** + 13px icon + 4px gap + ~22px "TTS") = 61 | 205 |
| zone: status | **`margin-left: 4px` only** — see note (a) | 4 |
| zone: transcript | `.toolbar-group` (3 × 32 + 2 × 2px gap) = 100; + 8px zone gap + `#btn-clear` 32 | 140 |
| zone: window | 4 × 32 + 3 × 6px gap | 146 |
| **Total content** | | **595** |

`#overlay-view` has a 1px border each side (inside its `100%` box), so the bar's available width is
`window width − 2`. **The bar needs a window ≥ 597 CSS px.**

**(a) Why the status zone contributes 4px, not its content width.** `.status-area` is
`flex: 1` (= `1 1 0%`) **plus** an explicit `min-width: 0` (`main.css:291-299`). Its flex base is 0
and its automatic minimum size is overridden, so under a deficit it resolves to width 0 and its
children overflow instead of pushing. Only its `margin-left` is an unavoidable cost. An earlier
version of this table used the zone's 23px *content* width, which is not what a flex minimum is.

**(b) What actually happens at the default `width: 600`.** Available content = 598, minimum = 595,
so the bar **fits** — with 3px left over for the status zone. `.status-area` therefore renders 3px
wide while its children need 19px (7px dot + 2 × 6px gap, with `#status-elapsed` `flex-shrink: 0`).
So at the shipped default width **the status readout P2 just added is not usable**: the label is
ellipsed to nothing and the dot plus the elapsed timer paint outside their 0-width parent, on top of
the divider and the transcript icons (`.status-area` has no `overflow`). That is the real
default-width defect — a legibility and overlap defect, not a clipping one.

**(c) Clipping is real, but only below ~597px.** `tauri.conf.json` sets `minWidth: 400` (logical/CSS
pixels, DPI-independent — verified), so the whole 400-596 band clips the window zone: at 400 the
deficit is ~197px, which removes close, minimize and pin outright. A user only has to drag the
window narrower to lose the close button.

**(d) The screenshot is not evidence for this.** `plans/ui-screenshots/issue-2-toolbar.png` shows the
**pre-P2** bar — it still contains the blue export-format pill and the folder button that P2 removed.
It documents the original defect; it cannot be cited for a post-`969f94e` derivation. Earlier drafts
of this plan did cite it. They were wrong.

**Decision (user, final).** The bar has a hard floor of ≈597px and the app permitted 400px. The
window minimum goes up:

- `src-tauri/tauri.conf.json` → `minWidth` **400 → 600**, `width` **600 → 680**.

Clipping becomes structurally impossible, and the status readout gets ~83px — enough for
"Listening" + "12:34". No responsive CSS, no breakpoints, no shrink gymnastics. The user confirmed he
never runs the window narrower than ~600px, so the narrow-overlay use case this costs is not one he
has. The media-query alternative considered earlier is **dropped, not deferred** — do not
reintroduce it.

**Not doing, in either case: `overflow: hidden` on the toolbar zones.** An earlier draft prescribed
`.toolbar-zone-transcript/-transport { min-width: 0; overflow: hidden }`. The zones have zero
padding, so the clip box is exactly their children's bounding box — that would clip P4's
`outline: 2px` at `outline-offset: 2px` on all four sides for 9 of the 14 toolbar buttons, and would
clip `.action-btn:hover`'s `box-shadow: 0 0 12px var(--accent-glow)` (`main.css:427-430`) at **every**
width, for every user, the moment this phase shipped. Dropped.

**Also add `overflow: hidden` to `.status-area`** (`main.css:291`).
It is the only fix for the (b) overlap, and it is safe — the zone holds no focusable control and no
glow (`pointer-events: none`), so there is nothing for a clip box to damage.

Widening the default is safe and one-time: `window-manager.js:46` writes `localStorage.window_state`
but **nothing ever reads it**, and `tauri.conf.json` has `"plugins": {}` — no window-state plugin —
so the app always launches at the configured size. No user's saved geometry is disturbed because
none is restored.

**Prerequisite (retained by user decision):** phase-02 smoke step 11 — the empirical narrow-width
measurement — must be run and reported **before** this item is built. The 600 figure is chosen to sit
just above the derived 597, and that derivation has already been wrong twice. If the measured floor
disagrees, the measurement wins: raise `minWidth` to clear it and say so in the report.

### 5c. Delete the `-webkit-app-region` cruft

Seven declarations at `969f94e`: `main.css` 126, 206, 378, 424, 824, 1592, 1693. This is an
Electron-era mechanism; in Tauri 2 dragging is governed **solely** by `data-tauri-drag-region` on
the element that receives the mousedown, and the attribute is not inherited (verified). The CSS
property does nothing here and misleads the next reader into thinking drag is CSS-controlled.

Delete all seven. **Then re-run phase-02's smoke step 8** (drag from gaps, dividers and the status area;
clicking a control must not drag) — the deletion is provably inert, but drag is the one behaviour a
worker cannot test, so it gets re-verified.

### 5d. Session-viewer export-format select

`#select-session-export-format` still carries `.export-format-select` (`main.css:1793-1801`). The
diagnosis P2 recorded for the toolbar twin — "the .md text sat under the arrow" — is **wrong**, and
this phase must not inherit it:

```css
.export-format-select {
  background: var(--bg-hover);   /* SHORTHAND — resets background-image to none */
  font-size: 11px;
  padding: 2px 4px;
}
```

`background` is a shorthand, so it erases the `background-image` arrow the global `select` rule
declares (`main.css:1145`), and `.export-format-select` `(0,1,0)` beats `select` `(0,0,1)` regardless
of source order. **There is no arrow on this element at all** — which matches
`plans/ui-screenshots/issue-1-sessions-popup-no-scrollbar.png`, where the box beside "Copy" is wide
and empty with no arrow visible. The actual defect is the inherited `width: 100%` (`main.css:1133`)
stretching it across the flex header. (P2's *fix* for the toolbar twin — dropping the class — was
correct, because dropping the class also restored the arrow. Only its stated cause was wrong.)

Fix, CSS only, ID unchanged — restore the arrow and constrain the width:

```css
.export-format-select {
  background-color: var(--bg-hover);   /* not the shorthand — keeps the inherited arrow */
  width: auto;
  min-width: 64px;                     /* fits ".txt" + arrow clearance */
  padding: 2px 24px 2px 6px;           /* 24px right clears the arrow at `right 10px` */
}
```

**Decision (user, final): restore the arrow and constrain the width** — the CSS above, exactly as
written. The arrowless alternative is dropped. Do not move the control; the counsel's "viewer has
room" judgement stands.

### 5e. The two back buttons

They look identical and stack in the viewer state, but they are **not** duplicates:
`#btn-sessions-back` exits Sessions to the overlay (`session-manager.js:43`);
`#btn-session-back-to-list` returns the viewer to the session list (`session-manager.js:50`).

Do **not** hide the outer one. Escape also exits to the overlay (`app.js:225`), but hiding the only
visible exit behind a keyboard shortcut breaks the standing rule against hover-only/hidden
affordances for an app used mid-meeting.

**Decision (user, final): fix it.** Keep both buttons, differentiate them. `#btn-sessions-back`
becomes a close glyph (×) with `title="Close Sessions"`; `#btn-session-back-to-list` keeps the ←
arrow with `title="Back to list"`. Icon and title change only — ID, handler and DOM position
unchanged.

### 5f. Inline layout styles → classes

Exactly **10** static-layout `style` attributes in `src/index.html`, verified:
`margin-top: 8px` ×5, `margin-top: 12px` ×1, `margin-bottom: 10px` ×1, `margin-bottom: 8px` ×1,
`margin:0` ×2. Replace with small utility classes, or fold the margin into the existing component
class where the element is the only user.

**Not touched:** the ten `style="display:…"` attributes (JS runtime state) and the three
`.color-dot` `style="background:#…"` attributes (the swatch *is* the value).

Use literals here. P3 runs **after** P5, so its `--space-*` scale does not exist yet; P3's step 4
must re-derive its literal set from the P5 tip rather than from `969f94e`, because these new utility
classes add spacing literals the `969f94e` inventory does not know about.

### 5g. Delete the dead `window_state` write (user decision, final)

`WindowManager.saveWindowPosition()` (`window-manager.js:40-55`) serialises window position and size
into `localStorage.window_state` on every close and every minimize. **Nothing ever reads it**
(`grep -rn 'window_state' src/js/` returns the write only) and `tauri.conf.json` has
`"plugins": {}` — no window-state plugin. It is dead code that runs three `await`ed IPC round-trips
(`scaleFactor`, `outerPosition`, `innerSize`) on every close for no effect.

Delete the method and all three call sites:

| Site | Context |
|---|---|
| `window-manager.js:19` | inside the `#btn-close` handler, before `stopSession()` and `close()` |
| `window-manager.js:25` | inside the `#btn-minimize` handler, before `minimize()` |
| `app.js:210` | the `Cmd/Ctrl+M` shortcut, before `appWindow.minimize()` |

**Do not wire up restore.** The user explicitly declined that feature. This is a deletion only.

Removing the `await` from the close path is safe — the save was the only thing it did, and
`stopSession()` (the call that actually matters for data safety) is a separate `await` that stays.

## Related Code Files

- Modify: `src/index.html` — `#about-version` placeholder; `#btn-sessions-back` icon + title;
  inline styles → classes.
- Modify: `src/styles/main.css` — zone shrink priority (5b.1); delete 7 `-webkit-app-region` lines;
  `.export-format-select` sizing; new margin utility classes.
- Modify: `src/js/app.js` — set `#about-version` at startup.
- Modify: `src-tauri/tauri.conf.json` — `app.windows[0].minWidth` `400 → 600` and
  `app.windows[0].width` `600 → 680` (user decision, final).
- Conditional: `src-tauri/src/lib.rs` + a command module — only if `getVersion()` fails in a real
  build.
- Modify: `src/js/window-manager.js` — delete the dead `saveWindowPosition()` write (5g below).

Line numbers are `969f94e`-relative. Re-grep before editing.

## Implementation Steps

1. Branch from the P2 tip **after** the P1+P2 smoke gate passes.
2. **5a** — wire `#about-version` from `window.__TAURI__.app.getVersion()`, guarded. Build and check
   in the real app. Only if it resolves `undefined`, add the Rust fallback command and re-test.
3. **5b** — **prerequisite: phase-02 smoke step 11's measured narrow-width floor must be in hand.**
   Compare it against the 597 derived above; if they disagree, the measurement wins and `minWidth`
   goes above the measured floor instead. Then set `minWidth: 600` and `width: 680` in
   `tauri.conf.json`, and add `overflow: hidden` to `.status-area`. Do **not** add `overflow: hidden`
   to any `.toolbar-zone`, and do **not** add media queries.
4. **5c** — delete all seven `-webkit-app-region` declarations. `grep -c 'app-region' src/styles/main.css`
   → `0`.
5. **5d** — fix `.export-format-select` sizing.
6. **5e** — swap `#btn-sessions-back`'s icon and title.
7. **5f** — inline static styles → classes; leave `display:` and `.color-dot` backgrounds alone.
   **5g** — delete `saveWindowPosition()` and its three call sites (`window-manager.js:19`, `:25`,
   `app.js:210`). Verify `grep -rn 'window_state\|saveWindowPosition' src/` → empty.
8. **5h** — add the missing `export_format` round-trip test. P2 shipped `export_format` through
   `settings.js` → `settings-form-controller.js` (`populateForm` 216, `saveFromForm` 299) →
   `src-tauri/src/settings.rs` with **no JS test**. The existing
   `tests/js/settings-form-controller.test.js` uses a minimal DOM fixture that omits
   `#select-export-format`, and `populateForm` guards it with `if (exportFormatSelect)`, so the gap
   is invisible today. Add the id to the fixture and assert the value round-trips and defaults to
   `'md'` when absent. Cheap, worker-verifiable, closes a real hole.
9. **5i** — add `tests/js/html-id-bindings.test.js`: load `src/index.html` with jsdom and assert
   that every `getElementById('…')` literal appearing in `src/js/**` resolves to an element, minus a
   named `KNOWN_DEAD` array holding the six pre-existing JS-only IDs (`check-tts-enabled`,
   `hint-mode-local`, `link-elevenlabs`, `range-tts-speed`, `tts-settings-detail`,
   `tts-speed-value` — all in `settings-form-controller.js`, all `?.`- or `if (el)`-guarded).
   **No test reads `src/index.html` today** (`grep -rn 'index.html' tests/` → empty) while
   `src/js/**` holds **109 distinct** `getElementById` IDs against 120 in the HTML, so `npm test`
   is green no matter what an HTML edit breaks. This is the highest-value test this plan can add and
   it is what makes P4's HTML edits verifiable at all. Build it here, before P4 needs it.
10. ID-parity grep; paste the output in the report.
11. `powershell.exe -NoProfile -Command "npm test"` from `/mnt/d`; `npm run tauri build`; stat the exe.
12. Update `docs/smoke-test-checklist.md`: add the P2 toolbar/Settings items from the builder report
    (they are user-visible and not yet in the checklist) plus this phase's version and narrow-width
    checks. This is the one evergreen doc that must track these changes.
13. Hand back for the smoke gate.

## Verification a Worker Can Do

- `grep -n 'v0\.[0-9]' src/index.html` → empty
- `grep -c 'app-region' src/styles/main.css` → `0`
- `grep -c 'style="margin' src/index.html` → `0`; `grep -c 'style="display' src/index.html` → still `10`
- `grep -rn 'window_state\|saveWindowPosition' src/ | wc -l` → `0`
- `python3 -c "import json;print(json.load(open('src-tauri/tauri.conf.json'))['app']['windows'][0])"`
  shows the width settings the chosen 5b option calls for
- `grep -n 'overflow' src/styles/main.css | grep toolbar-zone` → empty
- `grep -n 'overflow' src/styles/main.css | grep status-area` → one hit
- ID-parity grep clean; full vitest green with no test weakened or deleted; `cargo test` green
- Windows build artifact on disk with a fresh mtime

## Verification a Worker Cannot Do

Whether the version string actually renders, whether the bar actually stops clipping, and whether
drag still works after the `-webkit-app-region` deletion.

## Smoke-Test Gate (HUMAN — blocking)

**Before starting, capture "before" screenshots** of the Settings panel (every tab) and the overlay
at the default window size and default opacity. Steps 9 and 10 are unfalsifiable from memory.

1. Settings ▸ About — the version reads `v0.6.0`. Not `v0.5.2`, not blank, not `undefined`. If you
   have the repo, it should equal `package.json`'s `version`; if you are testing a distributed
   build, just confirm it matches the release you installed.
2. Fresh launch — the window opens wide enough that the **whole** toolbar is visible, close button
   included, and the status area shows the dot **and** the "Ready" label without either touching the
   icons to its right.
3. Click Start. The status label and the elapsed timer both render fully, with clear space between
   them and the copy/export/sessions icons. Nothing overlaps.
4. **While still recording**, drag the window as narrow as it will go. The elapsed timer truncates or
   disappears — it must **never** paint on top of the icons to its right. Stop recording.
5. At the narrowest width the window now allows (600), compact, pin, minimize and close are **fully
   visible and clickable**, and nothing in the bar is half-drawn. Confirm the window refuses to go
   narrower than that.
6. Widen back — everything returns in the same order, nothing overlaps or is left half-drawn.
7. **At the default width, hover the Start button** — the blue glow around it looks exactly as it did
   before this phase. (This catches an accidental clip box around the transport zone.)
8. **Drag re-test after the `-webkit-app-region` deletion:** drag by an empty toolbar gap, by each
   divider, and by the status area. All drag. Click each icon button — it activates and does not
   drag.
9. Sessions ▸ open a session — the export-format dropdown beside Copy is compact, shows ".md"/".txt"
   legibly, and (if the arrow option was chosen) has a visible arrow that does not cover the text.
10. In that viewer, the top-left button is a **×** (closes Sessions, back to the overlay) and the one
    below it is a **←** (back to the session list). Click each and confirm it does what its icon says.
11. Settings — compare against your "before" screenshots. Every panel's spacing is identical.
12. Compact mode still hides and hover-reveals the bar.
13. **After the `window_state` deletion:** close the app with the x button and relaunch — it still
    saves the session on close and starts cleanly. Minimize with the button and with Ctrl+M — both
    still minimize. (The deleted code ran on exactly these three paths.)

Phase closes on user confirmation of steps 1-13.

## Success Criteria

- [ ] Smoke steps 1-13 confirmed by the user
- [ ] About shows the running version; `grep -n 'v0\.[0-9]' src/index.html` → empty
- [ ] Window-zone controls fully visible and clickable at the app's minimum allowed width, with that
      width stated as a number in the report
- [ ] Status dot, label and elapsed time legible and non-overlapping at the default launch width
- [ ] `.status-area` has `overflow: hidden`; **no** `overflow` was added to any `.toolbar-zone`
- [ ] Start-button hover glow unchanged at the default width
- [ ] Zero `-webkit-app-region` declarations; drag re-verified by a human
- [ ] Session-viewer format select legible and correctly sized; exactly one of the arrow / no-arrow
      treatments shipped
- [ ] Two back buttons visually distinguishable, both behaving as their icons say
- [ ] No static-layout inline `style` attributes; the 10 `display:` and 3 `.color-dot` ones intact
- [ ] `saveWindowPosition()` and all three call sites gone; no window-state restore added
- [ ] `tests/js/html-id-bindings.test.js` exists and passes — it must **fail** if an id is removed
      from `src/index.html` (prove this once by deleting an id locally, watching it fail, restoring)
- [ ] Full vitest green with no test weakened or deleted; `cargo test` green
- [ ] Windows exe artifact verified on disk
- [ ] `docs/smoke-test-checklist.md` updated with the P2 and P5 user-visible changes

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `window.__TAURI__.app.getVersion()` returns `undefined` at runtime despite the permission analysis | Guarded call plus a visible `—` placeholder; Rust `env!("CARGO_PKG_VERSION")` command is the specified fallback. Step 2 tests in a real build before moving on |
| Version now comes from `Cargo.toml`, which can drift from `package.json` at release time | The release process already bumps `package.json`, `tauri.conf.json` and `Cargo.toml` together (`plans/reports/release-v0.6.0.md` step 3). Smoke step 1 compares against `package.json` |
| Raising `minWidth` takes the narrow-overlay use case away | Real cost, accepted: the user confirmed he never runs the window narrower than ~600px (VQ2). Widening the *default* is separately safe — `window_state` is written but never read and `"plugins": {}` means no window-state plugin, so no saved geometry exists to disturb |
| An earlier draft's `overflow: hidden` on the toolbar zones would have clipped P4's focus rings on 9 of 14 buttons and the Start-button glow at every width | Removed from the plan; "no `overflow` on any `.toolbar-zone`" is a success criterion, and smoke step 7 checks the glow |
| `overflow: hidden` on `.status-area` clips the status dot at the tightest widths | Accepted — a clipped dot is strictly better than an elapsed timer painting over the transcript icons, and with the recommended `minWidth: 600` the zone has ~83px and never gets near that |
| The 597px derivation is wrong again | It has been wrong twice already (23px status zone, missing TTS border). Phase-02 smoke step 11's *measured* floor is a hard prerequisite and overrides the arithmetic |
| Restoring the arrow on `.export-format-select` by switching `background:` → `background-color:` changes how that control looks | Intended — it currently has no dropdown affordance at all. Exactly one treatment ships; smoke step 9 checks it |
| Inline-margin removal changes spacing somewhere subtle in Settings | Smoke step 11 against the "before" screenshots captured at the top of the gate; the change is class-for-inline with identical values |

**Rollback**: every item is independent. `tauri.conf.json` reverts in one line; each CSS change is a
separate hunk; 5a reverts to the placeholder; `tests/js/html-id-bindings.test.js` is additive and can
be deleted on its own. No schema change, no persisted state, no IDs changed.
