# Phase 2 — AI Summary Module + Session Viewer UI

## Context
- Session viewer HTML: `src/index.html` (lines 664–701)
- Session open logic: `src/js/app.js` (`_openSession` line 1623)
- Google TTS REST pattern: `src/js/google-tts.js` (reference for fetch pattern)
- Brainstorm: `plans/reports/brainstorm-260406-2309-ai-session-summary.md`

## Overview
- **Priority**: High (core feature)
- **Status**: completed
- **Depends on**: Phase 1 (settings fields must exist)

## Requirements

### New module: `src/js/ai-summary.js`

Create singleton module following existing code patterns (google-tts.js style):

```javascript
/**
 * AI Summary — OpenAI-compatible API client for transcript summarization
 */

class AISummary {
    /**
     * Summarize transcript content via OpenAI-compatible chat completions API
     * @param {string} transcriptText - Raw transcript markdown content
     * @param {{ endpoint: string, apiKey: string, model: string }} config
     * @returns {Promise<{ original: string, translated: string }>}
     */
    async summarize(transcriptText, { endpoint, apiKey, model }) {
        // Strip trailing slash from endpoint
        const baseUrl = endpoint.replace(/\/+$/, '');
        const url = `${baseUrl}/chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: transcriptText },
                ],
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            if (response.status === 401) throw new Error('Invalid API key');
            if (response.status === 429) throw new Error('Rate limited — try again later');
            throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        return this._parseResponse(content);
    }

    _parseResponse(content) {
        // Try JSON parse first
        // Then fallback to section-based parsing (## Original / ## Translated)
        // Return { original: '...', translated: '...' }
    }
}

const SYSTEM_PROMPT = `You are a transcript summarizer. Given a transcript with original and translated text pairs, produce two concise summaries:

1. **Original Summary**: Summarize the content in the original language(s) detected from the transcript
2. **Translated Summary**: Summarize the content in the translated language detected from the transcript

Detect the languages from the transcript content. Keep summaries concise (3-5 sentences each).

Respond in this exact JSON format:
{"original": "summary in original language", "translated": "summary in translated language"}`;
```

Key implementation details:
- ~60-80 LOC
- Error handling: 401 (bad key), 429 (rate limit), network errors
- Response parsing: try JSON first, fallback to text splitting
- Export as singleton: `export const aiSummary = new AISummary();`

### HTML changes (`src/index.html`)

Add summary button + container inside session viewer (after line 698, before closing `</div>` of session-viewer):

```html
<!-- AI Summary section -->
<div id="session-summary-section" class="session-summary-section" style="display:none">
  <div class="session-summary-header">
    <span class="session-summary-title">AI Summary</span>
  </div>
  <div id="session-summary-original" class="session-summary-block"></div>
  <div id="session-summary-translated" class="session-summary-block"></div>
</div>
```

Add summary button in `session-viewer-header` (after the copy button, line 697):
```html
<button id="btn-session-summarize" class="session-copy-btn" title="Summarize with AI">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
  Summary
</button>
```

### App.js changes (`src/js/app.js`)

1. **Import** at top (after other imports):
```javascript
import { aiSummary } from './ai-summary.js';
```

2. **Add script tag** to `src/index.html` (before app.js):
```html
<script type="module" src="/js/ai-summary.js"></script>
```

3. **Store current session content** in `_openSession()` — save transcript text for summary:
```javascript
this._currentSessionText = text;  // Store for summary
```

4. **Wire summary button** in `_bindEvents()`:
```javascript
document.getElementById('btn-session-summarize')?.addEventListener('click', () => {
    this._summarizeSession();
});
```

5. **Add `_summarizeSession()` method** near `_openSession()`:
```javascript
async _summarizeSession() {
    const s = settingsManager.get();
    if (!s.ai_endpoint || !s.ai_api_key || !s.ai_model) {
        this._showToast('Configure AI settings first (Settings → AI tab)', 'error');
        return;
    }
    if (!this._currentSessionText) return;

    const btn = document.getElementById('btn-session-summarize');
    const section = document.getElementById('session-summary-section');
    const originalEl = document.getElementById('session-summary-original');
    const translatedEl = document.getElementById('session-summary-translated');

    // Loading state
    btn.disabled = true;
    btn.textContent = 'Summarizing...';
    section.style.display = '';
    originalEl.textContent = 'Generating summary...';
    translatedEl.textContent = '';

    try {
        const result = await aiSummary.summarize(this._currentSessionText, {
            endpoint: s.ai_endpoint,
            apiKey: s.ai_api_key,
            model: s.ai_model,
        });
        originalEl.innerHTML = `<strong>Original</strong><p>${this._escHtml(result.original)}</p>`;
        translatedEl.innerHTML = `<strong>Translated</strong><p>${this._escHtml(result.translated)}</p>`;
    } catch (err) {
        originalEl.textContent = `Error: ${err.message}`;
        translatedEl.textContent = '';
        this._showToast(`Summary failed: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg>...</svg> Summary`;  // restore button
    }
}
```

6. **Reset summary** when navigating away — in `_showSessions()` clear summary section:
```javascript
const summarySection = document.getElementById('session-summary-section');
if (summarySection) summarySection.style.display = 'none';
```

7. **Disable button** if AI not configured — in `_openSession()` after loading:
```javascript
const s = settingsManager.get();
const summarizeBtn = document.getElementById('btn-session-summarize');
if (summarizeBtn) {
    const configured = s.ai_endpoint && s.ai_api_key && s.ai_model;
    summarizeBtn.disabled = !configured;
    summarizeBtn.title = configured ? 'Summarize with AI' : 'Configure AI in Settings first';
}
```

## Todo
- [ ] Create `src/js/ai-summary.js` module
- [ ] Add summary button to session viewer header in HTML
- [ ] Add summary section container in HTML
- [ ] Add script tag for ai-summary.js
- [ ] Import aiSummary in app.js
- [ ] Store session text in `_openSession()`
- [ ] Wire summary button click event
- [ ] Implement `_summarizeSession()` method
- [ ] Reset summary on navigation
- [ ] Disable button if AI not configured
- [ ] Compile check

## Success Criteria
- Summary button visible in session viewer header
- Click triggers API call, shows loading state
- Both summaries render inline below transcript
- Error toast on failure (bad key, network, etc.)
- Button disabled when AI settings not configured
