# Research Brief: Contrast, Tokens, Focus, ARIA, Reskin Methodology

Scope: read-only findings for My Translator UI/UX overhaul. Math verified via script (linearized sRGB, WCAG relative-luminance formula), not eyeballed. Script: `/tmp/claude-1000/.../scratchpad/contrast.py` (session-scoped, not in repo).

## 1. Contrast: translucent text over translucent panel over unknown backdrop

**Honest method**: never compute text-vs-panel-declared-rgba contrast directly. Must double-composite: (1) panel rgba over backdrop → effective panel color; (2) text rgba over that effective panel → effective text color; (3) WCAG contrast ratio between effective-text and effective-panel (the panel is what's actually behind the glyph). Repeat for worst-case backdrops (#fff and #000 bound the range; any real desktop wallpaper falls between). This is standard WCAG guidance for translucent overlays — no single official W3C doc addresses double-alpha stacking directly, but the "Understanding SC 1.4.3" note on background images/gradients requiring worst-case check across the whole element is the applicable precedent (W3C).

**As asked** — `--text-muted: rgba(255,255,255,0.5)` over `--bg-secondary: rgba(25,25,35,0.92)`, panel alpha treated as fixed at 0.92 (i.e. `overlayView.style.opacity` = 1.0):

| Backdrop | Eff. panel RGB | Eff. text RGB | Contrast |
|---|---|---|---|
| white #fff (worst) | (43.4,43.4,52.6) | (149.2,149.2,153.8) | **4.685:1** |
| black #000 | (23.0,23.0,32.2) | (139.0,139.0,143.6) | **5.246:1** |

White backdrop is worse, by 0.561 absolute (~12% relative) — counter-intuitive but correct: white bleed-through lightens BOTH the panel and the white text roughly proportionally, shrinking the luminance gap between them. Min alpha for `--text-muted` to clear 4.5:1 in this worst case (panel fixed at 0.92): **alpha ≥ 0.485**. Current 0.5 clears it by a hair (4.685 ≥ 4.5) — assuming panel alpha stays pinned at 0.92.

**Critical finding — it does not stay pinned.** `src/js/app.js:263` sets `overlayView.style.opacity = settings.overlay_opacity` (default 0.85, user range 20–100%, `src-tauri/src/settings.rs:34/84`, `src/index.html:502-504`). CSS `opacity` on the parent is GROUP opacity — it flattens the whole subtree (panel + text, already alpha-composited against each other) into one buffer, then composites that buffer over the desktop at the slider value. This compounds far worse than the panel-alpha-only math above:

| overlay_opacity | Backdrop | Contrast | AA (4.5:1)? |
|---|---|---|---|
| 1.00 (theoretical max) | white | 4.685 | pass (barely) |
| **0.85 (DEFAULT)** | **white** | **3.515** | **FAIL** |
| 0.85 (default) | black | 4.074 | fail |
| 0.70 | white | 2.590 | fail |
| 0.50 | white | 1.820 | fail |
| 0.20 (min slider) | white | 1.221 | fail |

Min `overlay_opacity` for AA 4.5:1 in worst case ≈ **0.976 (97.6%)**. So `--text-muted` fails AA at every slider position except near-fully-opaque, including the shipped default (85%). This is worse than the token-only math suggests and must not be glossed over.

**Honest answer to "is AA achievable"**: No, not as a general promise for a user-tunable-opacity overlay. State it as: *AA (4.5:1) for `--text-muted` is only guaranteed at overlay_opacity ≥ ~98%; at the shipping default (85%) and below, it fails against light desktop backgrounds.* Do not write a plan claim like "meets WCAG AA" without the opacity qualifier. Either (a) scope the AA promise to a documented minimum opacity floor, (b) exclude `--text-muted` from body-text use (decorative/timestamp only) and accept AA does not apply there, or (c) clamp the effective alpha of muted-text so it compensates as `overlay_opacity` drops (complex, likely not worth it for an overlay app per KISS).

Sizes: app uses 8/10/11/12/13/14/16px. WCAG large-text exemption (3:1) requires ≥18.66px bold or ≥24px regular (SC 1.4.3 definition of "large scale text"). **None of the app's sizes qualify** — confirmed, all must meet the 4.5:1 normal-text threshold, no exemption available anywhere in this UI.

Other tokens for reference (panel alpha 0.92, group-opacity ignored — i.e. best case):
`text-secondary(0.55)`: 5.336 (white) / 6.085 (black) — passes AA even worst case, but will also degrade under group opacity the same way `text-muted` does (not re-swept per-token; same multiplier logic applies proportionally, secondary starts with more headroom).
`text-primary(0.92)`: 12.03/15.13 — huge headroom, fine.
`text-provisional(0.4)`: 3.551/3.819 — already below AA at panel-alpha-only calc; under default 85% opacity this will fail even harder. Currently only decorative/non-final text — confirm intent before flagging as blocking.
Old `text-muted(0.35)`: 3.065/3.225 — confirms the recent bump to 0.5 was a real (if insufficient) improvement.

## 2. Design tokens in plain CSS, no preprocessor, KISS-grade

Minimal 4-scale recommendation (numeric, not t-shirt — numeric scales are the dominant modern convention, e.g. Tailwind's `--spacing-1..-96`; t-shirt (`-xs/-sm/-md`) is the older Bootstrap-era convention and doesn't extend cleanly past 5-6 steps):

- **(a) Spacing**: `--space-1: 4px` through `--space-8` at 4px base (`--space-1:4px; -2:8px; -3:12px; -4:16px; -6:24px; -8:32px`) — 4px base gives finer control for a compact overlay UI vs 8px base. Numeric naming lets you interpolate (`--space-5`) without renaming later.
- **(b) Type scale**: `--font-size-1` through `-6` OR just keep literal px values as this app already does (8/10/11/12/13/14/16) mapped to 5-6 semantic tokens: `--text-xs:10px; -sm:12px; -base:14px; -md:16px`. App already has 7 distinct literal sizes hard-coded — tokenizing is optional/low-value here since sizes aren't reused as a "scale" so much as per-component fixed values; only tokenize if 3+ components genuinely share a size and should move together.
- **(c) Z-index**: small enumerated scale, not numeric steps — `--z-base:0; --z-dropdown:100; --z-sticky:200; --z-modal:300; --z-toast:400; --z-tooltip:500`. Named layers > arbitrary numbers because z-index bugs are about *stacking intent*, not magnitude.
- **(d) Control height**: `--control-h-sm:24px; -md:32px; -lg:40px` — small named scale, 3 steps is enough for buttons/inputs/icon-buttons in a compact toolbar.

Naming: kebab-case, category-first (`--space-*`, `--z-*`), consistent with existing `--bg-*`/`--text-*`/`--accent*` convention already in this file — extend the pattern, don't introduce a second convention.

**Pitfalls of mechanical literal→token replacement (live app, no visual-regression suite)**:
- A "replace all `16px` with `--space-4`" sweep will silently touch line-heights, border-radii, or icon sizes that happen to share the literal value but aren't spacing — changes intent, not just representation. Grep each literal's *context* (property name) before batch-replacing.
- Custom properties are **not animatable** by CSS transitions/animations directly in all cases (numeric custom props used in `calc()` transition fine only if the browser treats the property as a registered `<length>` via `@property`; plain `--x:16px` interpolation in a `transition: all` is NOT guaranteed — Chromium/Firefox do not interpolate custom-property values themselves, only the calculated property that consumes them, and only if both sides resolve to compatible types). If any current CSS transitions a literal value (e.g. `transition: padding 0.2s`), swapping the literal for a var is safe (transition targets the resolved `padding`, not the token); but `transition: --my-var 0.2s` alone does nothing without `@property`.
- Custom properties **cannot be used inside media query conditions** (`@media (min-width: var(--bp-md))` is invalid CSS — media queries are evaluated before custom-property cascade resolution). Any breakpoint values must stay literal or be duplicated as a build-time constant (there's no build step here, so just keep breakpoints literal and comment them).
- Specificity: tokens change VALUES, not cascade order — a token used in a lower-specificity rule can still be overridden the same as before; don't assume tokenizing "fixes" existing specificity fights.
- Because there's no visual regression suite, do the swap in small batches, one token category per commit, and manually eyeball each screen (per project's own rule: no automated visual regression will be built, so this is the only mitigation).

Sources: [Tailwind spacing scale](https://tailwindcss.com/docs/theme) (numeric convention baseline), [MDN `@property`](https://developer.mozilla.org/en-US/docs/Web/CSS/@property) (animatable custom props require registration), general CSS spec (media queries evaluated pre-cascade, custom props unusable there — MDN `@media`/`env()` docs corroborate no var() support in media conditions).

## 3. `:focus-visible` ring for dark glassmorphism overlay

Recommended: **`outline` + `outline-offset`**, not `box-shadow`. Reasons: `outline` doesn't affect layout/paint of adjacent siblings, is a native focus-affordance browsers already optimize for forced-colors/high-contrast mode (box-shadow is invisible in Windows High Contrast mode since it's not a real border-token), and is the technique WCAG's own Understanding docs use in examples.

Current repo state: 4 rules use `outline: none` (`main.css` lines 724, 1118, 1141, 1232) with **no `:focus-visible` replacement anywhere in the file** — keyboard focus is currently invisible on those elements. This is a real gap, not hypothetical.

Verified contrast: current `--border-focus: rgba(99,140,255,0.5)` composited over the panel only reaches **2.16:1 (white backdrop) / 2.36:1 (black)** — fails SC 1.4.11's 3:1 non-text-contrast floor. Solid `--accent: #638cff` (no alpha) against the same panel reaches **4.46:1 (white) / 5.70:1 (black)** — clears 3:1 comfortably in both worst cases. Recommendation: ring color = solid `--accent`, not `--border-focus`.

```css
:where(button, [role="button"], [role="switch"], [role="radio"], input, select, a[href]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- 2px matches SC 2.4.13's minimum thickness/area baseline (2 CSS px perimeter) — meets AAA "Focus Appearance" even though only AA is required, cheap to just do.
- `outline-offset: 2px` keeps the ring off translucent panel edges so it doesn't get eaten by `backdrop-filter` blur bleed.
- SC 2.4.11 (Focus Not Obscured, AA in 2.2) just requires the focused element isn't *fully* hidden by other author content (sticky headers etc.) — not a contrast rule, verify no overlapping toolbar covers focus on scroll.
- SC 2.4.13 (Focus Appearance) is AAA-only, not required, but the 2px+3:1 recipe above satisfies it for free.

Chromium `outline` + `border-radius`: **outline follows border-radius since Chrome 94 / Firefox 94** (shipped ~2021) — safe to rely on for a 2026 Windows-only app targeting current WebView2 (which tracks recent Chromium). No square-corner artifact expected on rounded panels/buttons.

Sources: [W3C Understanding SC 2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), [W3C Understanding SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html), [Chromium issue tracking outline+border-radius](https://issues.chromium.org/issues/41372460) (historical bug 81556, resolved Chrome 94).

## 4. ARIA: toggle buttons vs switch vs 3-way segmented control

Per [ARIA APG Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) and [APG Switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/):

- **Toolbar toggles (pin always-on-top, TTS on/off, compact mode)** — icon-only, binary, momentary-feel button → use **`<button aria-pressed="true|false">`**. APG: adding `aria-pressed` to a `role="button"` element is exactly the toggle-button pattern. Do NOT change the visible label/icon-only accessible name when state flips (APG explicit rule) — keep the accessible name constant (e.g. "Pin window", not "Pinned"/"Unpin"), let `aria-pressed` carry the state.
- Alternative `role="switch"` + `aria-checked` is semantically for on/off settings framed as a physical switch (APG: "lights switch on/off"). For icon-only toolbar buttons that read as *actions you press*, `aria-pressed` is the better fit and is less work (no extra role, browsers/AT already map plain buttons + aria-pressed correctly). Recommendation: **`aria-pressed`** for all three toolbar toggles — consistent, minimal, matches existing plain-`<button>` markup (repo currently has zero ARIA at all, so this is additive, not a migration).
- **3-way source segmented control (system/mic/both)** — mutually exclusive, exactly one selected → **`role="radiogroup"` wrapping three `role="radio"` + `aria-checked`**, per [APG Radio Group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/). This is the correct pattern for "select exactly one of N", not `aria-pressed` (which is for independent binary buttons) and not `switch` (binary only, not 3-way).

Keep it minimal per user's explicit "no a11y theatre": don't add `role="toolbar"` wrapper, `aria-roledescription`, or live-region chatter unless there's a real screen-reader user story — the two patterns above (aria-pressed button, radiogroup/radio) are the actual correctness bar, not decoration.

## 5. Reskin concept presentation methodology

Recommend **(a) standalone self-contained HTML mock page(s)** — one file per concept (2-3 files), each with its own inline `<style>` (copy of `main.css` with the concept's token overrides at the top) and the *actual* DOM structure/classnames lifted from `src/index.html`, not a redrawn approximation. User double-clicks each `.html` in the repo — opens in default browser via `file://`, zero dependency on Tauri/Rust/cargo/dev-server.

Why over the alternatives:
- **(b) swap `<link>` + edit live app**: means running `npm run tauri dev` (needs Rust toolchain warm, WASAPI/mic permission prompts, a live window) just to preview a *color* — high friction for a compare-3-concepts task, and risks leaving the working tree mid-edit between concepts.
- **(c) static images**: cannot represent `backdrop-filter: blur()` faithfully against varying wallpapers, cannot show hover/pressed states or the opacity slider's real effect (see finding in Q1 — critical for THIS app since translucency-over-unknown-backdrop is the core risk being evaluated). A screenshot bakes in one wallpaper and one opacity, hiding the exact risk the reskin needs to catch.
- Real browser CSS engine (Edge/Chrome, same Chromium family as WebView2) renders `backdrop-filter`/`rgba()` compositing essentially identically to the packaged app, so the standalone-HTML preview is representative, not just a mockup.
- Bonus: embed a `<select>` or buttons in the mock page to swap a `background-image` behind the panel (white/black/photo) so the user can literally drag-toggle through the Q1 worst-case scenario live, and a slider bound to `opacity` on a wrapper div to simulate `overlay_opacity` — turns the contrast finding above into something the user can *see*, not just read.

Caveat: mock pages are throwaway concept-comparison artifacts, not integrated into the app — after the user picks one, translate the winning token set into the real `main.css`; don't try to make the mock "become" the real file via find/replace (see Q2 pitfalls on mechanical replacement).

## Unresolved questions
- Does the accepted plan intend `--text-muted` for body copy or purely decorative/secondary chrome (timestamps, hints)? Determines whether the AA-fails-at-default finding is a blocking bug or an accepted trade-off.
- Is there a documented minimum `overlay_opacity` floor the product is willing to enforce/recommend (e.g. warn user below 60%)? Needed to write an honest contrast claim in docs.
- Confirm WebView2 version floor for this app (affects reliance on `outline` + `border-radius` behavior, though Chrome 94+ has been default for years so risk is low).

Status: DONE
Summary: Contrast math is worse than the token-only calc implies because `overlayView.style.opacity` (default 85%) group-composites on top of the already-translucent tokens — `--text-muted` fails AA (4.5:1) at the shipped default, only clears 4.5:1 at panel-alpha=0.92 in isolation. Given concrete token/z-index scale, focus-ring CSS (solid `--accent`, not the low-contrast `--border-focus`), correct ARIA patterns (aria-pressed for toolbar toggles, radiogroup/radio for the 3-way selector), and recommended standalone-HTML-mock method for presenting reskin concepts.
