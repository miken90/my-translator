# AI Session Summary — Brainstorm Report

---
type: brainstorm
date: 2026-04-06
slug: ai-session-summary
status: approved
---

## Problem Statement

Users record transcription sessions (original + translated text) saved as `.md` files. No way to get a quick AI-generated summary of a session without manually copying text to an external tool.

## Requirements

- Select saved session → generate AI summary from transcript content
- Two summary versions: original language + translated language (single API call)
- Provider config: OpenAI-compatible endpoint (covers OpenAI, Anthropic, cliproxy, any compatible API)
- New settings section for AI configuration
- Summary button in session viewer

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API layer | Frontend (JS fetch) | Matches Google TTS pattern, simpler, no Rust HTTP deps |
| Provider config | Simple free-text (endpoint + key + model) | YAGNI — dropdown model list adds complexity for little value |
| Summary display | Inline below transcript | Keeps context visible, no modal/panel overhead |
| Streaming | Wait for full response | Simpler implementation, spinner sufficient |
| Summary versions | Both in one call | Single prompt produces both, fewer API calls |
| Persistence | Ephemeral only | No disk save, lost on navigation |
| Prompt customization | Built-in default | Most users don't need custom prompts |

## Recommended Solution

### Single OpenAI-compatible module

All target providers (OpenAI, Anthropic compatible endpoint, cliproxy) speak `/v1/chat/completions`. One implementation covers all.

### New Settings Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `ai_endpoint` | string | `""` | Base URL (e.g. `https://api.openai.com/v1`) |
| `ai_api_key` | string | `""` | API key |
| `ai_model` | string | `""` | Model name (e.g. `gpt-4o-mini`) |

### New Module: `src/js/ai-summary.js`

- `summarize(transcriptText, { endpoint, apiKey, model })` → POST `{endpoint}/chat/completions`
- Built-in system prompt: detect languages from transcript, produce original + translated summaries
- Returns `{ original: "...", translated: "..." }`
- ~80 LOC

### UI Changes

- **Settings**: New "AI" tab with 3 inputs (endpoint, API key, model)
- **Session viewer**: "Summarize with AI" button → loading spinner → inline summary sections

### File Touchpoints

| File | Change |
|------|--------|
| `src-tauri/src/settings.rs` | Add 3 fields + defaults |
| `src/js/settings.js` | Add AI fields to load/save |
| `src/js/ai-summary.js` | **New** — summarize function |
| `src/js/app.js` | AI settings tab, summary button, click handler |
| `src/index.html` | AI settings tab markup |
| `src/styles.css` | Summary section styling |

### What It Won't Do

- No model list fetching (free-text only)
- No streaming (full response with spinner)
- No saving summaries to disk
- No custom prompt field
- No provider abstraction pattern

## Implementation Considerations

- Endpoint must strip trailing slash before appending `/chat/completions`
- Error handling: network errors, auth errors (401), rate limits (429), model not found
- Button disabled when AI settings incomplete (show tooltip)
- Loading state prevents double-click
- Transcript content sent as-is (markdown) — prompt handles parsing

## Success Criteria

- [ ] AI settings tab visible and functional
- [ ] Summary button appears in session viewer
- [ ] Click generates both summaries via OpenAI-compatible API
- [ ] Summaries display inline below transcript
- [ ] Works with OpenAI, cliproxy, and any OpenAI-compatible endpoint
- [ ] Graceful error handling (no config, network error, API error)

## Next Steps

Create implementation plan → implement → test → review.
