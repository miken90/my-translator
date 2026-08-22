# Phase 1 — Settings (Backend + Frontend)

## Context
- Rust settings: `src-tauri/src/settings.rs`
- JS settings manager: `src/js/settings.js`
- Settings UI HTML: `src/index.html` (lines 174–663)
- Settings populate/save: `src/js/app.js` (`_populateSettingsForm` line 526, `_saveSettingsFromForm` line 632)

## Overview
- **Priority**: High (blocks Phase 2)
- **Status**: completed
- Add 3 new settings fields for AI summarization config

## Requirements

### Rust (`src-tauri/src/settings.rs`)
Add 3 fields to `Settings` struct after line 67 (after `google_tts_speed`):
```rust
/// AI summary endpoint URL (OpenAI-compatible)
pub ai_endpoint: String,
/// AI summary API key
pub ai_api_key: String,
/// AI summary model name
pub ai_model: String,
```

Add defaults in `impl Default` after line 93 (after `google_tts_speed: 1.0`):
```rust
ai_endpoint: String::new(),
ai_api_key: String::new(),
ai_model: String::new(),
```

### JS defaults (`src/js/settings.js`)
Add to `DEFAULT_SETTINGS` after line 26 (after `tts_auto_read: true`):
```javascript
ai_endpoint: '',
ai_api_key: '',
ai_model: '',
```

### Settings UI HTML (`src/index.html`)
Add new tab button after "TTS" tab (line 199):
```html
<button class="settings-tab" data-tab="tab-ai">AI</button>
```

Add new tab content panel before the "About" tab content (before line 607):
```html
<!-- Tab: AI Summary -->
<div class="settings-tab-content" id="tab-ai">
  <div class="settings-section">
    <span class="field-label">AI Endpoint</span>
    <input type="text" id="input-ai-endpoint" placeholder="https://api.openai.com/v1" autocomplete="off" />
    <p class="hint">OpenAI-compatible API base URL</p>
  </div>
  <div class="settings-section">
    <span class="field-label">API Key</span>
    <div class="input-group">
      <input type="password" id="input-ai-api-key" placeholder="sk-..." autocomplete="off" />
      <button id="btn-toggle-ai-key" class="icon-btn small" title="Show/Hide">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  </div>
  <div class="settings-section">
    <span class="field-label">Model</span>
    <input type="text" id="input-ai-model" placeholder="gpt-4o-mini" autocomplete="off" />
    <p class="hint">Model name for summarization</p>
  </div>
</div>
```

### Settings form logic (`src/js/app.js`)

In `_populateSettingsForm()` — add after Google TTS section (after line 629):
```javascript
// AI settings
const aiEndpoint = document.getElementById('input-ai-endpoint');
if (aiEndpoint) aiEndpoint.value = s.ai_endpoint || '';
const aiApiKey = document.getElementById('input-ai-api-key');
if (aiApiKey) aiApiKey.value = s.ai_api_key || '';
const aiModel = document.getElementById('input-ai-model');
if (aiModel) aiModel.value = s.ai_model || '';
```

In `_saveSettingsFromForm()` — add after Google TTS fields (after line 692):
```javascript
settings.ai_endpoint = document.getElementById('input-ai-endpoint')?.value.trim() || '';
settings.ai_api_key = document.getElementById('input-ai-api-key')?.value.trim() || '';
settings.ai_model = document.getElementById('input-ai-model')?.value.trim() || '';
```

In `_bindEvents()` or `_bindSettingsEvents()` — add toggle for AI API key:
```javascript
document.getElementById('btn-toggle-ai-key')?.addEventListener('click', () => {
    const input = document.getElementById('input-ai-api-key');
    input.type = input.type === 'password' ? 'text' : 'password';
});
```

## Todo
- [ ] Add 3 fields to Rust `Settings` struct + defaults
- [ ] Add 3 fields to JS `DEFAULT_SETTINGS`
- [ ] Add "AI" tab button + content panel to HTML
- [ ] Add populate logic in `_populateSettingsForm()`
- [ ] Add save logic in `_saveSettingsFromForm()`
- [ ] Add API key toggle event binding
- [ ] Compile check: `cd src-tauri && cargo check`

## Success Criteria
- AI tab appears in settings view
- 3 fields (endpoint, key, model) load/save correctly
- API key toggle show/hide works
- Rust compiles without errors
