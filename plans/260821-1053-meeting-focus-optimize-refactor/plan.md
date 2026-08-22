---
title: "Meeting-Focus Optimize Refactor"
description: "Windows-only cleanup, test-first refactor of frontend/Rust, long-session performance, and meeting-focused features (durable session log + persisted AI summary)"
status: pending
priority: P1
effort: "3w"
tags: [refactor, performance, windows, testing]
created: 2026-08-21
blockedBy: []
blocks: []
---

# Meeting-Focus Optimize Refactor

## Overview

My Translator v0.5.4 repositions as Windows-only realtime translation for meetings + video watching. This plan: (1) delete all macOS/local-mode code, (2) build test safety net before refactor, (3) fix Rust stability issues, (4) split the 1927-LOC `app.js` god object + unify 4 duplicated TTS providers, (5) fix full-DOM-rebuild render path for multi-hour sessions, (6) ship meeting features: crash-safe session logging, persisted AI summary, copy/export, transcript Q&A.

Product decisions locked by user (2026-08-21 advise session): delete macOS entirely; tests before refactor; cut file upload / OCR / Furigana; scope features to meeting + video use case only.

## Context

- Advise session reframing confirmed by user 2026-08-21.
- Scout evidence: `src/js/app.js` 1927 LOC (6 concerns mixed); `ui.js` `_renderCards()` rebuilds all cards via `innerHTML` per 100ms update; 4 TTS providers duplicate ~150 LOC queue logic each; `src-tauri` carries macOS `system_audio.rs` (158 LOC), MLX local pipeline (321 LOC + 2 Python scripts), 6 `.unwrap()` on Edge TTS header parse, hardcoded `/Users/phucnt` HOME fallback, abandoned threads on stop.
- No existing tests anywhere. ~1000+ real users → incremental, behavior-preserving changes only.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Codebase Windows-only: zero macOS/MLX code or deps | P1 |
| 2 | Refactor with test net: no regression for existing users | P1 |
| 3 | Stable multi-hour sessions: no jank, no data loss on crash | P1 |
| 4 | Session log + whole-session AI summary durable in transcript files | P1 |
| 5 | Easier future work: no JS file >600 LOC, TTS base class | P2 |

## Non-Goals

- macOS support (deleted; recover from git history if ever needed)
- File upload, OCR screen translate, Furigana (outside meeting use case)
- Framework/bundler migration (stay vanilla JS + Tauri, no build step)
- Audio pipeline latency tuning (100ms batching, WASAPI polling stay as-is)
- E2E automation (manual smoke checklist instead)

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Delete macOS and Dead Code](./phase-01-delete-macos-and-dead-code.md) | Pending |
| 2 | [Test Harness](./phase-02-test-harness.md) | Pending |
| 3 | [Rust Stability](./phase-03-rust-stability.md) | Pending |
| 4 | [Frontend Refactor](./phase-04-frontend-refactor.md) | Pending |
| 5 | [Rendering Performance](./phase-05-rendering-performance.md) | Pending |
| 6 | [Meeting Features](./phase-06-meeting-features.md) | Pending |

Dependency chain: 1 → 2 → (3, 4) → 5 → 6. Phase 3 (Rust) may run parallel with Phase 4 (frontend) — disjoint files. Merge order when parallel: Phase 3 merges first (smaller), Phase 4 rebases. Phase 5 depends on 4 (touches refactored ui.js). Phase 6 depends on 4 (session-manager module). If schedule compresses, Phase 6 item 1 (crash-safe flush, P1 user requirement) may pull forward directly after Phase 4, ahead of Phase 5.

**Human smoke checkpoints (mandatory):** the smoke checklist requires a human on Windows with GUI + audio — no worker can execute it. Phases 1, 3, 4, 5, 6 each end with a blocking human checkpoint: worker reports done → user runs `docs/smoke-test-checklist.md` → phase closes only on user confirmation. Vitest/cargo green gates *merge*; human smoke gates *release*.

**Release strategy (user decision 2026-08-21):** single final release after Phase 6 — no interim release. Advisory review recommended an interim release after Phase 3 to bisect field regressions; user declined (one build/announce cycle). Accepted trade-off: any field regression surfaces only at final release with no updater push channel. Mitigation: mandatory per-phase human smoke checkpoints (all 5), full checklist again on the release build.

## Success Criteria

- [ ] `grep -ri screencapturekit src-tauri/Cargo.toml` empty; `system_audio.rs`, `local_pipeline.rs`, `scripts/setup_mlx.py`, `scripts/local_pipeline.py` deleted; Windows build green
- [ ] Vitest suite ≥20 tests green; `cargo test` green; smoke checklist doc exists
- [ ] Zero `.unwrap()` on network paths in `edge_tts.rs`; corrupt settings.json backed up not silently defaulted
- [ ] `wc -l src/js/app.js` <500; no JS file >600 LOC; 4 TTS providers extend one base
- [ ] Per-update render touches only changed card (human check: DevTools paint flashing); jsdom perf test proves O(changed) DOM mutations + bounded nodes over 5000 synthetic updates; heap stable over ~30min real run (human checkpoint)
- [ ] Kill app mid-session → restart recovers transcript to last flushed segment
- [ ] Saved session `.md` contains summary section; old sessions can (re)generate summary; long transcripts chunked
- [ ] Copy/Export works; transcript Q&A answers against full session log

## Risks

| Risk | Mitigation |
|------|------------|
| Refactor regression for 1000+ live users | Phase 2 test net before Phases 4-5; smoke checklist per phase; one branch per phase |
| Public repo may still have macOS users | User decision stands; deletion on this repo; git history preserves code. Flag in release notes |
| Incremental DOM render breaks smart-scroll/pairing edge cases | Vitest covers pairing/trim logic first; manual smoke includes scroll scenarios |
| `sessionLog`/`segments` drift during refactor | Preserve CLAUDE.md invariants: sessionLog never trimmed, clearSession only after successful save |

## Validation Log

### Session 1 — 2026-08-21

#### Verification Results
- Claims checked: ~25 (kongming advisory pass + targeted grep pass)
- Verified: all | Failed: 0 | Unverified: 0
- Tier: Full-equivalent (advisory agent verified LOC counts, line ranges, unwrap sites, phucnt fallbacks, temp-flush infra, ES module structure; follow-up greps verified ai-summary.js 113 LOC, `_maxQueueSize` audio-player.js:14, `_trimSegments` ui.js:419, CONTEXT_HISTORY_CHARS soniox.js:26, transcript.rs command surface incl. `save_transcript_temp`/`delete_transcript_temp` registered in lib.rs:51-52, `window.__TAURI__` top-level derefs settings.js:5/edge-tts.js:7/app.js:16)
- Corrections absorbed pre-validation (from advisory review): edge_tts.rs has 7 unwraps not 6 (criterion already demands 0); endpoint_delay migration lives at app.js:568 not settings.js (Phase 2 test moved to Phase 4)

#### Decisions
| # | Question | Decision |
|---|----------|----------|
| 1 | macOS deletion target | Delete on `main` of user's repo; macOS users rely on old releases + git history |
| 2 | Interim release after Phase 3 | **Declined** — single final release after Phase 6 (overrides advisory recommendation; trade-off documented in Phases section) |
| 3 | Smoke checkpoint runner | User runs full checklist at end of phases 1, 3, 4, 5, 6 |
| 4 | Crash-safe flush cadence | Every 20 segments + existing 2-min timer |
| 5 | Q&A feature scope | Stays in Phase 6 |

#### Whole-Plan Consistency Sweep
Re-read plan.md + all 6 phase files after propagation: no stale interim-release references remain; flush cadence consistent (plan.md goal 4, phase-06 step 2, success criteria "≤20 segments lost"); phase numbering in files matches table; powershell.exe constraint present in phases 1, 2, 3, 6 (5 inherits via smoke checkpoint); no contradictions found.

## Unresolved Questions

None. (macOS deletion target settled 2026-08-21: delete on `main` of user's repo; macOS users rely on old releases + git history.)

<!-- slug: meeting-focus-optimize-refactor -->
