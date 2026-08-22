---
phase: 1
title: Card Layout + Remove Dual Mode
status: completed
priority: high
effort: medium
completed: 2026-04-06
---

# Phase 1: Card Layout + Remove Dual Mode

## Overview

Replace both `_renderSingle()` and `_renderDual()` with a unified `_renderCards()` renderer. Each segment becomes a card showing original text + translation stacked vertically, with speaker header, language badge, and timestamp.

## Related Code Files

**Modify:**
- `src/js/ui.js` — renderer methods, remove `viewMode` property
- `src/js/app.js` — remove view toggle binding + keyboard shortcut
- `src/index.html` — remove `btn-view-mode` button from floating controls
- `src/styles/main.css` — add card styles, remove dual-view styles

## Implementation Steps

### Step 1: Update `_renderCards()` in `ui.js`

Replace `_renderSingle()` and `_renderDual()` with single `_renderCards()` method.

```js
_renderCards() {
    let html = '';
    let lastRenderedSpeaker = null;
    let lastRenderedLang = null;

    for (const seg of this.segments) {
        // Determine if we need speaker header
        const showSpeaker = seg.speaker && seg.speaker !== lastRenderedSpeaker;
        const showLang = seg.language && seg.language !== lastRenderedLang;

        if (showSpeaker) lastRenderedSpeaker = seg.speaker;
        if (showLang) lastRenderedLang = seg.language;

        // Format timestamp from createdAt
        const time = this._formatTime(seg.createdAt);

        // Build card header (only if speaker or language changed)
        let headerHtml = '';
        if (showSpeaker || showLang) {
            headerHtml = '<div class="seg-header">';
            if (showSpeaker) headerHtml += `<span class="speaker-label">Speaker ${seg.speaker}</span>`;
            if (showLang) headerHtml += `<span class="lang-badge">${this._langEmoji(seg.language)}</span>`;
            headerHtml += `<span class="seg-time">${time}</span>`;
            headerHtml += '</div>';
        }

        if (seg.status === 'translated' && seg.translation) {
            const confidenceClass = (seg.confidence !== null && seg.confidence < 0.7) ? ' low-confidence' : '';
            html += `<div class="seg-card">`;
            html += headerHtml;
            html += `<div class="seg-original">${this._esc(seg.original || '')}</div>`;
            html += `<div class="seg-translation${confidenceClass}">${this._esc(seg.translation)}</div>`;
            html += `</div>`;
        } else if (seg.status === 'original' && seg.original) {
            // Show original immediately — translation pending
            html += `<div class="seg-card seg-pending">`;
            html += headerHtml;
            html += `<div class="seg-original">${this._esc(seg.original)}</div>`;
            html += `<div class="seg-translation pending">...</div>`;
            html += `</div>`;
        }
    }

    // Provisional text (currently being recognized)
    if (this.provisionalText) {
        let provHeader = '';
        if (this.provisionalSpeaker && this.provisionalSpeaker !== lastRenderedSpeaker) {
            provHeader += `<span class="speaker-label">Speaker ${this.provisionalSpeaker}</span>`;
        }
        if (this.provisionalLanguage && this.provisionalLanguage !== lastRenderedLang) {
            provHeader += `<span class="lang-badge">${this._langEmoji(this.provisionalLanguage)}</span>`;
        }
        if (provHeader) provHeader = `<div class="seg-header">${provHeader}</div>`;

        html += `<div class="seg-card seg-provisional-card">`;
        html += provHeader;
        html += `<div class="seg-provisional">${this._esc(this.provisionalText)}</div>`;
        html += `</div>`;
    }

    this.contentEl.innerHTML = html;
    this._smartScroll(this.container.parentElement || this.container);
}
```

### Step 2: Add `_formatTime()` helper in `ui.js`

```js
_formatTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
```

### Step 3: Update `_render()` in `ui.js`

Replace the viewMode branching:
```js
// Before:
if (this.viewMode === 'dual') {
    this._renderDual();
} else {
    this._renderSingle();
}

// After:
this._renderCards();
```

### Step 4: Remove `viewMode` from `configure()` in `ui.js`

Remove the `viewMode` handling block in `configure()` (the `if (viewMode !== undefined)` block that toggles `dual-view` class and re-renders).

Remove `this.viewMode = 'single'` from constructor.

### Step 5: Remove view toggle from `app.js`

- Remove `btn-view-mode` event listener (~line 175-178)
- Remove `_toggleViewMode()` method (~line 1519-1524)

### Step 6: Remove view toggle button from `index.html`

Remove the `btn-view-mode` button from floating controls div (~line 168-173):
```html
<!-- REMOVE THIS -->
<button id="btn-view-mode" class="float-btn" title="Toggle dual view">...</button>
```

### Step 7: Update CSS in `main.css`

**Add card styles:**
```css
/* ─── Card Layout ─────────────────────────────── */
.seg-card {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 6px;
}

.seg-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.seg-header .speaker-label {
  margin: 0;
  display: inline;
}

.seg-header .seg-time {
  margin-left: auto;
  font-size: 0.7em;
  color: rgba(255, 255, 255, 0.25);
}

.seg-card .seg-original {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.85em;
  margin: 0 0 4px 0;
}

.seg-card .seg-translation {
  color: var(--transcript-font-color, var(--text-primary));
  border-left: 2px solid rgba(255, 140, 200, 0.4);
  padding-left: 10px;
  font-weight: 400;
}

.seg-card .seg-translation.pending {
  color: rgba(255, 255, 255, 0.2);
  font-style: italic;
  border-left-color: rgba(255, 255, 255, 0.1);
}

.seg-provisional-card {
  opacity: 0.6;
}
```

**Remove dual-view styles** (~lines 546-604): all `.dual-view` rules.

**Remove old `.seg-block` styles** (~line 540-543).

## Todo

- [x] Replace `_renderSingle()` + `_renderDual()` with `_renderCards()`
- [x] Add `_formatTime()` helper
- [x] Remove `viewMode` from `configure()` and constructor
- [x] Remove view toggle binding + method from `app.js`
- [x] Remove `btn-view-mode` button from `index.html`
- [x] Add `.seg-card` CSS, remove dual-view CSS
- [x] **[RED TEAM]** Remove `show_original` checkbox from Display tab — new layout always shows original, checkbox becomes zombie
- [x] **[RED TEAM]** Remove `showOriginal` handling from `configure()` in `ui.js` and `_applySettings()`/`_gatherSettingsFromUI()` in `app.js`
- [x] **[RED TEAM]** Verify `_smartScroll()` target — after removing dual-view CSS, confirm `this.container.parentElement` is still the scrollable element
- [x] **[RED TEAM]** Use consistent CSS class `.seg-translation` (new) everywhere — do NOT reuse old `.seg-translated`
- [x] Test: verify cards render correctly for translated, original (pending), and provisional states

## Success Criteria

- Each utterance renders as a self-contained card
- Original text always visible above translation
- Speaker header shows only on speaker change
- Language badge shows only on language change
- Timestamp right-aligned in header
- Provisional text renders as dimmed card
- Auto-scroll still works
