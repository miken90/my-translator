# Codebase Summary

## Overview

My Translator (Windows-only) is structured as a **Tauri 2 desktop app** with a **Rust backend** (audio capture, IPC) and **ES module frontend** (WebView UI, Soniox client). No build bundler or framework used; frontend is vanilla JS + CSS. macOS support and the experimental Local Mode (MLX/Whisper Python sidecar) were removed in the meeting-focus refactor (see `plans/`).

## Directory Structure

```
my-translator/
├── src/                              # Frontend (WebView)
│   ├── index.html                   (776 LOC)  Main UI template
│   ├── styles/
│   │   └── main.css                 (1921 LOC) All CSS styles
│   └── js/
│       ├── app.js                   (1783 LOC) Main app controller
│       ├── ui.js                    (556 LOC)  TranscriptUI rendering
│       ├── soniox.js                (524 LOC)  Soniox WebSocket client
│       ├── elevenlabs-tts.js        (228 LOC)  ElevenLabs WebSocket TTS
│       ├── audio-player.js          (158 LOC)  Web Audio API playback
│       ├── settings.js              (90 LOC)   Settings IPC proxy
│       ├── google-tts.js            (138 LOC)  Google Cloud TTS REST
│       ├── web-speech-tts.js        (145 LOC)  Browser SpeechSynthesis (unused, not wired to app.js)
│       ├── edge-tts.js              (86 LOC)   Edge TTS Rust proxy
│       └── [other utilities]        (~100 LOC) Minor helpers
│
├── src-tauri/                        # Rust backend (Tauri 2)
│   ├── src/
│   │   ├── lib.rs                   Tauri builder & command router
│   │   ├── main.rs                  Entry point
│   │   ├── settings.rs              Settings struct + persistence
│   │   │
│   │   ├── audio/
│   │   │   ├── mod.rs               Module exports
│   │   │   ├── wasapi.rs            (469 LOC)  Windows WASAPI loopback
│   │   │   └── microphone.rs        (278 LOC)  Cross-platform mic (CPAL)
│   │   │
│   │   └── commands/
│   │       ├── mod.rs               Command module exports
│   │       ├── audio.rs             (166 LOC)  start/stop audio capture
│   │       ├── edge_tts.rs          (175 LOC)  Edge TTS WebSocket proxy
│   │       ├── settings.rs          (32 LOC)   get/save settings IPC
│   │       └── transcript.rs        (124 LOC)  save/list/read transcripts
│   │
│   ├── Cargo.toml                   Rust dependencies (Windows-only)
│   └── tauri.conf.json              App config (UI size, plugins)

├── scripts/
│   └── build-release.ps1            Portable release build helper
│
├── .github/workflows/
│   └── release.yml                  (269 LOC)  CI/CD: build + notarize
│
├── package.json                     npm config (Tauri CLI)
└── docs/
    ├── project-overview-pdr.md      (NEW) Project overview & PDR
    ├── codebase-summary.md          (NEW) This file
    ├── code-standards.md            (NEW) Conventions & patterns
    ├── system-architecture.md       (NEW) Architecture diagrams & flows
    ├── project-roadmap.md           (NEW) Milestones & future plans
    ├── deployment-guide.md          (NEW) Build & release process
    ├── future-plans.md              (existing) Detailed feature roadmap
    ├── installation_guide.md        (archived) legacy macOS installation
    ├── installation_guide_win.md    (existing) Windows installation
    └── [other user guides & images]
```

## Module Overview

### Frontend Modules (`src/js/`)

#### **app.js** — Main Application Controller
Wires all subsystems: settings, UI, Soniox, audio capture, TTS providers, keyboard shortcuts.

**Key classes/exports**:
- `App` — Main app class with lifecycle management
- Manages: `isRunning`, `currentSource`, `sessionStartTime`
- Exposes: `app.start()`, `app.stop()`, `app.updateSettings()`

**Dependencies**: Tauri IPC, TranscriptUI, SonioxClient, all TTS providers, audioPlayer, settingsManager

#### **ui.js** (556 LOC) — TranscriptUI Rendering
Renders transcript segments into DOM. Handles unified card layout with original + translation stacked, smart scrolling, font sizing. Uses **monotonic segment IDs** (`_nextSegId`) for reliable sessionLog matching. Translation matching uses **LIFO** (most recent pending original) instead of FIFO. 2-tier stale cleanup: mark at 10s, remove at 60s; stale cards rendered with strike-through.

**Key class**:
- `TranscriptUI(containerElement)` — Manages DOM rendering
- Methods: `addSegment(original, translation)`, `clear()`, `getPlainText()`, `getMarkdownText()`
- Handles: Auto-scroll detection, card-per-utterance layout, segment scrolling

#### **soniox.js** (524 LOC) — Soniox WebSocket Client
Real-time STT + translation WebSocket client for Soniox API.

**Key class**:
- `SonioxClient` — WebSocket manager
- Methods: `connect(token, lang1, lang2, context)`, `sendAudio(pcmBuffer)`, `disconnect()`
- Emits: `'segment'` event with `{original, translation}`
- Auto-reconnect, session reset, custom context support

#### **settings.js** (90 LOC) — Settings IPC Proxy
Manages app settings via Tauri IPC to Rust backend.

**Key export**:
- `settingsManager` — Singleton manager
- Methods: `load()`, `get()`, `save(updates)`, `reset()`
- Syncs with OS config directory via Rust

#### **google-tts.js** (138 LOC) — Google Cloud TTS REST
REST API client for Google Cloud Text-to-Speech (Chirp 3 HD).

**Key export**:
- `googleTTS` — Singleton TTS provider
- Methods: `speak(text, languageCode, voiceName, speed)` → Promise<audioBuffer>
- Returns base64 MP3 to audioPlayer

#### **elevenlabs-tts.js** (228 LOC) — ElevenLabs WebSocket TTS
WebSocket streaming client for ElevenLabs API.

**Key export**:
- `elevenLabsTTS` — Singleton TTS provider
- Methods: `speak(text, voiceId, speed)` → Promise<audioBuffer>
- Streaming for real-time TTS

#### **edge-tts.js** (86 LOC) — Edge TTS Proxy Wrapper
Calls Rust backend command `edge_tts_speak` to bypass browser CORS/header limitations.

**Key export**:
- `edgeTTSRust` — Singleton proxy
- Methods: `speak(text, voice, speed)` → invokes Tauri command

#### **audio-player.js** (158 LOC) — Web Audio API Playback
Queue-based audio playback using Web Audio API.

**Key export**:
- `audioPlayer` — Singleton player
- Methods: `enqueue(base64Mp3)`, `play()`, `stop()`, `clear()`
- Handles: Queue management, playback events

#### **web-speech-tts.js** (145 LOC) — Browser SpeechSynthesis
Browser native SpeechSynthesis API (not actively used in UI; kept for reference).

---

### Backend Modules (`src-tauri/src/`)

#### **lib.rs** — Tauri Application Entry Point
Builds Tauri app with all plugins and command handlers.

**Managed state**:
- `SettingsState(Mutex<Settings>)` — Thread-safe settings
- `AudioState` — Audio capture state (system + microphone)

**Exposed commands**: All IPC entry points to frontend

#### **settings.rs** (139 LOC) — Settings Struct & Persistence
Defines `Settings` struct (all app configuration). Implements load/save to OS config directory.

**Key struct**:
- `Settings` — 25+ fields (API keys, audio settings, TTS config, UI prefs)
- Default values: Soniox mode, system audio, 16px font, Edge TTS enabled
- Persists to: `%APPDATA%/com.personal.translator/settings.json`

#### **audio/mod.rs**
Module exports for audio submodules.

#### **audio/wasapi.rs** (469 LOC) — Windows WASAPI Loopback
Windows system audio capture using WASAPI loopback device.

**Key type**:
- `WasapiCapture` — Windows loopback manager
- Initializes COM, WASAPI client, audio engine
- Handles ALAC + legacy loopback audio format detection

#### **audio/microphone.rs** (278 LOC) — Cross-Platform Microphone
Cross-platform microphone capture using CPAL library.

**Key type**:
- `MicCapture` — Abstracts CPAL for input device selection
- Queries available input devices, selects default/preferred device
- Outputs PCM 16kHz mono

#### **commands/mod.rs** (5 LOC)
Command module exports.

#### **commands/audio.rs** (166 LOC) — Audio Capture IPC Commands
Tauri commands for starting/stopping audio capture.

**Exposed commands**:
- `start_capture(source: "system" | "microphone" | "both")` — Starts streaming audio
- `stop_capture()` — Stops audio
- `check_permissions()` — Queries microphone permission status

**Implementation**: Routes to appropriate audio module, sends PCM chunks via Tauri event. Audio batch interval: **100ms**, buffer capacity: **16KB**.

#### **commands/settings.rs** (32 LOC) — Settings IPC Commands
Tauri commands for getting/saving settings.

**Exposed commands**:
- `get_settings() -> Settings` — Returns current settings
- `save_settings(updates: Settings) -> Result<(), String>` — Persists to disk

#### **commands/edge_tts.rs** (175 LOC) — Edge TTS WebSocket Proxy
Rust-side WebSocket proxy for Edge TTS to bypass browser CORS limitations.

**Exposed command**:
- `edge_tts_speak(text, voice, speed) -> Result<base64 MP3>`
- Connects to Edge TTS, encodes audio, returns base64

#### **commands/transcript.rs** (124 LOC) — Transcript File Management
Commands for saving/reading session transcripts.

**Exposed commands**:
- `save_transcript(name, content) -> Result<FilePath>`
- `list_transcripts() -> Result<Vec<TranscriptMetadata>>`
- `read_transcript(filePath) -> Result<String>`
- `open_transcript_dir()` — Opens transcripts folder in OS file explorer

---

## Data Flow Patterns

### Audio Capture Pipeline
```
System Audio (WASAPI)
    ↓ (or Microphone via CPAL)
    ↓ [Rust audio module]
PCM 16kHz mono
    ↓ [Tauri event]
Frontend (app.js)
    ↓
SonioxClient (WebSocket)
    ↓
Soniox API
    ↓
Segments: {original, translation}
    ↓ [event emit]
TranscriptUI.addSegment()
    ↓
DOM update (card layout: original + translation stacked)
```

### Settings Flow
```
UI (settings.html form)
    ↓ [invoke settingsManager.save()]
Frontend (settings.js)
    ↓ [Tauri command: save_settings]
Rust (commands/settings.rs)
    ↓ [Settings::save()]
Disk: ~/config/settings.json
```

### TTS Pipeline (Example: Google TTS)
```
TranscriptUI emits translation text
    ↓ [app.js hooks]
googleTTS.speak(text)
    ↓ [REST API]
Google Cloud TTS
    ↓ [MP3 base64]
audioPlayer.enqueue()
    ↓ [Web Audio API]
Speaker output
```

### TTS Pipeline (Example: Edge TTS via Rust Proxy)
```
TranscriptUI emits translation text
    ↓ [app.js hooks]
edgeTTSRust.speak(text)
    ↓ [Tauri invoke: edge_tts_speak]
Rust (commands/edge_tts.rs)
    ↓ [WebSocket to Edge TTS]
Edge TTS API
    ↓ [MP3 base64 to Rust]
Return to frontend
    ↓ [audioPlayer.enqueue()]
Speaker output
```

## Code Organization Principles

1. **No framework, no bundler** — Vanilla JS ES modules; simplifies maintenance
2. **One-way IPC** — Frontend invokes commands; backend sends events
3. **Rust for system-level code** — Audio capture, process management, TTS proxy
4. **Frontend for UI & orchestration** — Soniox client, TTS routing, settings UI
5. **Settings as source of truth** — Single JSON file persisted, synced via IPC
6. **Modular TTS providers** — Pluggable interface (edge, google, elevenlabs)
7. **No global state** — Singletons used cautiously; state managed by App class

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **No framework** | Keep app lightweight; reduce dependency surface |
| **ES modules** | Native browser support; no build step needed |
| **Rust for audio** | System-level access, performance, memory safety |
| **Tauri 2** | Cross-platform desktop, smaller app size than Electron |
| **Soniox for STT** | Real-time WebSocket, reliable, supports translation |
| **Multiple TTS providers** | User choice; trade-off between cost/quality |
| **Settings as JSON** | Simple, human-readable, easy to debug |
| **Proxy for Edge TTS** | Bypass browser CORS/header limitations on Rust side |

---

**Document updated**: 2026-04-08  
**Next review**: After major refactoring or architecture changes
