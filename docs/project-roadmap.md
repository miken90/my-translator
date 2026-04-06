# Project Roadmap

## Current Status

| Metric | Value |
|--------|-------|
| **Latest Version** | v0.5.1 (stable) |
| **Release Date** | 2026-04-06 |
| **GitHub Stars** | 600+ |
| **Active Users** | ~1,000+ monthly |
| **Platforms** | macOS (ARM+Intel), Windows |
| **Project Stage** | Mature (1+ years active) |

## Version History & Milestones

### v0.1.0 (2025-11-01) — Foundation
**Focus**: Real-time speech translation MVP  
**Features**:
- System audio + microphone capture (macOS, Windows)
- Soniox STT + translation integration
- Single-panel overlay UI
- Edge TTS narration (free)
- Basic settings panel

**Status**: ✅ Complete

---

### v0.2.0 (2025-12-15) — Polish & Stability
**Focus**: UX refinement, error handling  
**Features**:
- Smart scroll (stay at bottom by default, allow manual scroll)
- Font size adjustment (A-, A+)
- Settings persistence via Tauri
- Keyboard shortcuts (Cmd+T for TTS toggle, Cmd+L for language, etc.)
- Session-based transcript saving (local `.md` files)
- Auto-updater integration (GitHub releases)

**Status**: ✅ Complete

---

### v0.3.0 (2026-01-10) — TTS Expansion
**Focus**: Premium TTS providers, accessibility  
**Features**:
- Google Cloud TTS integration (Chirp 3 HD, near-human quality)
- Dual-panel view (original | translation side-by-side)
- Custom translation terms (domain-specific hints for Soniox)
- Settings sync across sessions
- Microphone permission checks (macOS, Windows)

**Status**: ✅ Complete

---

### v0.4.0 (2026-02-20) — Local & Advanced
**Focus**: Offline capability, multilingual support  
**Features**:
- ElevenLabs TTS provider (WebSocket streaming, premium voices)
- Local MLX + Whisper + Qwen2.5 pipeline (experimental, Apple Silicon only)
- Python sidecar model setup (`setup_mlx.py`, `local_pipeline.py`)
- Custom context domain hints
- Session history viewer
- Keyboard shortcut customization (prep work)

**Status**: ✅ Complete

---

### v0.5.0 (2026-03-15) — Two-Way Translation
**Focus**: Bilingual meeting support  
**Features**:
- Two-way translation mode (Language A ↔ Language B with auto-detection)
- "Both" audio source (simultaneous system + mic for video calls)
- Auto-disable TTS in two-way mode (prevents feedback loops)
- Session mode tracking (one_way vs two_way)
- Improved error messages for Soniox failures

**Status**: ✅ Complete

---

### v0.5.1 (2026-04-06) — Stability & Documentation
**Focus**: Bug fixes, better error handling, comprehensive docs  
**Features**:
- Improved Google TTS blocked API error message with actionable guidance
- Session history viewer UI enhancements
- Unified card layout (original + translation stacked, removed single/dual view modes)
- Lowered default Soniox endpoint delay (3000ms → 1500ms) for faster perceived translation
- One-time migration for existing users (endpoint_delay auto-updated to 1500 if saved as 3000)
- Comprehensive project documentation (PDR, architecture, code standards, roadmap)
- Bug fixes for audio capture edge cases
- Minor UI polish

**Status**: ✅ Complete (current version)

---

## Near-Term Roadmap (v0.6.x — Next 4-6 Weeks)

### v0.6.0 (Target: May 2026) — Export & AI Features

#### Priority P1: Export Transcripts
- **Export formats**: `.txt`, `.srt`, `.vtt`, `.md`
- **UI**: "Copy All" button, "Export" dropdown with format selection
- **Scope**: Current session transcripts only
- **Effort**: ~0.5-1 day
- **Value**: High — users frequently request ability to share/reuse transcripts

#### Priority P1: Audio Normalization
- **Problem**: Low-volume audio sources produce poor STT quality
- **Solution**: RMS-based gain normalization in Rust (PCM preprocessing)
- **UI**: Optional "Input Sensitivity" slider in Settings
- **Effort**: ~1 day
- **Value**: High — fixes pain point for video call setups with low volume

#### Priority P2: AI Summarize & Q&A (Experimental)
- **Features**:
  - Post-session "Review" panel
  - Summarize transcript (via Gemini/Claude API)
  - Q&A mode (user asks questions, LLM answers from transcript context)
  - Export with summary
- **Scope**: Optional, behind feature flag initially
- **Effort**: ~2-3 days
- **Value**: Medium-High — useful for learning/meeting notes
- **Dependencies**: Requires Export Transcripts (P1) to function

---

## Medium-Term Roadmap (v0.7.x - v0.9.x — 3-6 Months)

### v0.7.0 — File Upload Mode
- **Problem**: Users want to translate offline content (videos, recorded audio)
- **Solution**: File picker → audio extraction → chunked Soniox processing → subtitle export
- **UI**: New tab "File" (alongside "System", "Microphone")
- **Output**: `.srt` / `.vtt` subtitle files + optional TTS narration
- **Platforms**: macOS + Windows
- **Effort**: ~5-7 days (audio extraction is complex)
- **Value**: Very high — expands use cases (video tutorial translation, podcast subtitles)
- **Technical challenges**:
  - Audio extraction (requires ffmpeg integration or macOS AVFoundation FFI)
  - Lazy processing to avoid processing entire file upfront
  - Progress UI for long files

### v0.8.0 — Screen OCR Translation
- **Problem**: Users want to translate on-screen text (subtitles, PDFs, images)
- **Solution**: Region selection → OCR (macOS Vision) → translation (Gemini/Claude)
- **UI**: Crosshair cursor, select region, overlay with result + copy button
- **Scope**: macOS first; Windows Vision API support considered later
- **Effort**: ~7-10 days (OCR framework integration, UX redesign)
- **Value**: High — opens new use case (reading foreign language content)
- **Technical challenges**:
  - macOS Vision framework requires Objective-C FFI in Rust
  - Region selection UI + realtime visual feedback
  - Separate translation provider (Soniox doesn't accept text)

### v0.9.0 — Furigana Support
- **Problem**: Japanese learners want phonetic guides (furigana) above kanji
- **Solution**: `<ruby>` HTML + `kuroshiro` JS library
- **Scope**: Applies to Japanese source text only
- **UI**: Toggle in Settings (default: off)
- **Effort**: ~1 day
- **Value**: Medium (niche, but valuable for learner segment)

---

## Long-Term Vision (v1.0+)

### v1.0.0 — Stable Flagship Release
**Focus**: Feature-complete for core use cases

**Expected features**:
- ✅ Real-time two-way translation (system + mic)
- ✅ Export transcripts (multiple formats)
- ✅ TTS narration (3 providers)
- ✅ Local offline mode (Apple Silicon)
- ✅ Session management & history
- ✅ File upload translation
- ✅ Screen OCR translation
- ✅ Comprehensive documentation

**Milestone**: Estimated Q3 2026

### Post-v1.0: Advanced Features
- **Plugin system** — Allow community TTS providers, STT backends
- **Electron version** — Alternative to Tauri for users on older OS versions
- **Browser extension** — Inline translation on web pages
- **Mobile companion** — iPhone/Android app for remote viewing (sync with desktop)
- **Collaborative translation** — Share live transcripts with others (requires server)

---

## Completed Features (Status: ✅)

| Feature | Version | Status |
|---------|---------|--------|
| Real-time STT + translation | v0.1 | ✅ Stable |
| System audio capture (macOS) | v0.1 | ✅ Stable |
| System audio capture (Windows) | v0.1 | ✅ Stable |
| Microphone capture (cross-platform) | v0.1 | ✅ Stable |
| Edge TTS (free) | v0.1 | ✅ Stable |
| Overlay UI (always-on-top) | v0.1 | ✅ Stable |
| Single-panel view | v0.1 | ✅ Stable |
| Dual-panel view | v0.3 | ✅ Removed in v0.5.1 (replaced with unified card layout) |
| Smart scroll (auto-bottom) | v0.2 | ✅ Stable |
| Font size control | v0.2 | ✅ Stable |
| Session transcripts (local `.md`) | v0.2 | ✅ Stable |
| Auto-updater | v0.2 | ✅ Stable |
| Settings persistence | v0.2 | ✅ Stable |
| Keyboard shortcuts | v0.2 | ✅ Stable |
| Google Cloud TTS (Chirp 3 HD) | v0.3 | ✅ Stable |
| Custom translation terms | v0.3 | ✅ Stable |
| ElevenLabs TTS | v0.4 | ✅ Stable |
| Local MLX pipeline (Apple Silicon) | v0.4 | ✅ Experimental |
| Session history viewer | v0.4 | ✅ Stable |
| Two-way translation | v0.5 | ✅ Stable |
| Audio source: Both (system + mic) | v0.5 | ✅ Stable |
| Unified card layout (stacked original+translation) | v0.5.1 | ✅ Stable |
| Fast endpoint delay (1500ms default) | v0.5.1 | ✅ Stable |
| Comprehensive documentation | v0.5.1 | ✅ Complete |

---

## Planned Features (Status: 🔄 In Backlog)

| Feature | Priority | Target Version | Effort | Status |
|---------|----------|-----------------|--------|--------|
| Export transcripts (SRT/VTT/TXT) | P1 | v0.6 | 0.5d | 🔄 Backlog |
| Audio normalization | P1 | v0.6 | 1d | 🔄 Backlog |
| AI summarize & Q&A | P2 | v0.6 | 2-3d | 🔄 Backlog |
| File upload mode | P3 | v0.7 | 5-7d | 🔄 Backlog |
| Screen OCR translation | P4 | v0.8 | 7-10d | 🔄 Backlog |
| Furigana (Japanese) | P3 | v0.9 | 1d | 🔄 Backlog |
| Plugin system | Future | v1.1+ | TBD | 🔄 Research |
| Mobile companion app | Future | v1.2+ | TBD | 🔄 Research |
| Collaborative translation | Future | v1.2+ | TBD | 🔄 Research |

---

## Known Issues & Limitations

### Current Issues

| Issue | Severity | Workaround | Target Fix |
|-------|----------|-----------|-----------|
| WASAPI loopback unavailable on some Windows setups | High | Use "Both" mode (system+mic) or setup virtual audio device | v0.6 |
| Google TTS rate limit (1M chars/month free tier) | Medium | Switch to Edge TTS (free, unlimited) | Document clearly in TTS guide |
| Two-way translation auto-detect accuracy | Medium | Manual language selection available | v0.7 (ML-based detection) |
| Local MLX model size (~10GB) | Medium | Documented in setup; optional feature | v1.0 (compress models) |
| Browser CSP prevents direct WebSocket for TTS | Low | Use Rust proxy (implemented) | No change needed |

### Platform-Specific Limitations

| Platform | Limitation | Reason | Workaround |
|----------|-----------|--------|-----------|
| **macOS <13.0** | ScreenCaptureKit requires 13.0+ | OS-level API requirement | Update macOS or use Mic only |
| **Windows ARM** | WASAPI limited on ARM64 | Limited testing/hardware | Use Mic capture |
| **Linux** | Not supported | No resources for Linux support | Consider in v2.0+ |
| **Apple Silicon (non-M1)** | Local MLX on M2/M3 untested | Limited testing | Report issues, we'll fix |

---

## Success Metrics (2026)

| Metric | Current | Target (EOY) |
|--------|---------|--------------|
| GitHub stars | 600+ | 1,500+ |
| Monthly active users | ~1,000 | 5,000+ |
| Supported languages (STT) | 70+ | 80+ (via Soniox) |
| TTS providers | 3 | 5+ (including plugin system) |
| Platform coverage | macOS, Windows | macOS, Windows, Linux (beta) |
| Documentation coverage | 90% | 95%+ |
| Issue resolution time | <1 week | <3 days |
| User satisfaction (GitHub) | 4.5/5 | 4.7/5 |

---

## Release Schedule

| Version | Target Date | Focus |
|---------|-------------|-------|
| v0.6.0 | May 2026 | Export + Audio normalization |
| v0.7.0 | June 2026 | File upload mode |
| v0.8.0 | August 2026 | Screen OCR translation |
| v0.9.0 | September 2026 | Polish & final v1.0 prep |
| v1.0.0 | October 2026 | Stable flagship release |

---

## Feedback & Community Input

### User Requests (GitHub Issues, Comments)
- **Export transcripts** — Hùng Vũ, Nguyễn Thanh Long (implemented in v0.6 plan)
- **File upload mode** — Nguyễn Đức, Lâm Ngọc (in v0.7 plan)
- **Screen OCR** — Hùng Vũ (in v0.8 plan)
- **Audio normalization** — Hoang Anh (in v0.6 plan)
- **Furigana** — Nhat Pham (in v0.9 plan)
- **AI summarization** — Nguyễn Thanh Long (in v0.6 plan)

### Process
- Community feedback shapes roadmap priorities
- Feature requests evaluated on: user demand, implementation effort, strategic fit
- Monthly community sync (future consideration)

---

## Decision Log

### Why No Linux Support in v1.0?
- Limited user base on Linux (audio drivers highly varied)
- Audio capture requires platform-specific implementation (PulseAudio/ALSA/PipeWire)
- Maintainability cost high for small team
- Decision: Defer to v2.0; accept contributions if available

### Why ElevenLabs TTS?
- Premium quality voices for professionals/content creators
- WebSocket streaming for real-time TTS
- Alternative to expensive Google Cloud TTS
- User requests for higher quality TTS

### Why MLX (Not Ollama/LLaMA)?
- MLX optimized for Apple Silicon (native performance)
- Lighter than Ollama for local deployment
- Whisper + Qwen2.5 provide good translation accuracy
- Easier model distribution than full LLaMA setup

### Why Tauri (Not Electron)?
- ~10x smaller app size (50MB vs 200MB+)
- Lower memory footprint (Rust vs Node.js)
- Faster startup time
- Better performance for audio-heavy workloads

---

## Governance & Maintenance

**Author/Lead**: phuc-nt (@phuc-nt on GitHub)  
**Current Maintainers**: phuc-nt, community contributors  
**Issue Triage**: Weekly  
**Release Cycle**: 4-6 weeks between major versions  
**Long-term Support**: At least 2 years from v1.0 (through 2028)

---

**Document updated**: 2026-04-06  
**Next review**: 2026-05-04 (post-v0.6.0 release planning)  
**Community feedback**: GitHub issues, star trends, download stats tracked monthly
