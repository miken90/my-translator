# Project Overview & Product Development Requirements

**My Translator** — Real-time speech translation desktop application for Windows.

## Executive Summary

A privacy-first, real-time speech translation overlay application. Captures system audio or microphone, transcribes via cloud STT, translates instantly, and displays in a minimal always-on-top window. Optional TTS narration in 3 providers. Built with Tauri 2 for desktop distribution; supports 70+ source languages and unlimited translation pairs.

## Product Information

| | Details |
|---|---------|
| **Current Version** | v0.7.0 |
| **Release Date** | 2026-08-22 |
| **License** | MIT |
| **Author** | phuc-nt (GitHub: [phuc-nt/my-translator](https://github.com/phuc-nt/my-translator)) |
| **Platforms** | Windows (10/11) |
| **Repository** | https://github.com/phuc-nt/my-translator |

## Target Users

- **Language learners** — Real-time subtitle generation for educational videos, live streams, meetings
- **Professionals** — Business calls, presentations, document review across languages
- **Content creators** — Bilingual meetings, multilingual audience engagement
- **Accessibility users** — Live transcription for hard of hearing users
- **Power users** — Developers, researchers comfortable with API keys and CLI configuration

## Core Value Proposition

1. **Zero intermediary** — No cloud relay or central server; direct connection to transcription APIs
2. **Always-on-top overlay** — Works in any application; no window switching required
3. **Privacy-first architecture** — User-owned API keys, local transcript storage, no telemetry
4. **Low latency** — ~2–3s end-to-end transcription + translation
5. **Cost transparency** — ~$0.12/hr Soniox API cost; clear, predictable billing

## Core Features

### Audio Capture
- **System audio** (WASAPI) — capture speaker output
- **Microphone** (cross-platform CPAL) — capture input device
- **Both** — simultaneous system + mic for two-way translation in video calls

### Speech-to-Text & Translation
- **Cloud STT** — Soniox API (WebSocket-based, 70+ languages)
- **Real-time translation** — Inline within STT response
- **Custom context** — Domain-specific translation terms and context hints

### Display & UX
- **Single panel** — Translation text only (default, clean)
- **Dual panel** — Source and translation side-by-side
- **Smart scroll** — Auto-scroll at bottom; manual scroll doesn't interrupt
- **Font size control** — Adjustable up to 140px (presentations)
- **Compact mode** — Hide control bar when not in focus

### Translation Modes
- **One-way** — Source → Target language
- **Two-way** — Language A ↔ Language B with automatic speaker detection

### Text-to-Speech Narration
- **Edge TTS** (free) — Neural voices, 50+ languages
- **Google Cloud TTS** (Chirp 3 HD) — Near-human quality
- **ElevenLabs** (premium) — High-quality voices, streaming

### Session Management
- Auto-save transcripts as `.md` files locally, with crash-safe temp flush (every 20 segments + 2min timer) and orphan-transcript recovery on startup
- Session history viewer
- Copy/paste text from overlay
- Export transcripts as `.md`/`.txt` with per-entry timestamps
- AI summary persisted into the session file (regenerate replaces it); transcript Q&A over a loaded session

### Other
- Configurable keyboard shortcuts
- Always-on-top overlay with adjustable opacity
- Settings persistence in OS config directory

## Feature Support Matrix

| Feature | Windows | Notes |
|---------|---------|-------|
| System Audio | ✅ | WASAPI |
| Microphone | ✅ | CPAL library |
| Edge TTS | ✅ | Rust proxy backend |
| Google TTS | ✅ | REST API |
| ElevenLabs TTS | ✅ | WebSocket streaming |

## Privacy & Security Model

### Data Handling
- **No central server** — Application connects directly to user-configured APIs
- **User-owned credentials** — API keys stored locally in OS config directory; never transmitted except to intended API
- **Local transcript storage** — Sessions saved as `.md` files in user's config directory; never uploaded
- **No telemetry, analytics, or tracking** — Zero third-party data collection

### Security Practices
- **HTTPS/WSS only** — All API connections encrypted
- **No authentication required** — User authentication only to external APIs (Soniox, Google, ElevenLabs)
- **Transparent dependencies** — All dependencies open-source and auditable

## Supported Languages

### Speech-to-Text (Soniox)
70+ languages including: English, Mandarin, Japanese, Korean, Vietnamese, Spanish, French, German, Russian, Arabic, Hindi, Portuguese, Thai, and many more.

### Translation Targets
Unlimited target language pairs via Soniox translation engine.

### TTS Voices
- **Edge TTS**: 50+ neural voices across 40+ languages
- **Google TTS**: 375+ voices across 80+ languages (Chirp 3 HD available for premium)
- **ElevenLabs**: 100+ voices, multilingual support

## Technical Constraints

| Constraint | Impact | Workaround |
|-----------|--------|-----------|
| Latency (~2-3s) | Not suitable for live conversation | Accept as trade-off for accuracy |
| Soniox API rate limits | Burst audio causes queue | Buffer and stream continuously |
| WASAPI Windows loopback | Some apps don't route to loopback | Use "Both" mode (system + mic) or HDMI loopback |
| Browser audio limitations | TTS in two-way mode causes feedback | Disable TTS in two-way mode automatically |

## Success Metrics

- **Adoption**: 1,000+ active users (GitHub stars proxy: 600+)
- **Accuracy**: <2% transcription error rate (Soniox baseline)
- **Latency**: 2-3s end-to-end (acceptable for non-conversation use)
- **Stability**: 99% uptime for Tauri app; API outages not app responsibility
- **User retention**: 60%+ monthly active return users
- **Community**: Active GitHub issues resolved within 1 week

## Acceptance Criteria

✅ Application builds cleanly on Windows
✅ Audio capture (system + mic) functional
✅ Soniox STT + translation working end-to-end
✅ UI renders transcripts with proper scrolling and font sizing
✅ TTS plays audio without crashes
✅ Settings persist across sessions
✅ Installation guide complete for Windows
✅ No API keys or secrets in source code

## Non-Functional Requirements

| Aspect | Requirement | Rationale |
|--------|-------------|-----------|
| **Performance** | Audio capture latency <100ms, UI render <50ms | Ensures responsive overlay |
| **Memory** | <200MB baseline, <500MB under heavy use | Keep app lightweight |
| **CPU** | <5% CPU during idle capture | Battery-friendly on laptops |
| **Networking** | Auto-reconnect on connection loss | Resilient to network interruptions |
| **Accessibility** | High contrast support, keyboard navigation | Inclusive for all users |
| **Portability** | Self-contained installer, no system dependencies | Easy distribution and updates |

## Release Strategy

- **Versioning**: Semantic versioning (major.minor.patch)
- **Release cycle**: 4-6 week sprints, monthly releases
- **Beta testing**: GitHub releases with pre-release tags
- **Distribution**: GitHub releases page (portable .exe, manual download)

## Roadmap Overview

See `project-roadmap.md` for detailed milestones and future features.

**Current focus** (v0.5.x):
- Windows-only cleanup, test safety net, and Rust/frontend refactor — done
- Stabilize long meeting sessions (crash-safe transcript logging) — done
- Durable session log + persisted AI summary + export + transcript Q&A — done

**Near-term** (v0.6.x):
- Export transcripts as SRT (current export covers `.md`/`.txt` only)
- Custom keyboard shortcut configuration

## Dependencies & Integrations

### External APIs (User-Configured)
- **Soniox** — Primary STT + translation (cloud)
- **Google Cloud TTS** — Text-to-speech (premium quality)
- **ElevenLabs** — TTS (premium voices)
- **Edge TTS** (free) — TTS (no API key required)

### Technology Stack
- **Tauri 2** — Desktop framework
- **Rust** — Backend for audio capture and API proxies
- **ES modules (Vanilla JS)** — Frontend (no framework, no build step)
- **CPAL** — Cross-platform microphone capture
- **GitHub Actions** — CI/CD for Windows release builds

## Version History

| Version | Date | Highlights |
|---------|------|-----------|
| 0.7.0 | 2026-08-22 | UI/UX overhaul (single-scroll session viewer, toolbar regroup), Quiet Glass reskin |
| 0.5.1 | 2026-04-06 | Improved TTS error handling, session history viewer |
| 0.5.0 | 2026-03-15 | Two-way translation, auto-save transcripts |
| 0.4.0 | 2026-02-20 | Local MLX mode experimental, ElevenLabs TTS |
| 0.3.0 | 2026-01-10 | Google Cloud TTS, dual panel view |
| 0.1.0 | 2025-11-01 | Initial release (single-panel, Edge TTS) |

---

**Document updated**: 2026-08-22  
**Next review**: 2026-09-22 (post-v0.7.0 release)
