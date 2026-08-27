# Project Changelog

All notable changes to My Translator are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [v0.8.0] — 2026-08-27

### Added
- Mic source picker collapsed into a split-button + menu (System audio / Microphone / Both), with Ctrl+1/2/3 shortcuts preserved
- Overflow (⋯) menu for Copy transcript / Export / Clear transcript, with new Ctrl+C / Ctrl+E shortcuts
- Accessible menu semantics (role=menu/menuitem, focus trap, arrow-key navigation), role=status/alert on status text and toasts, settings tabs as a real tablist, meaningful `name` attributes on form inputs, `lang` attribute on translated text
- Crash-recovery dialog: Esc / scrim-click safe dismiss (keeps the recovered transcript, offered again next boot)

### Changed
- Header redesigned: 13 controls in 5 zones → 8 controls in 4 floating pill clusters on a bare drag-enabled bar, restoring a continuous ≥48px window-drag surface at every width and state
- Settings, Sessions, and Session Viewer headers restyled to match the pill pattern; Session Viewer header gains drag support it never had
- Accent-filled buttons (Save & Close, Recover) switched to a darker accent fill for AA text contrast
- All keyboard-shortcut hints now display Ctrl instead of Cmd

### Fixed
- "Listening…" indicator could get stuck on screen after stopping a session before any content had been transcribed
- Header dropdown menus (mic source menu, ⋯ overflow menu) opened anchored to the window's corner instead of their trigger button
- Overflow menu could spill past the window's right edge instead of right-aligning under its trigger
- Header menus could render behind transcript content (a tied z-index between the header and transcript container)

**Status**: ✅ Stable

---

## [v0.7.0] — 2026-08-22

### Added
- Recording elapsed timer in the toolbar
- Dynamic version display in the About tab (reads the real build version instead of a hardcoded string)

### Changed
- Session viewer restructured into a single scroll region (AI summary on top, transcript below), replacing two separate scroll boxes
- Toolbar reorganized into labelled groups; export-format picker moved into Settings, transcripts-folder button moved into the Sessions view
- Window minimum width raised (400px → 600px) so the close button can no longer be clipped
- Overlay opacity slider now fades only the background layer — text stays at full WCAG AA contrast at every opacity setting (previously text faded with the background)
- Design-token layer introduced in `main.css`; keyboard focus-visible rings, disabled-state, and scrollbar styling normalized across all controls
- "Quiet Glass" visual reskin applied across the overlay

### Fixed
- `.float-btn` was 26×28 (non-square) after the reskin; now a proper 28×28 square matching `--control-h-sm`
- Dark webview base colour set opaque (previously could show a flash of the OS background)

**Status**: ✅ Stable

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

- **Document updated**: 2026-08-22
- **Maintainer**: phuc-nt
- **Version scheme**: [Semantic Versioning](https://semver.org/)
- **Release cadence**: 4-6 weeks between major versions
