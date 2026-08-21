---
phase: 2
title: "Toolbar Regroup and Demotions"
status: in-progress
priority: P1
effort: "1d (code landed; human smoke outstanding)"
dependencies: []
---

# Phase 2: Toolbar Regroup and Demotions

## Overview

Fix reported defect #2: 16 undifferentiated controls in one 42px row, including an unlabelled blue
pill that is actually the export-format `<select>` with its text hidden behind its own dropdown
arrow. Regroup into five divider-separated zones and demote the two controls that do not belong on
a global toolbar.

**Code for this phase already landed** in commit `969f94e` (builder report:
`plans/reports/builder-260821-1617-uiux-p1-p2.md`). This file documents the agreed approach and
carries the outstanding human smoke gate. **Do not redesign it.**

Note: P2 hardened the bar against *shrinking*, but the bar has a hard minimum of ≈597 CSS px while
`tauri.conf.json` still permits `minWidth: 400`, so anywhere in the 400-596 band the window-zone
controls are clipped away. (At the 600 default the bar fits — with 3px to spare, which is why the
status readout is unusable there.) Both are fixed in **Phase 5**, deliberately, with the measurement
and the config change.

## Requirements

- Functional: every action that was on the old bar remains reachable somewhere obvious.
- Functional: Export honours the format chosen in Settings, and the choice survives an app restart.
- Functional: window drag still works on bar gaps, dividers and the status area; clicking a control
  activates it and does not drag.
- Functional: compact-mode hover-reveal and every keyboard shortcut unchanged.
- Constraint: no element ID renamed or removed; the two demoted controls keep their IDs at their
  new locations.
- Constraint: any **new** container inside the drag area needs its own `data-tauri-drag-region`.
  Tauri drags only when the attribute is on the exact mousedown target — it is not inherited
  (verified, see `plans/reports/researcher-260821-1642-webview2-tauri-constraints.md`). CSS
  `-webkit-app-region` does nothing here; it is removed in Phase 5.

## Architecture

Zones as landed, left to right, separated by 1px × 16px `.toolbar-divider` elements that each carry
`data-tauri-drag-region`:

| Zone | Contents |
|---|---|
| app | `#btn-settings` |
| transport | `.source-controls` (`#btn-source-system` / `-mic` / `-both`), `#btn-start`, `#btn-tts` |
| status | `#status-indicator` dot + `#status-text` + `#status-elapsed`; `flex:1`, `min-width:0`, `pointer-events:none`, drag surface |
| transcript | `.toolbar-group` (`#btn-copy`, `#btn-export`, `#btn-sessions`) then `#btn-clear` after a wider gap, destructive red hover |
| window | `#btn-compact`, `#btn-pin`, `#btn-minimize`, `#btn-close` |

Demotions:

- `#select-export-format` → Settings ▸ Display, as a normal full-width `<select>`. Dropping the
  `.export-format-select` class is what fixes the unreadable pill: the global `select` rule
  (`main.css:1132`) forces `appearance:none` with an arrow at `right 10px` and `padding-right:28px`,
  while `.export-format-select` (`main.css:1793`) overrode `padding` to `2px 4px` — at toolbar width
  the ".md" text sat under the arrow. `#btn-export` now reads
  `settingsManager.get().export_format`. Persistence needed a real disk-backed field, so
  `export_format: String` (default `"md"`) was added to `src-tauri/src/settings.rs` alongside
  `font_size`/`max_lines`; the JS settings cache alone does not survive a reload.
- `#btn-open-transcripts` → Sessions view header, beside the title.

Also landed here: `#status-elapsed` (mm:ss, h:mm:ss past an hour) driven by
`startElapsedTimer`/`stopElapsedTimer` in `status-indicator.js` off the existing
`recordingStartTime` — no new state; `.status-text` gains per-state colour classes
(`.connecting` warning / `.connected` success / `.error` error); `--text-muted` raised
`0.35 → 0.5` per user decision 4.

**Settled:** only the status *label* changes colour by state. The elapsed-time digits stay
always-muted. Do not colour them in a later phase.

### Control count — **16 → 14** (settled)

The counsel report's "16 → 12" counted the source picker as one segmented control, but the source
has **three separate buttons** (`#btn-source-system`, `#btn-source-mic`, `#btn-source-both`), and
merging them into one control would be a behaviour change that was never approved. So the correct
figure is **16 → 14**: the original 16 minus the two approved relocations
(`#select-export-format` → Settings, `#btn-open-transcripts` → Sessions view). No control was
invented or dropped to reach a number. **Settled by the user; use 14 everywhere.**

## Related Code Files

- Modify: `src/index.html` — control bar restructured; export-format select moved to Settings ▸
  Display; folder button moved to the sessions header.
- Modify: `src/styles/main.css` — `.toolbar-zone`, `.toolbar-zone-transport/-transcript/-window`,
  `.toolbar-group`, `.toolbar-divider`, `.btn-clear-danger`, `.status-area{min-width:0}`,
  `.status-text` ellipsis + state colours, `.status-elapsed`, `.sessions-title{flex:1}`,
  `--text-muted` value.
- Modify: `src/js/status-indicator.js` — elapsed timer + status state class.
- Modify: `src/js/app.js` — start/stop the elapsed timer.
- Modify: `src/js/session-manager.js` — `#btn-export` reads the persisted format.
- Modify: `src/js/settings.js`, `src/js/settings-form-controller.js` — `export_format` in defaults,
  `populateForm`, `saveFromForm`.
- Modify: `src-tauri/src/settings.rs` — `export_format` field, default `"md"`.

## Implementation Steps

*(Complete in `969f94e`. Listed for the record and for reopen-on-smoke-failure.)*

1. Wrap the bar's controls into five `.toolbar-zone` groups; insert four `.toolbar-divider`
   elements, each with `data-tauri-drag-region`.
2. Separate `#btn-clear` from the copy/export/sessions group with a wider gap; add
   `.btn-clear-danger` red hover.
3. Move `#select-export-format` into Settings ▸ Display without the `.export-format-select` class;
   wire `export_format` through `settings.js`, `settings-form-controller.js` and
   `src-tauri/src/settings.rs`; point `#btn-export` at it.
4. Move `#btn-open-transcripts` into `.sessions-header`; give `.sessions-title` `flex:1`.
5. Add `#status-elapsed` + timer; add `.status-text` state colour classes.
6. `--text-muted` 0.35 → 0.5.
7. `.status-area { min-width: 0 }` + `.status-text` ellipsis so the status zone is the only zone
   that compresses.
8. **Outstanding:** run the smoke gate below with the user and record the result in this file.

## Verification a Worker Can Do

Same three checks as Phase 1 (ID parity grep, vitest via `powershell.exe`, build artifact stat).
Result at `969f94e`: 91/91 vitest, 7/7 cargo settings tests, exe 11,394,048 bytes.

Additional grep for this phase: `grep -rn "select-export-format\|btn-open-transcripts" src/` — both
IDs must still resolve to exactly one element each in `src/index.html` and still be read by the same
JS as before.

## Verification a Worker Cannot Do

Everything visual, plus drag behaviour, compact-mode hover-reveal, and whether Export actually
writes the chosen extension.

## Smoke-Test Gate (HUMAN — blocking)

Run the full `docs/smoke-test-checklist.md` (this phase changes Display controls, Copy/Export and
Session persistence paths), then these phase-specific steps:

1. Start the app — the bar shows five visual groups separated by thin dividers; the status dot and
   "Ready" sit in the middle.
2. Click **Start** — status reads "Connecting…" (amber) then "Listening" (green); elapsed time ticks
   up beside it every second. Click **Stop** — elapsed clears, status returns to muted "Ready".
3. Copy / Export / Sessions are grouped tight; **Clear** sits after a visible gap; hovering Clear
   turns it red.
4. Settings ▸ Display — an "Export Format" dropdown, full width, arrow visible and **not** covering
   the text. Change it, Save & Close, reopen Settings — value stuck.
5. **Fully quit and relaunch the app** — the export format is still what you chose (disk
   persistence, not just the in-memory cache).
6. From the overlay, click **Export** — the saved file uses the format from step 4 (check the
   extension in the toast).
7. Sessions view — a folder icon sits beside the "Sessions" title; clicking it opens the transcripts
   folder in Explorer.
8. Drag the window by an empty toolbar gap, by a divider, and by the status area — all drag.
   Clicking any icon button activates it and does **not** drag.
9. Compact mode (⌘D or the compact icon) — hover-reveal bar behaves exactly as before.
10. Every keyboard shortcut still works: Space, ⌘1/⌘2/⌘3, ⌘T, ⌘D.
11. Shrink the window — the status text truncates with "…" first. **Known limitation until Phase 5:**
    at narrow widths the window-zone controls are still clipped. Note how narrow the window can get
    before compact/pin/minimize/close start disappearing, and report that width — Phase 5 needs it.

Phase closes only on user confirmation of steps 1-10. Step 11 is a measurement, not a pass/fail.

## Success Criteria

- [ ] Smoke steps 1-10 confirmed by the user
- [ ] Step 11 width measurement reported (feeds Phase 5)
- [x] Every action from the old 16-control bar still reachable
- [x] Both demoted controls keep their element IDs
- [x] Every new divider/zone container inside the drag area carries `data-tauri-drag-region`
- [x] Vitest and `cargo test` green; Windows exe artifact verified on disk

## Risk Assessment

- **`getElementById` bindings** — the bar was rebuilt wholesale; a dropped ID fails silently at
  runtime with no build step to catch it. Mitigated by the ID-parity grep; the only IDs JS reads but
  HTML lacks are six pre-existing dead references in `settings-form-controller.js`
  (`check-tts-enabled`, `hint-mode-local`, `link-elevenlabs`, `range-tts-speed`,
  `tts-settings-detail`, `tts-speed-value`), all behind `?.` or an `if (el)` guard, untouched here.
- **Drag surface regressions** — new `<div>`s inside the drag area silently stop dragging if the
  attribute is missing. Covered by smoke step 8.
- **Rust settings schema change** — `export_format` is additive with a default; existing
  `settings.json` files without the field fall back to `"md"`. Covered by
  `missing_fields_in_stored_json_fall_back_to_defaults` (passing).
- **Contrast bump is a real visible change** for all users (user decision 4, accepted). On its own it
  does not reach WCAG AA in the overlay at the shipped default opacity, because element opacity was
  fading the text as well — **Phase 7 fixes that root cause**. Not a P2 defect; the token change
  itself was correct and is a prerequisite for P7's numbers.
- **Rollback**: `git revert 969f94e` reverts P1 and P2 together. A P2-only rollback additionally
  requires reverting the `export_format` field in `src-tauri/src/settings.rs`, which is safe to
  leave in place (unused field, defaulted).
