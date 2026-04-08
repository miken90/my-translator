# Project Changelog

All notable changes to My Translator are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [v0.6.0] — 2026-04-06 (Planned)

### Added

#### AI Session Summary (Experimental)
- **Feature**: Post-session AI-powered transcript summarization
- **UI**: "Summarize with AI" button in session viewer header
- **Output**: Inline original + translated summaries displayed below transcript
- **API**: OpenAI-compatible endpoints (supports OpenAI, Anthropic, Groq, etc.)
- **Settings**: New "AI" tab with configurable endpoint, API key, and model name
- **Implementation**:
  - 3 new settings fields: `ai_endpoint`, `ai_api_key`, `ai_model`
  - New `ai-summary.js` module (OpenAI chat completions client)
  - Concurrent call guard prevents duplicate requests
  - 30-second timeout with transcript truncation for large sessions
  - Error handling: 401 (invalid key), 429 (rate limit), network failures
  - Button disabled when AI settings not configured
- **Scope**: Session summaries only; not saved with transcript (ephemeral)
- **Status**: ✅ Stable

### Technical Details

- **Files Modified**:
  - `src-tauri/src/settings.rs` — Added 3 AI settings fields
  - `src/js/settings.js` — Added default values for AI settings
  - `src/index.html` — Added AI settings tab + summary button + container
  - `src/js/app.js` — Wired summary button, implemented `_summarizeSession()`
  - `src/styles/main.css` — Added styles for summary section

- **Files Created**:
  - `src/js/ai-summary.js` — OpenAI-compatible chat completions client

- **Dependencies**: None new (uses native `fetch` API)

---

## [v0.5.4] — 2026-04-08

### Fixed
- Fixed original text and translation mismatched during long meetings
  - Switched from FIFO to LIFO matching for translation-original pairing
  - Added monotonic segment IDs to prevent sessionLog collision
  - 2-tier stale cleanup: mark stale at 10s (dimmed), remove at 60s (was: delete at 10s)
  - Display trimming now only removes translated segments, never pending originals
- Stale segments show strike-through instead of perpetual "..." pending indicator

### Changed
- Audio batch interval reduced from 200ms to 100ms for faster translation response
- Buffer capacity adjusted (32KB → 16KB) to match new batch interval

**Status**: ✅ Complete

---

## [v0.5.1] — 2026-04-06

### Added
- Comprehensive project documentation (PDR, architecture, code standards, roadmap)

### Fixed
- Improved Google TTS blocked API error message with actionable guidance
- Bug fixes for audio capture edge cases

### Changed
- Session history viewer UI enhancements
- Unified card layout (original + translation stacked, removed single/dual view modes)
- Lowered default Soniox endpoint delay (3000ms → 1500ms) for faster perceived translation
- One-time migration for existing users (endpoint_delay auto-updated to 1500 if saved as 3000)
- Minor UI polish

**Status**: ✅ Complete

---

## [v0.5.0] — 2026-03-15 — Two-Way Translation

### Added
- Two-way translation mode (Language A ↔ Language B with auto-detection)
- "Both" audio source (simultaneous system + mic for video calls)
- Session mode tracking (one_way vs two_way)

### Changed
- Auto-disable TTS in two-way mode (prevents feedback loops)
- Improved error messages for Soniox failures

**Status**: ✅ Complete

---

## [v0.4.0] — 2026-02-20 — Local & Advanced

### Added
- ElevenLabs TTS provider (WebSocket streaming, premium voices)
- Local MLX + Whisper + Qwen2.5 pipeline (experimental, Apple Silicon only)
- Python sidecar model setup (`setup_mlx.py`, `local_pipeline.py`)
- Session history viewer
- Keyboard shortcut customization (prep work)

### Changed
- Custom context domain hints expanded

**Status**: ✅ Complete

---

## [v0.3.0] — 2026-01-10 — TTS Expansion

### Added
- Google Cloud TTS integration (Chirp 3 HD, near-human quality)
- Dual-panel view (original | translation side-by-side)
- Custom translation terms (domain-specific hints for Soniox)
- Microphone permission checks (macOS, Windows)

### Changed
- Settings sync across sessions

**Status**: ✅ Complete

---

## [v0.2.0] — 2025-12-15 — Polish & Stability

### Added
- Smart scroll (stay at bottom by default, allow manual scroll)
- Font size adjustment (A-, A+)
- Settings persistence via Tauri
- Keyboard shortcuts (Cmd+T for TTS toggle, Cmd+L for language, etc.)
- Session-based transcript saving (local `.md` files)
- Auto-updater integration (GitHub releases)

**Status**: ✅ Complete

---

## [v0.1.0] — 2025-11-01 — Foundation

### Added
- Real-time speech translation MVP
- System audio + microphone capture (macOS, Windows)
- Soniox STT + translation integration
- Single-panel overlay UI
- Edge TTS narration (free)
- Basic settings panel

**Status**: ✅ Complete

---

## Notes

- **Document updated**: 2026-04-06
- **Maintainer**: phuc-nt
- **Version scheme**: [Semantic Versioning](https://semver.org/)
- **Release cadence**: 4-6 weeks between major versions
