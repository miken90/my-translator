# Code Review: AI Session Summary Feature

**Date:** 2026-04-06  
**Reviewer:** code-reviewer  
**Scope:** AI-powered transcript summarization using OpenAI-compatible API

## Scope

- **Files reviewed:** 6 (ai-summary.js, app.js, settings.rs, settings.js, index.html, main.css)
- **New LOC:** ~91 (ai-summary.js) + ~80 across modified files
- **Focus:** Security, error handling, race conditions, pattern consistency, edge cases

## Overall Assessment

Solid implementation that follows existing codebase patterns well. XSS prevention via `createElement`/`textContent` is correct. Settings integration is consistent with TTS provider pattern. Several medium-severity issues found around missing timeout/abort handling, lack of transcript size limiting, and a race condition on rapid re-clicks.

---

## Critical Issues

None found.

---

## High Priority

### H1. No fetch timeout or AbortController — request can hang indefinitely

**File:** `src/js/ai-summary.js:28-42`

The `fetch()` call has no timeout. If the AI endpoint is unreachable or slow, the UI stays in "Summarizing..." state forever. The button is disabled during this time with no way to cancel.

**Impact:** User sees a stuck loading state, cannot retry or navigate cleanly.

**Fix:** Add an AbortController with a reasonable timeout (30-60s):

```js
async summarize(transcriptText, { endpoint, apiKey, model }) {
    const baseUrl = endpoint.replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { /* ... */ },
            body: JSON.stringify({ /* ... */ }),
            signal: controller.signal,
        });
        // ... rest of handling
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Request timed out — check your endpoint');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}
```

### H2. No transcript size limiting — large transcripts will exceed model context window

**File:** `src/js/ai-summary.js:34-39`

The full `transcriptText` is sent as the user message. Long recording sessions could produce transcripts of 50K+ characters, which will:
- Exceed the model's context window → API returns 400/413
- Cost excessive tokens on pay-per-token APIs
- The 400 error from the API is not specifically handled

**Impact:** Confusing generic error for long sessions. Potential unexpected cost.

**Fix:** Add a character limit with truncation notice:

```js
const MAX_CHARS = 30_000; // ~7.5K tokens, safe for most models
let text = transcriptText;
if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + '\n\n[Transcript truncated for summarization]';
}
```

### H3. Race condition — rapid double-click sends duplicate API calls

**File:** `src/js/app.js:1682-1734`

The button is disabled at line 1696, but `_summarizeSession()` is async. If called twice before the first invocation reaches the disable line (unlikely but possible with programmatic calls), or if the method is called while the previous one is still in flight after a re-enable (user navigates back and forth), two concurrent requests fire.

**Impact:** Duplicate API calls, UI state corruption when both resolve.

**Fix:** Add a guard flag:

```js
async _summarizeSession() {
    if (this._isSummarizing) return;
    this._isSummarizing = true;
    try {
        // ... existing logic
    } finally {
        this._isSummarizing = false;
    }
}
```

---

## Medium Priority

### M1. API key stored in plaintext JSON on disk

**File:** `src-tauri/src/settings.rs:70` → saved to `%APPDATA%/com.personal.translator/settings.json`

The `ai_api_key` is stored as a plaintext string in the JSON settings file on disk. This is consistent with the existing pattern for `soniox_api_key`, `elevenlabs_api_key`, and `google_tts_api_key`, so not a regression — but worth noting as a pre-existing concern if a user has sensitive keys.

**Impact:** Low for personal desktop app. Keys readable by any process running as the same user.

**Recommendation:** Informational only. Consistent with existing pattern. Future improvement could use OS credential store (Windows Credential Vault).

### M2. Error text from API response leaked to UI

**File:** `src/js/ai-summary.js:49`

```js
throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
```

The raw API error body (up to 200 chars) is passed to `_showToast()` and `originalEl.textContent`. While `textContent` prevents XSS, the error body could contain internal details from the AI provider (request IDs, internal paths, etc.).

**Impact:** Minor information disclosure to the user (who configured the endpoint anyway). Not exploitable since it's their own desktop app.

**Recommendation:** Keep as-is — truncation to 200 chars is reasonable and the user needs diagnostic info. No action needed.

### M3. Network error not specifically caught

**File:** `src/js/ai-summary.js:28-42`

If the endpoint URL is malformed or the network is down, `fetch()` throws a `TypeError` (not an HTTP error). This propagates to `_summarizeSession()` catch block which shows `err.message`. A `TypeError: Failed to fetch` is not user-friendly.

**Fix:** Wrap the fetch in a try-catch within `summarize()`:

```js
try {
    const response = await fetch(url, { ... });
} catch (fetchErr) {
    if (fetchErr instanceof TypeError) {
        throw new Error('Network error — check endpoint URL and internet connection');
    }
    throw fetchErr;
}
```

### M4. Summary not cleared when opening a different session

**File:** `src/js/app.js:1650-1680`

When `_openSession()` is called, `summarySection.style.display = 'none'` hides the summary but does NOT clear the content of `session-summary-original` and `session-summary-translated`. If the user opens session A, summarizes it, then opens session B, the old summary content is still in the DOM (hidden). If Session B's summarize fails, then the UI shows `section.style.display = ''` (line 1697) and the stale summary from Session A could briefly flash.

Actually, looking more carefully: the loading state at line 1698 sets `originalEl.textContent = 'Generating summary...'` which overwrites old content. So stale content is overwritten before it becomes visible. This is acceptable.

**Verdict:** Not a real bug. The loading state correctly overwrites old content.

---

## Low Priority

### L1. `show_original` field missing from JS DEFAULT_SETTINGS

**File:** `src/js/settings.js`

The Rust `Settings` struct has `show_original: bool` but the JS `DEFAULT_SETTINGS` lacks it. This is a pre-existing issue, not introduced by this PR. The `serde(default)` on the Rust side handles missing fields gracefully.

### L2. Redundant `<script>` tag for ai-summary.js

**File:** `src/index.html:808`

The `ai-summary.js` module is imported by `app.js` via ES module import. The standalone `<script type="module">` tag at line 808 causes the browser to load and execute the module independently, though ES modules are deduplicated by the browser. Harmless but unnecessary.

**Recommendation:** Remove the standalone script tag since app.js already imports it:
```html
<!-- Remove this line: -->
<script type="module" src="/js/ai-summary.js"></script>
```

### L3. SVG inline HTML in button restoration

**File:** `src/js/app.js:1731`

The `finally` block uses `btn.innerHTML = '<svg...>Summary'` to restore the button. While this SVG string is hardcoded (not user-controlled), using `innerHTML` with dynamic content is a pattern to avoid. Since the SVG is a constant string literal, this is safe but could be cleaner.

**Recommendation:** Extract the button HTML to a constant or use `createElement` for consistency with the XSS-safe approach used elsewhere.

---

## Positive Observations

1. **XSS prevention done right** — Summary content rendered via `createElement` + `textContent`, not `innerHTML`
2. **Consistent pattern** — AI settings follow the exact same pattern as TTS providers (settings fields, populate, save, key toggle)
3. **Robust response parsing** — Three-tier fallback (JSON → code-block JSON → text splitting → raw content) handles various LLM response formats well
4. **Proper error differentiation** — HTTP status codes mapped to human-readable errors (401, 429, 404)
5. **Clean separation** — `ai-summary.js` is a focused, single-responsibility module
6. **Button state management** — Proper disabled/enabled toggling with tooltip explaining why disabled
7. **Backend integration** — Rust settings with `serde(default)` ensures backward compatibility with existing settings files

---

## Recommended Actions (Priority Order)

1. **[H1]** Add AbortController + 60s timeout to fetch call
2. **[H2]** Add transcript character limit (~30K chars) with truncation
3. **[H3]** Add `_isSummarizing` guard to prevent concurrent calls
4. **[M3]** Wrap fetch in try-catch to give user-friendly network error messages
5. **[L2]** Remove redundant script tag from index.html

---

## Metrics

- Type Coverage: N/A (vanilla JS, no TypeScript)
- Test Coverage: N/A (no test infrastructure for frontend)
- Linting Issues: 0 (follows existing code style)
- Security Issues: 0 critical, 0 high (XSS properly handled)
- Performance Issues: 1 (missing timeout), 1 (unbounded transcript size)

---

**Status:** DONE  
**Summary:** AI Summary feature is well-implemented with proper XSS prevention and consistent patterns. Three high-priority issues found: missing fetch timeout, no transcript size limit, and a minor race condition on rapid clicks. No critical or security-blocking issues.
