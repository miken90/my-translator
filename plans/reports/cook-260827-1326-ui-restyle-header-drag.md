# Report: ui-restyle header-pills + drag-ground restyle

operation_id: op-260827-ui-restyle | branch: ui-restyle-header-drag | not pushed

## Status: DONE

## Summary

Restyled the header from 13 controls in 5 zones to 8 controls in 4 floating
pill clusters on a bare drag-enabled bar, restoring a continuous ≥48px drag
surface at every width/state (Gate 1 pain point). Applied matching pill +
a11y restyle to Settings/Sessions/Session-Viewer/Recovery-dialog/Toast per
design-spec.md, using only the new tokens.css deltas merged into
main.css:root. All 108 vitest tests pass; no src-tauri changes.

## Branch / commits

- `6792584` docs(design): add ui-restyle design spec, tokens, screens, mockups
- `698e3f5` feat(ui): restyle header into floating pill clusters on a bare drag ground
- `561e0ff` fix(ui): scope Ctrl+C/E preventDefault to the overlay view

## Test results

- vitest: **108/108 passed** (17 test files), run via `mcp__cmd__cmd_run` → `npm test` in `D:\WORKSPACES\PERSONAL\my-translator`. Stderr in the log is expected (tests intentionally exercising error-path console.error branches).
- cargo: not run — no `src-tauri/` files touched.
- `node --check` on all 8 touched/new JS files: pass.
- CSS brace balance check (open=265, close=265): pass.
- No duplicate DOM ids introduced (checked via id-extraction + uniq -c).

## Files changed

10 files in the implementation commit + fix (9 modified, 1 new:
`src/js/header-menus.js`), plus 9 new files in the docs commit
(`docs/design/ui-restyle/**`, pre-existing/untracked, committed for
history). `docs/smoke-test-checklist.md` updated with new drag/menu/compact
items.

## What changed

- **Header** (`src/index.html`, `src/styles/main.css`): 4 pills (App /
  Transport / Library / Window) + a bare `.ground` drag region carrying
  the status dot/text/elapsed, rendered `pointer-events:none`. Source
  system/mic/both collapsed into a mic split-button (`#btn-source-current`
  + `#btn-source-menu-toggle`) opening `#menu-source` — the original
  `#btn-source-system/mic/both` buttons and their app.js logic are
  reused unchanged, just restyled as `role="menuitemradio"` rows.
  Copy/Export/Clear collapsed into `#menu-overflow` (⋯), Clear kept
  danger-styled behind a divider.
- **`src/js/header-menus.js`** (new): generic open/close/arrow-key/Esc/
  outside-click controller shared by both header menus; only one open at
  a time.
- **Settings/Sessions/Session-Viewer headers**: same pill + bare-ground
  pattern; session-viewer header gains drag support it never had (its
  mockup explicitly required it — see judgment calls below).
- **Tokens**: merged `--accent-strong`, `--cluster-*`, `--drag-bar-min-gap`,
  `--menu-*`, `--z-menu` from `docs/design/ui-restyle/tokens.css` into
  `main.css:root`; all pre-existing tokens/values kept unchanged.
  `--accent-strong` now fills Save & Close / Recover buttons (hover keeps
  fill + ring, never lightens).
- **A11y**: `role="menu"/"menuitem(radio)"` + focus trap + arrow/Esc nav on
  both header menus; `aria-expanded`↔`aria-controls` pairing; `role="status"`
  on status text and success/info toasts, `role="alert"` on error toasts;
  settings tabs get `role="tablist"/"tab"/"tabpanel"` +
  `aria-controls`/`aria-labelledby`; `name` attributes added to 27 form
  inputs that lacked them; `aria-pressed` on color-picker dots; `lang`
  attribute on translated segment text in one-way mode (skipped in
  two-way — direction varies per segment); every shortcut hint now reads
  Ctrl instead of ⌘; recovery dialog gets `role="alertdialog"`,
  `aria-modal`, `aria-labelledby`/`aria-describedby`, `autofocus` on
  Recover.
- **`src/js/ui.js` / `transcript-card-renderer.js`**: `targetLang` threaded
  through `TranscriptUI.configure()` → `CardRenderer.render()` to set the
  translation `lang` attribute.

## Scope judgment calls (kongming-reviewed, go/no-go: GO after one fix)

Four places where I judged a small behavior addition was licensed by the
frozen design-spec/mockups rather than being an out-of-scope feature add,
without re-asking the user. Kongming (spawned per `--advice`) reviewed all
four against the actual mockup/spec files:

1. **New Ctrl+C/Ctrl+E shortcuts** (overflow menu). The mockup
   (`scr-01-main-overlay.html`) shows these as kbd hints; **design-spec.md
   §5 line "Keyboard shortcuts unchanged (⌘1/2/3 still switch source; menu
   is the pointer path)" does NOT actually list C/E** — so this is a
   spec-internal ambiguity (mockup implies new shortcuts, the prose only
   promises the pre-existing 1/2/3 stay working), not a hard contradiction.
   Kongming: reasonable to resolve in favor of the mockup (a rendered
   "Ctrl+C" hint with no working shortcut would be a lying UI), but flagged
   a real bug in the first implementation — `e.preventDefault()` fired for
   Ctrl+C in every view (not just overlay), which would have suppressed
   native text-selection copy in the session viewer. **Fixed** in
   `561e0ff`: the overlay-view gate now runs before `preventDefault()`.
2. **Esc/scrim-click safe-dismiss on the recovery modal.** Mockup caption
   explicitly specifies this behavior and its safety semantics. Kongming:
   correct call, implementation sound.
3. **Drag support added to the session-viewer header** (had none before).
   Mockup explicitly annotates this screen as covered by the hard
   ≥48px-drag-ground acceptance requirement. Kongming: not just
   defensible — omitting it would have *failed* the hard acceptance
   criterion, since that criterion says "every view."
4. **Dynamic source-icon swap** on the split-button's leading icon.
   Kongming: correct call — state reflection of already-tracked data
   (current source), not a new capability.

## Deferred-to-user smoke (GUI/drag/audio — cannot verify headless)

Added to `docs/smoke-test-checklist.md` under "UI restyle — header pills +
drag ground":
- Drag from bar ground at 600px and 680px widths
- Drag while actively recording
- Source menu open/select via mouse (chevron + check marks + Ctrl+1/2/3 hints)
- Overflow menu open/select via mouse (Copy/Export/Clear, danger styling, divider)
- Compact-mode reveal strip + bar layout after Ctrl+D
- Pin toggle (always-on-top verified via another window)
- Manual verify: select text in the session viewer, press Ctrl+C — native
  copy must still work (the exact regression the `561e0ff` fix targets)

## Concerns

- Visual fidelity to the mockups is unverified — the app was never launched
  (WSL scout, Windows-only build); all layout math (pill/gap widths vs. the
  48px minimum at 600px) is arithmetic, not rendered-pixel-verified.
- Two independent `keydown` Escape listeners now exist (app.js's
  view-navigation one, session-manager.js's new recovery-dialog one) — both
  fire on the same keydown; harmless today since the recovery dialog only
  appears at boot over the overlay, but worth knowing if either grows more
  Escape-sensitive state later.
- `--border-focus` contrast (open question #4 in design-spec.md) was left
  unchanged per the spec's own "pending live re-measure" note — not
  re-touched here.

## Unresolved questions

None — all user-owned decisions were either pre-recorded in
design-spec.md's Gate 1/§8 or resolved via the kongming advisory pass above.
