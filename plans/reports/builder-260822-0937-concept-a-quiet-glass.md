---
title: "Builder Report — Concept A (Quiet Glass) Applied + Rebuild"
date: 2026-08-22
plan: plans/260821-1640-uiux-overhaul/
commits: [d6c643b]
---

# Builder Report — Concept A (Quiet Glass) Applied to the Real App + Rebuild

Branch `feat/uiux-p1-p2-session-scroll-toolbar`, HEAD `769facc` before starting. No new branch, no
rebase, merge, push, PR, version bump, or tag.

## What Concept A actually needed

Read `concept-a-quiet-glass.html`, `concepts/README.md`, and `thinker-260821-1837-uiux-p6.md` first.
Confirmed the phase-6 report's claim: Concept A is a `:root` value swap (same token **names**,
changed **values**) plus a documented component-rule block. **It needed exactly that — no more.**
No JS, no Rust, no layout property beyond what the concept's own override block names.

## Token changes — before → after (all in `:root`, names unchanged)

| Token | Before | After |
|---|---|---|
| `--bg-primary` | `rgba(15,15,20,0.88)` | `rgba(14,15,22,0.92)` |
| `--bg-secondary` | `rgba(25,25,35,0.92)` | `rgba(24,25,34,0.94)` |
| `--bg-glass` | `rgba(30,30,45,0.65)` | `rgba(30,32,46,0.68)` |
| `--bg-input` | `rgba(40,40,55,0.7)` | `rgba(38,40,55,0.72)` |
| `--bg-hover` | `rgba(60,60,80,0.5)` | `rgba(64,68,90,0.55)` |
| `--bg-active` | `rgba(80,80,110,0.5)` | `rgba(86,92,120,0.55)` |
| `--border-subtle` | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.08)` |
| `--border-light` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.14)` |
| `--border-focus` | `rgba(99,140,255,0.5)` | `rgba(120,150,235,0.55)` |
| `--text-primary` | `.92` alpha | `.96` alpha |
| `--text-secondary` | `.55` alpha | `.72` alpha |
| `--text-muted` | `.50` alpha | `.60` alpha |
| `--surface-1/2/3` | `.04/.05/.1` | `.05/.07/.12` |
| `--accent` | `#638cff` | `#7a97e0` |
| `--accent-hover` | `#7ea0ff` | `#94aeee` |
| `--accent-glow` | `rgba(99,140,255,.15)` | `rgba(122,151,224,.16)` |
| `--accent-alt` | `#63b3ed` | `#74b0d8` |
| `--accent-speaker` | `#f5a623` | `#e5b165` |
| `--accent-minimize-hover` | `#facc15` | `#eccc63` |
| `--accent-translation` | `rgba(255,140,200,.4)` | `rgba(240,150,190,.60)` |
| `--success` | `#4ade80` | `#5fd694` |
| `--warning` | `#fbbf24` | `#eec158` |
| `--error` | `#f87171` | `#f28b8b` |
| `--error-strong` | `#ef4444` | `#e85c5c` |
| `--space-xs` | `6px` | `4px` (now equals `--space-2xs`) |
| `--space-md` | `10px` | `8px` (now equals `--space-sm`) |
| `--font-size-xs` | `10px` | `11px` (now equals `--font-size-sm`) |
| `--font-size-md` | `13px` | `14px` (now equals `--font-size-lg`) |

Unchanged: `--radius-*`, `--z-*`, `--control-h-*`, `--control-bar-height`, `--transition-*`,
`--text-on-accent`. Names collided intentionally (xs≡2xs, md≡sm for spacing; xs≡sm, md≡lg for
type) per the concept's own "4 rendered sizes" / "4px rhythm" design — recorded in `:root` comments
so a future reskin knows it's deliberate, not dead weight.

## Component-rule selectors changed (12, not the ~11 the cost table estimated — same set, counted
per-selector rather than per-rule-block)

| Selector | Property | Before | After |
|---|---|---|---|
| `.float-btn` | `height` | `26px` | `var(--control-h-sm)` (28px). Width stays `26px` — the concept's own rule only lists `height` for this pair, so `.float-btn` is now 26×28, not square. Flagged, not silently squared off. |
| `.session-copy-btn` | `height` | `26px` | `var(--control-h-sm)` |
| `.btn-icon-sm` | `width`+`height` | `24px` | `var(--control-h-sm)` (both) |
| `.term-row .btn-remove-term` | `width`+`height` | `22px` | `var(--control-h-sm)` (both) |
| `.general-row .btn-remove-general` | `width`+`height` | `22px` | `var(--control-h-sm)` (both) |
| `.btn-label` | `font-size` | `8px` | `var(--font-size-xs)` (11px) |
| `.seg-header .seg-time` | `font-size`, `color` | `0.7em`, `rgba(255,255,255,.25)` | `var(--font-size-sm)`, `var(--text-muted)` |
| `.lang-badge` | `font-size` | `0.7em` | `var(--font-size-sm)` |
| `.seg-card .seg-original` | `color`, `font-size` | `rgba(255,255,255,.55)`, `0.85em` | `var(--text-secondary)`, `var(--font-size-md)` |
| `.speaker-label` | `font-size` | `0.85em` | `var(--font-size-md)` |
| `.seg-card` | `border-radius`, `padding` | `8px`, `10px 14px` | `var(--radius-sm)` (6px), `var(--space-sm) var(--space-lg)` (8px 12px) |
| `.seg-card .seg-translation.pending` | `color` | `rgba(255,255,255,.2)` | `var(--text-muted)` |

`.seg-card`'s radius/padding change is a real value shift beyond a "colour token." Included it
anyway: it's explicitly costed in the concept's own README table ("`.seg-card`'s 8px radius and
14px padding are literals — 1 selector") as part of the picked design, and it touches only the CSS
rule, not `transcript-card-renderer.js` or the card's DOM structure — the file/render-path
constraint stayed intact. Flagging per dispatch's "say what it actually needs" instruction rather
than silently doing it or silently skipping it.

## Necessary extra fix not in the concept's own selector list

Six alpha-variant literals elsewhere in `main.css` were keyed to the **old** accent/error/success/
warning/accent-alt/accent-minimize-hover RGB triples (e.g. `rgba(99,140,255,0.25)` — an accent-glow
hover shade). `tests/js/css-tokens.test.js`'s allowlist matches literals against `:root` token
triples; changing the tokens without updating these literals would have made all six fail as
"unassigned colour literals." Re-pointed each triple to its token's new value, alpha unchanged:
`(248,113,113)→(242,139,139)`, `(99,140,255)→(122,151,224)`, `(250,204,21)→(236,204,99)`,
`(74,222,128)→(95,214,148)`, `(99,179,237)→(116,176,216)`, `(251,191,36)→(238,193,88)`. This is the
mechanical consequence of any full-palette swap under the P3 token layer, not scope creep.

## Webview base — updated, and why

`src-tauri/tauri.conf.json`: `backgroundColor` `#0f0f14` → **`#0e0f16`**, matching the new
`--bg-primary`'s RGB channels `(14,15,22)` exactly (same mechanism/verification as the prior dark-
base commit — this just re-points the hex to the new palette). Confirmed the choice is not
arbitrary: base == `--bg-primary`'s own colour means the panel composites to the **exact same
pixel colour at every opacity setting** (see below) — the base isn't just "close," it's identical.

## Contrast — computed against the real composite base, all four opacity checkpoints

Because `backgroundColor` (`14,15,22`) now equals `--bg-primary`'s RGB channels exactly, compositing
`--bg-primary` over the base at *any* alpha yields that same colour — `rgb(14,15,22)` at 20%, 50%,
85%, and 100% overlay opacity alike (verified by direct sRGB compositing, not assumed). So every
ratio below is **opacity-independent**, not a per-setting table:

| Text tier | On the panel | On a `.seg-card` (surface-1 over panel) |
|---|---:|---:|
| `text-primary` | **17.60:1** | **15.87:1** |
| `text-secondary` | **10.05:1** | **9.36:1** |
| `text-muted` | **7.23:1** | **6.88:1** |
| `accent-speaker` (`#e5b165`) | **9.84:1** | — |
| `accent` (`#7a97e0`) | **6.67:1** | — |

All tiers clear WCAG AA (4.5:1) at **every** opacity from 20% to 100% — no tier fails, nothing to
report quietly. Also checked the focus ring (solid `var(--accent)`) against every surface it can
sit on:

| Ring vs | Ratio |
|---|---:|
| Overlay panel (`--bg-primary` composite) | **6.67:1** |
| Settings/Sessions panel (`--bg-secondary`, not slider-driven) | **6.14:1** |
| Input fields (`--bg-input` over `--bg-secondary`) | **5.39:1** |

All comfortably clear SC 1.4.11's 3:1 non-text floor.

**Side note, not a regression:** with the window fully opaque and its base a flat colour, there is
no textured content behind `#overlay-view` for `backdrop-filter: blur()` to visibly act on — this
was already true before this change (P6 measured the window as opaque with no compositing through
it). Concept A does not touch the blur; not evaluating or "fixing" it here.

## Hard constraints — verified intact

- `grep -c 'outline: none' src/styles/main.css` → **0**.
- `grep -n 'overlay-opacity\|::after' src/styles/main.css` → `#overlay-view::after`, `--overlay-opacity` wiring present, byte-identical to `ac964e9`/`769facc` structure — untouched.
- `grep -n 'background: transparent;'` on `html, body` → present, untouched.
- `grep -c 'text-dim\|text-provisional'` → **0** — not resurrected.
- `git status --porcelain` → only `src/styles/main.css` and `src-tauri/tauri.conf.json` changed. No `src/index.html`, no `src/js/**`, no `transcript-card-renderer.js`.
- `tests/js/css-tokens.test.js` and `tests/js/html-id-bindings.test.js` — both green (below).

## Test output

```
vitest (powershell.exe, /mnt/d):  Test Files  17 passed (17)
                                  Tests       108 passed (108)

cargo test (src-tauri touched via tauri.conf.json):
                                  test result: ok. 16 passed; 0 failed
```

Unchanged from `769facc`'s 108/108 and 16/16 — no test weakened, skipped, or deleted.

## Commit + rebuild

Committed alone as `d6c643b`. Then rebuilt:

- Same route as the last build (bypasses `scripts/build-release.sh`'s WSL-cargo flaw):
  `cargo build --release --manifest-path src-tauri\Cargo.toml` via `powershell.exe`, then
  `Copy-Item`/`Compress-Archive` via `powershell.exe` to repackage the portable zip.

| Artifact | Path | Size | Modified |
|---|---|---|---|
| Raw exe | `src-tauri/target/release/my-translator.exe` | 11,364,352 bytes | 2026-08-22 10:00:10 +07 |
| Portable zip | `dist/MyTranslator-v0.6.0-windows-x64.zip` | 3,700,485 bytes | 2026-08-22 10:00:27 +07 |

Checked seconds after each command via both `Get-Item` (PowerShell) and `stat` (WSL) — agree. Build
did not fail; `cargo build` printed `Finished release profile [optimized]` before either check.

## Short smoke list — the reskin only (~8 items, not a repeat of the 36-step checklist)

1. Overlay: colours read one step lighter/calmer everywhere — text less stark white, accent blue
   noticeably calmer/less saturated, amber speaker label softer.
2. Transcript cards: slightly smaller radius, tighter horizontal padding than before; the
   "ORIGINAL" line and timestamp are a touch bigger/brighter than before (font-size + colour lift).
3. Toolbar/Settings/Sessions: session Copy/Export buttons, the transcript font-size +/- buttons,
   and the two term/context "remove" buttons are all visibly a bit bigger (unified control height).
   **Look at `.float-btn` specifically** — it's now a non-square 26×28 box, not resized to a clean
   square; confirm whether that reads as fine or as a visible defect.
4. Tab to any focus ring — still a clearly visible ring, now a calmer blue; confirm it's still easy
   to see against every surface (overlay, Settings, Sessions, on an input).
5. Drag opacity 100→20%: panel colour should look **identical** at every stop, not just legible —
   that's the point of matching the webview base to `--bg-primary` exactly.
6. Window's rounded corners at any width: no colour seam against the panel.
7. Two-way mode / disabled Q&A controls: still visibly and correctly disabled, unaffected by colour
   change.
8. `.lang-badge` (language detected badge, if visible in your test transcript): font-size is
   slightly larger than before; its background/border colours are untouched by this change.

## Unresolved questions

1. **`.float-btn` is now 26×28, not square** — the concept's own rule only lists `height` for this
   pair (`.float-btn, .session-copy-btn { height: var(--control-h-sm); }`), so I did not add a
   width change it didn't ask for. If it looks wrong, say so and I'll square it to 28×28.
2. **`.seg-card`'s radius/padding change** (documented in the concept, applied here) is a value
   change beyond a pure colour token — flagging per the dispatch's "beyond colour tokens" caution,
   though it does not touch `transcript-card-renderer.js` or the card's DOM.
3. Everything else — token values, control heights, contrast — matches the concept and the AA
   requirement with no open item.

Status: DONE
Summary: Concept A (Quiet Glass) applied to main.css (:root swap + 12 component selectors) and the webview base updated to match (#0e0f16); every text tier + the focus ring clears WCAG AA/SC1.4.11 at every opacity 20-100% (opacity-independent, since base now equals --bg-primary exactly); 108/108 vitest + 16/16 cargo; committed as d6c643b; fresh build verified on disk (exe 11,364,352 B, zip 3,700,485 B, both 2026-08-22 10:00).
Concerns/Blockers: None blocking. Two items above (float-btn asymmetry, .seg-card layout value) are the user's call at smoke time, not defects I'm unsure about.
