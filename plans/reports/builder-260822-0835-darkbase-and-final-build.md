---
title: "Builder Report — Dark Webview Base + Final Windows Release Build"
date: 2026-08-22
plan: plans/260821-1640-uiux-overhaul/
commits: [769facc]
---

# Builder Report — Dark Webview Base (Task 1) + Final Windows Release Build (Task 2)

Branch `feat/uiux-p1-p2-session-scroll-toolbar`, HEAD `7919b3a` before starting (all 7 plan phases
landed). No new branch, no rebase, no merge, no push, no PR.

## Task 1 — dark webview base

### Mechanism + verification

Installed version: `tauri = "2"` in `Cargo.toml`, **locked to 2.10.3** in `Cargo.lock`, paired with
`tauri-utils 2.8.3`. Verified the config key directly against that exact locked crate's source
(`tauri-utils-2.8.3/src/config.rs`, found via the Windows cargo registry cache, not assumed from
docs):

- `WindowConfig` struct: `#[serde(rename_all = "camelCase", deny_unknown_fields)]` — an unsupported
  key would hard-fail config parsing at build time, not silently no-op.
- Field: `#[serde(alias = "background-color")] pub background_color: Option<Color>` → JSON key
  **`backgroundColor`**. Doc comment: "Set the window and webview background color."
- `Color`'s `Deserialize` accepts a hex string (`"#rgb"`, `"#rrggbb"`, `"#rrggbbaa"`), an `[r,g,b]` /
  `[r,g,b,a]` array, or `{red,green,blue,alpha}` — used the hex string form.

So `tauri.conf.json`'s `backgroundColor` **is** the correct, version-verified mechanism — no Rust
builder fallback needed.

### Colour chosen

`#0f0f14` — the exact RGB channels of `--bg-primary: rgba(15, 15, 20, 0.88)` in `main.css` (the
darkest surface token, and the one `#overlay-view::after`'s background layer actually paints).
Matches P6's own recommendation ("one `backgroundColor` in `tauri.conf.json`") and directly answers
the contrast problem P6 measured: the window was opaque with **no** background set anywhere, so
WebView2 defaulted to white, and fading the panel toward low opacity destroyed white text regardless
of the text's own alpha.

### What was NOT touched (per dispatch constraint)

- `html, body { background: transparent }` — untouched, still load-bearing (lets the new base show
  through).
- `#overlay-view::after` / `--overlay-opacity` wiring (P7) — untouched, verified by reading
  `thinker-260821-1802-uiux-p7.md` first. Read `thinker-260821-1837-uiux-p6.md` first too, per
  dispatch.
- No CSS token **value** changed. Only `src-tauri/tauri.conf.json` (`windows[0].backgroundColor`
  added).

### Verify + commit

`npm test` via `powershell.exe`: **108/108** (unchanged from `7919b3a` — Rust-config-only change,
no JS/CSS touched). Committed alone as `769facc`.

## Task 2 — final Windows release build

### Route taken

`scripts/build-release.sh` invokes `cargo build --release` directly — under WSL bash that resolves
to whatever toolchain WSL's own `cargo` targets, not Windows. Per dispatch, replicated the script's
two real steps entirely through `powershell.exe` instead of running the script:

1. `cargo build --release --manifest-path src-tauri\Cargo.toml` (via `powershell.exe`, from
   `D:\WORKSPACES\PERSONAL\my-translator`) — Windows Rust toolchain, produces the raw `.exe`.
2. Packaged the portable zip the same way the script does (`Copy-Item` → `Compress-Archive`), also
   via `powershell.exe`, replacing the stale `dist/` zip from 2026-08-21.

Did not run `npm run tauri build` — that additionally invokes the NSIS bundler, which this app does
not ship (portable `.exe` only, per `CLAUDE.md`); replicating the shipped script's actual steps is
the correct match to how this project releases.

### Proof — artifact on disk, not exit code

| Artifact | Path | Size | Modified |
|---|---|---|---|
| Raw exe | `src-tauri/target/release/my-translator.exe` | 11,364,352 bytes | 2026-08-22 08:45:51 +07 |
| Portable zip | `dist/MyTranslator-v0.6.0-windows-x64.zip` | 3,700,313 bytes | 2026-08-22 08:46:30 +07 |

Both checked immediately after the build/package commands, seconds after the reported mtimes (WSL
`stat` and PowerShell's `Get-Item` agree). The previous zip in `dist/` was dated 2026-08-21 14:38 —
today's run is unambiguously fresh, not a stale artifact. `cargo build` itself printed `Finished
release profile [optimized] target(s)` (7 pre-existing warnings, no errors) before either check ran.

### Final full test suite (against the built state)

```
vitest:  Test Files  17 passed (17)
         Tests       108 passed (108)

cargo test --manifest-path src-tauri\Cargo.toml:
         test result: ok. 16 passed; 0 failed; 0 ignored
         (lib unit tests: audio/microphone resampling, transcript export
          path-traversal + atomic write, settings round-trip/backup/defaults)
```

No test weakened, skipped, or deleted. Build did not fail — nothing to report as a failure.

## Consolidated smoke-test checklist — all 7 phases + Task 1

Ordered, deduplicated, merged from: `builder-260821-1617-uiux-p1-p2.md`,
`builder-260821-1747-uiux-p5.md`, `thinker-260821-1802-uiux-p7.md`,
`builder-260821-1810-uiux-p3-p4.md`, `thinker-260821-1837-uiux-p6.md`. **[DARK BASE]** = tests
today's Task 1 fix. **[GLASS BLUR]** = tests P7's backdrop-filter, the specific risk P7's own report
flagged as undetectable except by eye.

### Launch, toolbar, window

1. Fresh launch: window opens at 680×400, all 5 toolbar zones + dividers visible incl. close button;
   status dot + "Ready" centered.
2. Settings ▸ About: version shown (matches `package.json`), not `v0.5.2`, not blank.
3. Try to shrink narrower than it will go — stops at 600px (not 400); at that floor,
   compact/pin/minimize/close stay fully visible and clickable.
4. Drag by empty toolbar gaps, each divider, and the status area — window drags. Click any icon
   button — activates, does **not** drag.
5. Hover the Start button at default width — glow renders fully, not clipped.
6. Toolbar icons read as two size tiers (16px on settings/start/copy/close, 14px elsewhere); the
   system+mic combined icon looks less squashed than before; Sessions button shows a **list** glyph
   (not a clock) — click it, confirms it still opens Sessions.
7. Compact mode (toggle icon or shortcut): hover-reveal bar still works; the compact button itself
   now visibly shows an active/pressed state, same as pin and TTS.

### Recording, status, export

8. Click Start — status text "Connecting…" (amber) → "Listening" (green); elapsed time ticks up
   next to it. Click Stop — elapsed clears, status returns to muted "Ready".
9. Drag the window narrow **while recording** — status text truncates with "…" first; the elapsed
   timer truncates/hides rather than painting over the copy/export/sessions icons.
10. Settings ▸ Display: "Export Format" dropdown, full-width, arrow visible (not hidden behind
    text). Change it, Save & Close, reopen — value stuck. **Fully quit and relaunch** — still stuck.
11. From the overlay, click Export — file saved in the format chosen in step 10 (check the toast's
    filename extension).

### Sessions view

12. Sessions header: folder icon opens the OS file explorer at the transcripts folder.
13. Open a session with a long transcript, click Summary/Regenerate — summary card appears **above**
    the transcript, both scroll in **one** scrollbar; the Q&A input box stays pinned at the bottom.
14. Send Q&A messages until the answer list scrolls — thin styled scrollbar, not a bare OS one.
15. Session viewer header: top button is **×** "Close Sessions"; the one below is **←** "Back to
    list" — each does what its icon says.
16. Session viewer: the export-format dropdown beside Copy shows a visible arrow and is compact (not
    stretched full width).
17. Open a session with a summary: the small ORIGINAL/TRANSLATED labels read slightly brighter than
    before — nothing else in that block changed.
18. Open a session with **no AI endpoint configured**: Summary and the Q&A ask button look and
    behave disabled, Tab skips them, and hovering with the mouse does nothing (no background/colour
    change).

### Keyboard / focus / disabled state

19. Tab repeatedly from a cold start in the overlay — every control (settings, source buttons,
    start, TTS, copy, export, sessions, clear, compact, pin, minimize, close) shows a clearly visible
    blue ring; **no ring is cut off** at the window edge or panel border.
20. Click (mouse, not keyboard) any button — **no** ring appears. A ring on mouse click means the
    focus rule is wrong.
21. Settings: Tab through every tab, field, slider, colour dot, and select — ring visible on all,
    including the range sliders and colour dots (these had no ring at all before).
22. Sessions: Tab through the list, into a session, through the viewer header and Q&A input — ring
    never clipped by the panel edge.
23. Switch to two-way translation mode — the TTS button visibly goes inert and **Tab skips it**.
    Switch back — focusable again.
24. Hover the scrollbar thumb in all five scroll regions (transcript, Settings body, Sessions list,
    session viewer, Q&A) — all five now highlight on hover (four of them are new).

### Opacity, dark base, and glass blur

25. **[GLASS BLUR]** Launch at the default 85% opacity: overlay looks essentially as before — panel,
    blur, border, shadow all present.
26. **[DARK BASE]** Drag opacity to 20%: the panel goes nearly invisible, but transcript text,
    toolbar icons, and the status readout stay **crisp and clearly legible** — this is the actual
    fix. Before today's change this text was reported as fading to near-1:1 contrast; it should now
    read comfortably at every slider position.
27. **[GLASS BLUR]** Still at 20%: confirm the blur is still active — content behind the window
    looks blurred, not sharp. This is the one failure mode that cannot be checked except by eye.
28. Slide 20% → 100% and back — smooth, no flicker or repaint artefacts.
29. Save & Close Settings, reopen — opacity value stuck. Fully quit and relaunch — still stuck,
    applied at startup before touching anything.
30. At 20%: confirm nothing has fallen **behind** the panel — toolbar, transcript cards, speaker
    labels, the translation card's coloured left border, and the floating font/colour controls
    (hover bottom-right) must all still paint above it.
31. Compact mode at low opacity — hover-reveal still works and the revealed bar is readable.
32. Settings and Sessions views at 20% overlay opacity — both completely unaffected by the slider
    (it only applies to the overlay).
33. Trigger a toast (copy the transcript) and, if reproducible, the crash-recovery dialog — both
    still appear above everything.
34. **[DARK BASE]** Look at the window's **rounded top corners** at any width — should read as a
    subtle dark tone consistent with the panel, not the near-white wedges seen before today's fix.
35. **[DARK BASE]** At 20% opacity, the faint 1px window edge (border + shadow, which deliberately
    do not fade) should now sit against a dark backdrop rather than a pale one — confirms the base
    actually changed, not just that text got easier to read.

### Toggle states

36. Toggle pin, TTS, and compact — all three now visibly show an active/pressed state on their own
    button (compact is new here; pin and TTS already had it).

## Not a smoke-test item (open decision, not shipped code)

Phase 6's three reskin concepts (`plans/260821-1640-uiux-overhaul/concepts/*.html`) are standalone
comparison pages, not part of the build. Nothing to smoke-test there — the user still owes a pick
(or "none"), separately from this build.

## Unresolved questions

1. **P5's `getVersion()` call** was never verified in a real build before now — this build is the
   first chance. Check smoke step 2 first; if it shows a placeholder instead of the real version,
   that's the specific failure to report (see `builder-260821-1747-uiux-p5.md`).
2. **P7's 1px window-edge detail** (the border no longer sits over the fading panel background,
   flagged in `thinker-260821-1802-uiux-p7.md`) is unaffected by today's dark-base change — still
   worth a glance at smoke step 35, but it's a pre-existing, already-accepted cosmetic note, not new.
3. **Phase 6's concept pick is still open** — separate from this build/smoke pass entirely.

Status: DONE
Summary: Dark webview base (#0f0f14, verified via the exact locked tauri-utils 2.8.3 source, matching --bg-primary) committed alone (769facc); Windows release build produced by replicating build-release.sh's steps through powershell.exe (WSL cargo bypass), artifact verified on disk with fresh timestamps (exe 11,364,352 B, zip 3,700,313 B, both 2026-08-22 08:4x); 108/108 vitest + 16/16 cargo green against the built state.
Concerns/Blockers: None blocking. Three items above are for the user to confirm at smoke time, none of which stop delivery.
