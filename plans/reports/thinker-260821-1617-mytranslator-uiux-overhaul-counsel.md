# my-translator UI/UX overhaul — counsel

Advisory report. Evidence: both screenshots read; `src/index.html` (783 ln), `src/styles/main.css` (1819 ln), session-manager.js, ai-summary.js, window-manager.js, settings-form-controller.js, phase plans 260821-1053. All `file:line` refs = `/mnt/d/WORKSPACES/PERSONAL/my-translator/`.

## TL;DR

Both defects are structural, not cosmetic. Recommend **tier (b) systemize**, phased so the two reported fixes land first and the user can stop after phase 2 with full value. Reject full redesign: 1000 users, zero visual regression tests, app works.

---

## 1. Issue diagnoses (source level)

### Issue 1 — Sessions viewer overflow

Not a modal — it's the `#sessions-view` view, viewer state. DOM (`index.html:689-753`):

```
#session-viewer.sessions-body        ← flex column (main.css:1496) + override overflow:hidden (main.css:1603)
├─ .session-viewer-header            flex-shrink:0            (main.css:1608)
├─ #session-viewer-content.session-content-scroll   flex:1, overflow-y:auto  (main.css:1651)
├─ #session-summary-section          flex-shrink:0, NO max-height, NO overflow  (main.css:1675-1679)  ← the bug
└─ .session-qa-section               flex-shrink:0, max-height:260px (main.css:1743-1751)
   └─ .qa-messages                   max-height:160px, overflow-y:auto, NO scrollbar styling (main.css:1765) ← the ugly stray default scrollbar in the screenshot
```

Mechanism: `.session-summary-section` is `flex-shrink:0` with unbounded height. A long AI summary makes fixed-height children sum > container; `.session-content-scroll` (the intended scroll region) collapses toward 0 (auto min-height computes to 0 for overflow≠visible), the QA section is pushed past the bottom edge and clipped by `#session-viewer { overflow:hidden }` (main.css:1603). The visible wide white scrollbar is `.qa-messages` — the only scroller in the app without `::-webkit-scrollbar` styling, so WebView2 default renders.

**Fix shape** (correct for a Tauri desktop panel):

1. `index.html`: wrap `#session-viewer-content` + `#session-summary-section` in one new `div.session-scroll-region` — `flex:1; min-height:0; overflow-y:auto` (styled scrollbar). Keep all existing IDs — session-manager.js toggles `style.display` on the section by ID only (session-manager.js:358-369), so wrapping is safe.
2. `.session-content-scroll` loses `flex:1`/`overflow` → becomes plain block inside the scroll region.
3. Header stays `flex-shrink:0` outside the scroll region (no `position:sticky` needed — avoid sticky inside blur/backdrop-filter ancestors in WebView2).
4. `.session-qa-section` stays pinned bottom, `flex-shrink:0`; style `.qa-messages` scrollbar like the others.
5. Recommend rendering summary ABOVE transcript in scroll order (it's the read-first artifact) — small DOM move, same IDs. User call — see unresolved Q1.

Result: exactly one main scrollbar + one bounded QA scrollbar, header/QA-input always visible. Rejected CSS-only alternative (`.session-summary-section { flex-shrink:1; min-height:0; overflow-y:auto }`): bounds it but yields 3 nested scrollbars — worse UX.

Bonus defect same screen: two stacked back buttons (`btn-sessions-back` in `.sessions-header` + `btn-session-back-to-list` in viewer header, index.html:674/691). In viewer state, hide/merge the outer one.

### Issue 2 — Toolbar

16 interactive controls in one 42px row (`index.html:19-148`): settings · status · 3 source btns · start · TTS · [clear · copy · **format `<select>`** · export · folder · sessions] · compact · pin · minimize · close.

**The unlabeled blue pill = `#select-export-format`** (index.html:94-97). Global `select` rule (main.css:1082) forces `appearance:none`, arrow background at `right 10px`, `padding-right:28px`; `.export-format-select` (main.css:1732) overrides padding to `2px 4px` — at its tiny flex width the ".md" text collides with/hides behind the arrow image → blank pill. Structural sin regardless: a format-picker `<select>` living permanently in a global toolbar.

Structural problems beyond cosmetics:

- No grouping/separators — transport, transcript actions, and window chrome are one undifferentiated run.
- Destructive `clear` (trash) sits directly between transport and copy.
- Icon metaphor errors: sessions = clock icon (reads as "history/timer"), compact = diagonal collapse arrows; icon sizes mixed 13/14/16/18px.
- No narrow-width strategy: buttons have `min-width`, bar can't wrap, `#overlay-view` is `overflow:hidden` → at small widths close/minimize get clipped and become unreachable.
- Rarely-used file management (folder, format select) at same rank as start/stop.
- `-webkit-app-region: no-drag` sprinkled through main.css (126, 328, 374, 1541, 1642, 774) is Electron-ism — inert in Tauri; drag is governed solely by `data-tauri-drag-region` on the mousedown target. Team already hit this (settings-form-controller.js:36 comment).

### Toolbar redesign (buildable spec)

Left → right, 4 zones, 1px×16px dividers (`var(--border-light)`, margin 0 4px, carrying `data-tauri-drag-region`):

1. **App**: gear (settings).
2. **Transport**: source segmented control (system/mic/both, keep) · Start/Stop primary (keep blue/red) · TTS chip (keep).
3. **Status (flex:1, drag surface)**: dot + text as today; upgrade: while recording show elapsed time ("● 12:34"); text color follows state (muted/warning/success/error). Not clickable — keep `pointer-events:none`.
4. **Transcript**: copy · export (single button) · sessions (swap icon to a list/document-stack) · clear (last in group, gap before it; destructive hover red like `.close-btn`).
5. **Window**: compact · pin · minimize · close (keep order, close last).

Demotions:
- `#select-export-format` → Settings (new "Export format" select under Display tab; persist; export button uses it). Keep the element ID wherever it lands — session-manager.js reads it by ID (session-manager.js:72-79). Same for `#select-session-export-format` in the viewer header — same treatment or keep, viewer has room.
- `btn-open-transcripts` (folder) → move into Sessions view header ("Open folder"). File management belongs with sessions.

Result: 16 → 12 toolbar controls. Normalize icon sizes (16px zone-primary, 14px rest), hit targets ≥28px, add `:focus-visible` ring, `aria-pressed` on toggles (pin/TTS/compact/source).

---

## 2. Whole-app systemic audit (main.css/index.html)

- **Token system is partial**: colors/radius/transitions exist (main.css:15-50). Missing: spacing scale, type scale (8/10/11/12/13/14/16px hardcoded ~40 places), z-index scale (10, 99, 100, 1000 ad hoc), control-height scale (22/24/26/28/30/32/34 — seven button heights).
- **`--text-dim` used 4× but never defined** (main.css:1688, 1711, 1760, 1797) — silently falls to fallback. Define or replace with `--text-muted`.
- **Rogue color literals**: `#63b3ed` float-btn.active (main.css:646) vs `--accent #638cff`; `#f5a623` speaker label (688); `#facc15` minimize hover (229); pink `rgba(255,140,200,.4)` translation border (573); `rgba(255,255,255,0.04)` repeated ~8×. Tokenize (`--accent-speaker`, `--accent-translation`, `--surface-1`…), values unchanged.
- **No `:focus-visible` anywhere** — keyboard focus invisible on every button. Inputs/selects have `:focus` only.
- **Disabled states inconsistent**: `.disabled` class + pointer-events (tts-action-btn:206) vs `:disabled` pseudo (session-copy-btn:1721). Normalize on `:disabled`.
- **Scrollbar styling duplicated 4×**, missing entirely on `.qa-messages`. Consolidate into one shared rule-set.
- **Contrast**: `--text-muted` = white@0.35 at 10-11px ≈ 3.2:1 — fails AA for small text (hints, session meta, status). Bump to ~0.45-0.5 or increase size. User approval — visual change.
- **Small-window robustness**: no toolbar overflow strategy; verify/force `minWidth` in tauri.conf so the bar never clips.
- **Stale version ship-bug**: About tab hardcodes "v0.5.2" (index.html:646); no JS sets `#about-version`; app is 0.6.0 (package.json:4, tauri.conf.json:4). Fix: `getVersion()` from `@tauri-apps/api` (already a dependency) at startup.
- Inline styles in index.html (`style="margin-top: 8px"` etc.) — move static margins to classes; leave JS-managed `display` toggles alone.
- Desktop-specific constraints to preserve: user-tunable opacity + backdrop-filter glass (don't touch bg token values), compact-mode hover-reveal bar (main.css:233-263), always-on-top pin, `user-select:none` body (intentional for overlay; copy buttons cover it).

## 3. Scope tiers

| Tier | Content | Risk vs 1000 users / no visual tests | Verdict |
|---|---|---|---|
| (a) Surgical | 2 reported fixes only | Minimal | Under-delivers "toàn bộ"; token debt bites next UI task |
| **(b) Systemize** | (a) + token layer + state/scrollbar/contrast normalization + small fixes | Moderate, bounded: mostly CSS, IDs frozen, human smoke per phase | **Recommend** |
| (c) Full redesign | Reskin/new layout | High: no regression net, users habituated, no evidence of brand dissatisfaction | Reject now |

Tier (b) phased so (a) lands first — user can stop after phase 2 with both pain points fixed.

## 4. Phases (tier b)

**P1 — Session viewer layout** (files: index.html sessions section, main.css 1600-1819; session-manager.js untouched)
Accept: long summary + long transcript + QA all reachable; one main scrollbar + styled bounded QA scrollbar; header + QA input always visible; summary show/hide + back-to-list reset still work; small window still usable. Regress-risk: display-toggle flows in session-manager.js. **Human smoke: yes.**

**P2 — Toolbar regroup** (files: index.html control-bar + sessions header, main.css toolbar section, settings.js/app.js small: export-format persistence, folder-btn relocation)
Accept: every previous action reachable; export honors chosen format; drag works on bar gaps/status/dividers; compact-mode hover reveal unaffected; keyboard shortcuts unchanged; vitest green. Regress-risk: `getElementById` bindings (keep every ID), compact-mode absolute bar height. **Human smoke: yes.**

**P3 — Token layer** (main.css only)
Define spacing/type/z/height tokens, `--text-dim`, tokenize rogue colors; mechanical literal replacement, rendered values unchanged (except approved contrast bump). Accept: no orphan `var()`, grep finds no leftover duplicated literals, visual spot-check unchanged. **Human smoke: quick visual pass.**

**P4 — State normalization** (main.css, minor index.html attrs; depends on P3)
`:focus-visible` ring token, unified `:disabled`, shared scrollbar rules, hit targets ≥28px, `aria-pressed`/labels. Accept: tab-through shows focus everywhere; disabled states consistent. **Human smoke: keyboard pass.**

**P5 — Small-fix bundle** (index.html, app.js, tauri.conf.json)
Dynamic about-version, delete `-webkit-app-region` cruft, inline margins → classes, merge double back button, enforce `minWidth`. **Human smoke: light.**

Order: P1, P2 independent (parallelizable, different css regions — but same file, prefer sequential); P3 → P4. Human runs `docs/smoke-test-checklist.md` after P2 and after P5 at minimum. No visual test suite exists — all visual acceptance is human; workers verify only ID stability (grep), vitest, and Windows build via `powershell.exe` from `/mnt/d`.

## 5. What NOT to do

- No framework/Tailwind/preprocessor/bundler — frontend has no build step; main.css ships raw.
- Never rename/remove element IDs — ~40 `getElementById` bindings + vitest tests depend on them.
- Don't convert Sessions into a modal overlay — it's a view; keep the view-switch architecture.
- Don't use `position:sticky` inside the new scroll region — backdrop-filter ancestors + WebView2 glitch; keep header outside the scroller instead.
- Don't rely on `-webkit-app-region` for drag; every NEW container that should drag needs `data-tauri-drag-region` on itself (Tauri drags only when the attribute is on the mousedown target).
- Don't touch transcript rendering (`transcript-card-renderer.js`, seg-card CSS) — phase-5 perf work just shipped.
- Don't change bg/opacity/glass token values — user-tunable opacity interacts with them.
- Don't gate critical actions behind hover-only affordances (app is used mid-meeting).
- No a11y theatre (roles/landmarks everywhere) — focus-visible + labels + pressed states is enough for a desktop overlay.
- Don't ship any phase without the human smoke where flagged — a worker cannot verify GUI/audio (standing rule).

## Assumptions

- "Toàn bộ" means fix-and-systemize, not reskin — inferred from evidence being 2 defects (high confidence; unresolved Q5 covers the flip case).
- Sessions screenshot = maximized-ish window; view-not-modal reading verified in source (high).
- Format select rarely changed per-export → safe to demote to Settings (medium — Q2).
- WebView2/Chromium webview → `::-webkit-scrollbar` valid (high).

## Unresolved questions (for the user)

1. In the session viewer, should AI Summary appear ABOVE the transcript in the scroll (recommended) or below as today?
2. OK to move the `.md/.txt` export format picker into Settings (toolbar keeps a single Export button, remembers last format)?
3. OK to move the "open transcripts folder" button off the toolbar into the Sessions view?
4. Approve slightly brighter muted/hint text (contrast fix — small visible change)?
5. Do you want any actual visual refresh (colors/spacing look), or keep the current look exactly? (Tier (c) stays parked unless yes.)
