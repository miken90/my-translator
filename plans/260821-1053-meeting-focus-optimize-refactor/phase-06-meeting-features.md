---
phase: 6
title: "Meeting Features"
status: completed
priority: P1
effort: "4-6d"
dependencies: [4]
---

# Phase 6: Meeting Features

## Overview

Ship the meeting/video-focused features the user asked for: crash-safe full-session logging, whole-session AI summary persisted into transcripts (+ regenerate for old sessions), copy/export, and transcript Q&A. Cut by user decision: file upload, OCR, Furigana.

## Requirements

- Functional:
  1. Session log survives crash: flush by segment count (e.g. every 20 segments) in addition to 2-min timer; orphan temp transcript detected on startup → offer recovery
  2. AI summary saved into the session `.md` (dedicated section); open old session → generate/regenerate summary; transcripts exceeding LLM context are chunked (map-reduce: chunk summaries → final summary)
  3. Copy (current session to clipboard) + Export (txt/md/srt-style with timestamps) from overlay and sessions view
  4. Q&A over a session transcript using existing OpenAI-compatible endpoint config
- Non-functional: summary/Q&A failures never corrupt or block transcript saving; features degrade gracefully when no AI endpoint configured

## Architecture

Builds on Phase 4 modules: `session-manager.js` owns flush/recovery; `ai-summary.js` (113 LOC) extends to chunking + persistence; new `session-qa.js` reuses same endpoint client. Summary stored as `## AI Summary` section appended to transcript markdown via existing Rust transcript commands (`transcript.rs` gains an append/update command if rewrite-whole-file is insufficient).

## Related Code Files

- Modify: `src/js/session-manager.js` — segment-count flush, startup orphan-temp detection + recovery prompt
- Modify: `src/js/ai-summary.js` — chunked summarization, write-back into transcript
- Create: `src/js/session-qa.js` — Q&A chat over loaded transcript
- Modify: `src/js/ui.js`/`index.html` — copy/export buttons, Q&A panel in sessions view, recovery dialog
- Modify: `src-tauri/src/commands/transcript.rs` — list/read temp transcripts, update saved transcript with summary section
- Modify: `tests/js/` — chunking boundaries, export formatting, recovery decision logic
- Modify: `docs/` — user-facing docs for new features; `docs/future-plans.md` — mark file upload/OCR/Furigana as cut (out of product scope)

## Implementation Steps

1. Branch `feature/meeting-features`. Order: logging hardening (1d) → copy/export (0.5d) → summary persistence + chunking (1.5-2d) → Q&A (2-3d).
2. Logging: flush trigger on `segmentCount % 20 === 0` PLUS keep existing 2-min timer (user-confirmed cadence: max ~20 utterances lost on crash); startup scan for temp files without matching final save → recovery dialog (Recover / Discard).
   <!-- Updated: Validation Session 1 - flush cadence confirmed 20 segments + 2-min timer; Q&A confirmed in scope -->
3. Copy/export: serialize from `sessionLog[]` (never `segments[]`); formats: clipboard text, `.md`, `.txt` with timestamps.
4. Summary: token-estimate transcript; if over threshold, chunk by ~N chars on utterance boundaries, summarize chunks, then summarize summaries; persist under `## AI Summary` with model + timestamp; regenerate replaces section.
5. Q&A context policy (fixed — no retrieval infra, no embeddings): full transcript when under the token threshold; otherwise the same map-reduce chunking used for summary. Simple chat UI in session view; no history persistence beyond session file (KISS).
6. Update docs; full smoke checklist (human checkpoint); RELEASE_NOTES entry.

All Rust build/test steps (`transcript.rs` changes) run via `powershell.exe -NoProfile` from a Windows path (`/mnt/d/...` cwd first) — never the WSL Linux toolchain.

## Success Criteria

- [x] Kill app mid-session → restart offers recovery → transcript restored to last flush (≤20 segments lost worst case)
- [x] Saved session `.md` contains `## AI Summary`; reopening old session can generate + regenerate it
- [x] 4h-transcript summary completes via chunking without context-length error
- [x] Copy/export produce correct full-session content from `sessionLog`
- [x] Q&A answers reference transcript content; graceful message when no endpoint configured
- [x] `docs/future-plans.md` reflects cut scope

## Risk Assessment

- Summary write-back could corrupt transcript file → write temp + atomic rename in transcript.rs; never partial-write in place.
- Chunked summaries can drift in quality → keep chunk size generous; note limitation in docs; user can regenerate.
- TTS/summary API keys in transcripts → never write endpoint/key values into transcript files; summary section stores model name only.
