---
phase: 1
title: "Session Viewer Single Scroll Region"
status: in-progress
priority: P1
effort: "0.5d (code landed; human smoke outstanding)"
dependencies: []
---

# Phase 1: Session Viewer Single Scroll Region

## Overview

Fix reported defect #1: in the Sessions view, a long AI summary pushes the Q&A block past the
viewer's clipped bottom edge and leaves an unstyled default scrollbar floating mid-panel. Replace
the competing fixed-height children with **one** scroll region holding summary (top) + transcript
(below), header and Q&A pinned outside it.

**Code for this phase already landed** in commit `969f94e` on branch
`feat/uiux-p1-p2-session-scroll-toolbar` (builder report:
`plans/reports/builder-260821-1617-uiux-p1-p2.md`). This file documents the agreed approach and
carries the outstanding human smoke gate. **Do not redesign it.** If smoke fails, reopen this phase
with the specific failing step.

## Requirements

- Functional: with any combination of long summary + long transcript + long Q&A history, every part
  is reachable; the viewer header and the Q&A input are always visible; back-to-list and
  summary show/hide still work.
- Functional: AI Summary renders **above** the transcript inside the scroll region (user decision 2).
- Non-functional: exactly one main scrollbar in the viewer plus one bounded Q&A scrollbar, both
  using the app's styled scrollbar, not the WebView2 default.
- Constraint: no element ID renamed or removed — `session-manager.js` toggles by ID.
- Constraint: **no `position: sticky`.** `#session-viewer`'s ancestors carry `backdrop-filter`,
  which creates a containing block for `sticky`/`fixed` descendants in Chromium/WebView2 (confirmed
  spec behaviour, see `plans/reports/researcher-260821-1642-webview2-tauri-constraints.md`).
  Pin by keeping the header and Q&A section **outside** the scroller instead.

## Architecture

Root cause: `#session-viewer` is `display:flex; flex-direction:column; overflow:hidden`.
`.session-summary-section` was `flex-shrink:0` with no `max-height` and no `overflow`, so its
intrinsic height grew without bound. The sum of the fixed-height children then exceeded the
container, `.session-content-scroll` (the *intended* scroller, `flex:1`) collapsed toward 0 —
flexbox resolves `min-height:auto` to 0 once `overflow` is not `visible` — and the Q&A section was
pushed past the bottom edge and clipped. The wide white scrollbar visible in
`plans/ui-screenshots/issue-1-sessions-popup-no-scrollbar.png` is `.qa-messages`, the only scroller
in the file with no `::-webkit-scrollbar` rules, so WebView2 painted its default.

Structure as landed:

```
#session-viewer                       flex column, overflow:hidden
├─ .session-viewer-header             flex-shrink:0   (outside the scroller — this is the "pin")
├─ .session-scroll-region   [NEW]     flex:1; min-height:0; overflow-y:auto; styled scrollbar
│   ├─ #session-summary-section       plain block, border flipped top→bottom (it is now first)
│   └─ #session-viewer-content        .session-content-scroll demoted to a plain block
└─ .session-qa-section                flex-shrink:0   (outside the scroller — pinned bottom)
    └─ .qa-messages                   max-height + overflow-y:auto + styled scrollbar [NEW rules]
```

`min-height: 0` on the scroll region is the standard flexbox `min-size:auto` fix, not a
WebView2 workaround — cross-engine spec behaviour.

Rejected alternative: bounding `.session-summary-section` itself with
`flex-shrink:1; min-height:0; overflow-y:auto`. It stops the clipping but produces three nested
scrollbars in one panel — worse UX for the same defect.

## Related Code Files

- Modify: `src/index.html` — new `.session-scroll-region` wrapper around `#session-summary-section`
  + `#session-viewer-content`; summary moved before transcript in DOM order. IDs unchanged.
- Modify: `src/styles/main.css` (SESSIONS VIEW section, from ~line 1513) —
  `.session-scroll-region` added with its `::-webkit-scrollbar` set; `.session-content-scroll`
  demoted to a plain block; `.session-summary-section` border flipped; `.qa-messages`
  `::-webkit-scrollbar` rules added.
- Untouched: `src/js/session-manager.js`, `src/js/ai-summary.js`, `src/js/session-qa.js`.

## Implementation Steps

*(Steps 1-5 are complete in `969f94e`. Listed for the record and for reopen-on-smoke-failure.)*

1. Wrap `#session-summary-section` + `#session-viewer-content` in `div.session-scroll-region`,
   summary first.
2. Give `.session-scroll-region` `flex:1; min-height:0; overflow-y:auto` plus the app's three-rule
   `::-webkit-scrollbar` pattern.
3. Strip `flex:1` / `overflow` from `.session-content-scroll`; leave it as a plain block.
4. Flip `.session-summary-section`'s divider from `border-top` to `border-bottom` (it is now the
   first child).
5. Add the same three-rule scrollbar pattern to `.qa-messages`.
6. **Outstanding:** run the smoke gate below with the user and record the result in this file.

## Verification a Worker Can Do

- ID parity: `grep -o "getElementById('[^']*')" src/js/*.js | sed "s/.*('\(.*\)')/\1/" | sort -u`
  against `grep -o 'id="[^"]*"' src/index.html | sed 's/id="\(.*\)"/\1/' | sort -u`; every ID the JS
  reads must still exist. Paste the diff in the report.
- `powershell.exe -NoProfile -Command "npm test"` from a `/mnt/d` path, output piped through
  `tr -d '\r'`. Report actual pass/fail counts.
- `powershell.exe -NoProfile -Command "npm run tauri build"` and confirm
  `src-tauri/target/release/my-translator.exe` exists on disk with a fresh mtime. **Exit code is
  not proof — stat the file.**

Result at `969f94e`: 91/91 vitest, 7/7 `cargo test --lib settings`, exe 11,394,048 bytes.

## Verification a Worker Cannot Do

All visual and scroll behaviour. No visual regression suite exists and none is being built.

## Smoke-Test Gate (HUMAN — blocking)

Run `docs/smoke-test-checklist.md` sections **Session persistence**, **AI summary persistence**, and
**Transcript Q&A** first, then these phase-specific steps:

1. Open a saved session with a **long** transcript. Click **Summary** / **Regenerate**.
2. The AI Summary card appears **above** the transcript text.
3. Summary and transcript scroll together under **one** scrollbar. There is no second scrollbar
   inside the summary card.
4. The viewer header (back, Copy, Export, Summary) stays visible while scrolling.
5. The "Ask about this session" box and its input stay pinned at the bottom and are never pushed
   off-screen, however long the summary is.
6. Ask enough questions that the answer list needs to scroll — the Q&A scrollbar is thin and styled
   like the rest of the app, not the wide default one from the screenshot.
7. Click back-to-list, reopen a different session — summary section resets correctly (no stale
   summary from the previous session).
8. Repeat 1-6 with the window resized small.

Phase closes only on user confirmation of all eight steps.

## Success Criteria

- [ ] Steps 1-8 of the smoke gate confirmed by the user
- [x] Exactly one `overflow-y: auto` scroller inside `#session-viewer` besides `.qa-messages`
- [x] No `position: sticky` anywhere in `src/styles/main.css`
- [x] Every pre-existing element ID still present
- [x] Vitest and `cargo test` green; Windows exe artifact verified on disk

## Risk Assessment

- **Display-toggle flows in `session-manager.js`** — it shows/hides `#session-summary-section` by
  `style.display`. DOM reordering does not affect that, but the reset path on back-to-list is the
  place a regression would hide. Covered by smoke step 7.
- **Summary card in a scroller with a `backdrop-filter` ancestor** — if any future change adds
  `position: sticky` inside `.session-scroll-region` it will silently break. Standing rule, stated
  in Requirements.
- **Rollback**: `git revert 969f94e` reverts P1 and P2 together — they shipped in one commit. If
  only P1 needs reverting, revert the `.session-scroll-region` hunks in `src/index.html` and the
  SESSIONS VIEW hunks in `src/styles/main.css` by hand; no JS change belongs to P1.
