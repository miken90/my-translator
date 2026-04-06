# System Architecture

## High-Level Overview

My Translator is a **Tauri 2 desktop application** combining a **Rust backend** (system-level operations) with a **WebView frontend** (UI, orchestration). The architecture prioritizes privacy (direct API connections), modularity (pluggable TTS providers), and resilience (auto-reconnect, error recovery).

```
┌────────────────────────────────────────────────────────────────┐
│ My Translator Desktop App (Tauri 2)                            │
├──────────────────────────┬──────────────────────────────────────┤
│                          │                                      │
│  Rust Backend            │  WebView Frontend (ES Modules)      │
│  (src-tauri/src/)        │  (src/js/ + HTML/CSS)               │
│                          │                                      │
│ ┌──────────────────────┐ │ ┌────────────────────────────────┐  │
│ │ Audio Capture        │ │ │ App.js (Main Controller)      │  │
│ │ ├─ ScreenCaptureKit  │ │ │ ├─ UI wiring                 │  │
│ │ │  (macOS)           │◄├─┤ ├─ Settings management        │  │
│ │ ├─ WASAPI (Windows)  │ │ │ ├─ Keyboard shortcuts        │  │
│ │ └─ CPAL (Microphone) │ │ │ ├─ State management           │  │
│ └──────────────────────┘ │ └────────────────────────────────┘  │
│         │                │           │                          │
│ ┌──────▼──────────────┐ │ ┌────────▼────────────────────────┐ │
│ │ Commands (Tauri     │ │ │ SonioxClient (WebSocket)        │ │
│ │ IPC Handlers)       │◄├─┤ ├─ STT + Translation            │ │
│ │ ├─ audio.rs         │ │ │ ├─ Auto-reconnect              │ │
│ │ ├─ settings.rs      │ │ │ ├─ Session reset               │ │
│ │ ├─ transcript.rs    │ │ │ └─ Context carryover           │ │
│ │ ├─ edge_tts.rs      │ │ └────────────────────────────────┘  │
│ │ └─ local_pipeline   │ │           │                          │
│ │                      │ │ ┌────────▼────────────────────────┐ │
│ └──────────────────────┘ │ │ TranscriptUI (Rendering)       │ │
│         ▲                │ │ ├─ Single/dual panel views     │ │
│         │                │ │ ├─ Smart scroll               │ │
│ ┌──────┴──────────────┐ │ │ └─ Font sizing                │ │
│ │ Settings            │ │ └────────────────────────────────┘  │
│ │ (Mutex<Settings>)   │ │           │                          │
│ │ Persisted to disk   │ │ ┌────────▼────────────────────────┐ │
│ └─────────────────────┘ │ │ TTS Providers (Pluggable)      │ │
│                          │ │ ├─ EdgeTTSRust (free)          │ │
│                          │ │ ├─ GoogleTTS (premium)         │ │
│                          │ │ ├─ ElevenLabsTTS (premium)     │ │
│                          │ │ └─ WebSpeechTTS (browser)      │ │
│                          │ └────────────────────────────────┘  │
│                          │           │                          │
│                          │ ┌────────▼────────────────────────┐ │
│                          │ │ AudioPlayer (Web Audio API)    │ │
│                          │ │ ├─ Queue-based playback        │ │
│                          │ │ └─ Playback events             │ │
│                          │ └────────────────────────────────┘  │
└────────────────────────────┴──────────────────────────────────┘
          │
          │ IPC (Tauri Commands)
          │
┌─────────▼──────────────────────────────────────────────────────┐
│ External APIs (User-Configured)                                │
├──────────────────────────────────────────────────────────────┐ │
│ Soniox        │ Google Cloud │ ElevenLabs │ Edge TTS │ AI    │ │
│ (STT+Trans)   │ TTS          │ (Premium)  │ (Free)  │ Chat  │ │
└──────────────┬┴──────────────┴────────────┴────────┴────────┘ │
               │
               ├─ WebSocket (Soniox STT, ElevenLabs TTS)
               ├─ REST (Google TTS)
               ├─ WebSocket (Edge TTS via Rust proxy)
               └─ REST (OpenAI-compatible AI chat for summaries)
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Audio Capture Pipeline

Captures PCM audio from system or microphone, streams to frontend.

#### macOS (ScreenCaptureKit + CPAL)

```
┌─────────────────────────────────────┐
│ ScreenCaptureKit Stream             │
│ (System audio output)               │
│ macOS 13.0+, private API            │
└──────────────┬──────────────────────┘
               │
        ┌──────▼───────┐
        │ System Audio  │
        │ Capture       │
        │ (system_audio │
        │ .rs)          │
        └──────┬────────┘
               │
        ┌──────▼─────────────┐
        │ PCM 16kHz Mono     │
        │ (Raw samples)      │
        └──────┬─────────────┘
               │
        ┌──────▼──────────────────┐
        │ Microphone (CPAL)       │
        │ Input device selection  │
        └──────┬──────────────────┘
               │
        ┌──────▼──────────────────┐
        │ Tauri Event             │
        │ (audio-chunk)           │
        │ ~100ms chunks           │
        └──────┬──────────────────┘
               │
        ┌──────▼──────────────────┐
        │ Frontend (app.js)       │
        │ Receives audio chunks   │
        └─────────────────────────┘
```

**Key modules**:
- `audio/system_audio.rs` — macOS ScreenCaptureKit wrapper
- `audio/microphone.rs` — CPAL microphone init and stream
- `commands/audio.rs` — Tauri IPC interface

#### Windows (WASAPI Loopback + CPAL)

```
┌─────────────────────────────────────┐
│ WASAPI Loopback Device              │
│ (Virtual audio output capture)      │
│ Windows 10/11                       │
└──────────────┬──────────────────────┘
               │
        ┌──────▼──────────────┐
        │ WasapiCapture       │
        │ ├─ COM init         │
        │ ├─ Device enum      │
        │ ├─ Audio engine     │
        │ └─ Format detection │
        └──────┬──────────────┘
               │
        ┌──────▼──────────────────────┐
        │ ALAC / Legacy Format        │
        │ → PCM 16kHz Mono conversion │
        └──────┬───────────────────────┘
               │
        ┌──────▼──────────────────┐
        │ Microphone (CPAL)       │
        │ (simultaneous if needed)│
        └──────┬──────────────────┘
               │
        ┌──────▼──────────────────┐
        │ Tauri Event             │
        │ ~100ms chunks           │
        └──────┬──────────────────┘
               │
        ┌──────▼──────────────────┐
        │ Frontend (app.js)       │
        └─────────────────────────┘
```

**Key modules**:
- `audio/wasapi.rs` — Windows WASAPI loopback wrapper
- `audio/microphone.rs` — CPAL microphone init

---

### 2. Speech-to-Text & Translation Pipeline

#### Cloud Path (Default: Soniox API)

```
┌──────────────────────────┐
│ PCM 16kHz Audio Chunks   │
│ (from audio capture)     │
└───────────┬──────────────┘
            │
     ┌──────▼──────────────┐
     │ SonioxClient        │
     │ WebSocket Manager   │
     │ (soniox.js)         │
     │ ├─ Connect          │
     │ ├─ Authenticate     │
     │ ├─ Send audio stream│
     │ └─ Receive segments │
     └──────┬──────────────┘
            │
     ┌──────▼────────────────────────┐
     │ Soniox API                     │
     │ (Cloud STT + Translation)      │
     │ wss://transcriber.soniox.com   │
     │ 70+ languages, real-time       │
     └──────┬────────────────────────┘
            │
     ┌──────▼────────────────────────┐
     │ Segments: {                    │
     │   "original": "Ohayo",         │
     │   "translation": "Good morning"│
     │ }                              │
     └──────┬────────────────────────┘
            │
     ┌──────▼──────────────────┐
     │ TranscriptUI.addSegment │
     │ Render to UI            │
     └─────────────────────────┘
```

**Configuration**:
- Source language: "auto" or ISO 639-1 code
- Target language: ISO 639-1 code (e.g., "vi", "en", "ja")
- Custom context: Optional domain terms and hints
- Session ID: Unique per capture session

#### Local Path (Experimental: Apple Silicon Only)

```
┌──────────────────────────┐
│ PCM 16kHz Audio Chunks   │
└───────────┬──────────────┘
            │
     ┌──────▼──────────────────────┐
     │ LocalPipelineState           │
     │ (spawn Python sidecar)       │
     │ local_pipeline.rs            │
     └──────┬───────────────────────┘
            │
     ┌──────▼──────────────────┐
     │ Python Sidecar Process  │
     │ local_pipeline.py        │
     │ ├─ Whisper ASR          │
     │ ├─ Qwen2.5 LLM          │
     │ └─ MLX runtime          │
     └──────┬──────────────────┘
            │
     ┌──────▼────────────────────┐
     │ JSON stdout:              │
     │ {                          │
     │   "original": "...",      │
     │   "translation": "..."    │
     │ }                          │
     └──────┬────────────────────┘
            │
     ┌──────▼──────────────────┐
     │ TranscriptUI.addSegment │
     └─────────────────────────┘
```

**Requirements**:
- Apple Silicon (M1+) only
- MLX models downloaded (~10GB)
- 8GB+ RAM, ~5% CPU overhead
- Languages: JA/EN/ZH/KO → VI/EN

**Setup**:
- `setup_mlx.py` downloads models on first activation
- `local_pipeline.py` spawned as subprocess
- JSON stdin/stdout communication

---

### 3. Text-to-Speech Pipeline

#### Provider Selection

```
Settings (tts_provider)
    │
    ├─ "edge" ────┐
    │             │
    ├─ "google" ──┼──────┐
    │             │      │
    └─ "elevenlabs"┘      │
                          │
            ┌─────────────▼─────────────┐
            │ app.js selects provider   │
            └──────┬────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    │              │              │
```

#### Edge TTS Path (Rust Proxy)

```
┌─────────────────────────┐
│ Translation Text        │
│ (from TranscriptUI)     │
└──────────┬──────────────┘
           │
    ┌──────▼──────────────┐
    │ app.js hook         │
    │ edgeTTSRust.speak() │
    └──────┬──────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │ Tauri Command: edge_tts_speak       │
    │ ├─ text                             │
    │ ├─ voice (e.g., "vi-VN-HoaiMyNeural")│
    │ └─ speed (1-200%)                   │
    └──────┬───────────────────────────────┘
           │
    ┌──────▼──────────────┐
    │ Rust: edge_tts.rs   │
    │ ├─ WebSocket init   │
    │ ├─ Auth handshake   │
    │ ├─ Send text        │
    │ └─ Receive MP3      │
    └──────┬──────────────┘
           │
    ┌──────▼──────────────────────┐
    │ Edge TTS API (free)         │
    │ wss://tts.api.edge.cognitive│
    │ .microsoft.com              │
    └──────┬───────────────────────┘
           │
    ┌──────▼──────────────┐
    │ MP3 Audio (base64)  │
    │ → Return to frontend│
    └──────┬──────────────┘
           │
    ┌──────▼──────────────┐
    │ audioPlayer.enqueue │
    │ → play()            │
    └─────────────────────┘
```

**Why Rust proxy?**
- Browser CSP restrictions prevent direct WebSocket calls
- Rust proxy handles authentication headers
- Bypasses CORS limitations

#### Google Cloud TTS Path (REST)

```
┌─────────────────────────┐
│ Translation Text        │
└──────────┬──────────────┘
           │
    ┌──────▼──────────────┐
    │ app.js              │
    │ googleTTS.speak()   │
    └──────┬──────────────┘
           │
    ┌──────▼────────────────────────┐
    │ REST POST                      │
    │ POST /v1/text:synthesize       │
    │ Authorization: API key         │
    │ {                              │
    │   "input": {"text": "..."},    │
    │   "voice": {...},              │
    │   "audioConfig": {...}         │
    │ }                              │
    └──────┬────────────────────────┘
           │
    ┌──────▼────────────────────────┐
    │ Google Cloud TTS API           │
    │ https://texttospeech.google    │
    │ apis.com/...                   │
    └──────┬────────────────────────┘
           │
    ┌──────▼──────────────┐
    │ MP3 Audio (base64)  │
    └──────┬──────────────┘
           │
    ┌──────▼──────────────┐
    │ audioPlayer.enqueue │
    └─────────────────────┘
```

#### ElevenLabs TTS Path (WebSocket Streaming)

```
┌─────────────────────────┐
│ Translation Text        │
└──────────┬──────────────┘
           │
    ┌──────▼───────────────────┐
    │ app.js                    │
    │ elevenLabsTTS.speak()     │
    └──────┬────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ WebSocket Connect           │
    │ wss://api.elevenlabs.io/... │
    │ API key in headers          │
    └──────┬───────────────────────┘
           │
    ┌──────▼──────────────────┐
    │ Stream audio chunks     │
    │ as WebSocket messages   │
    └──────┬──────────────────┘
           │
    ┌──────▼──────────────────┐
    │ MP3 chunks (streaming)  │
    └──────┬──────────────────┘
           │
    ┌──────▼──────────────────┐
    │ audioPlayer.enqueue     │
    │ play continuously       │
    └─────────────────────────┘
```

---

### 4. IPC Communication (Tauri)

All communication between frontend and backend uses Tauri IPC.

#### Command Types

| Direction | Type | Example | Serialization |
|-----------|------|---------|----------------|
| Frontend → Backend | `invoke()` | `invoke('start_capture', {source: 'system'})` | JSON |
| Backend → Frontend | Event emit | `emit('audio-chunk', pcmBuffer)` | Binary or JSON |
| Frontend → Backend | Settings | `invoke('save_settings', {settings: {...}})` | JSON |

#### Command Handlers (Rust)

All commands are registered in `lib.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    commands::settings::get_settings,
    commands::settings::save_settings,
    commands::audio::start_capture,
    commands::audio::stop_capture,
    commands::audio::check_permissions,
    commands::transcript::save_transcript,
    commands::transcript::list_transcripts,
    commands::transcript::read_transcript,
    commands::edge_tts::edge_tts_speak,
    commands::local_pipeline::start_local_pipeline,
    commands::local_pipeline::send_audio_to_pipeline,
    commands::local_pipeline::stop_local_pipeline,
])
```

#### Events (Rust → Frontend)

Tauri events emit data from backend to frontend (one-way):

```rust
// Rust: Emit audio chunk
app.emit("audio-chunk", pcm_buffer)?;

// Frontend: Listen
listen('audio-chunk', (event) => {
    const buffer = event.payload;
    sonioxClient.sendAudio(buffer);
});
```

---

### 5. Settings Persistence

Settings are the single source of truth for app configuration.

#### Storage Location

```
macOS:
~/Library/Application Support/com.personal.translator/settings.json

Windows:
%APPDATA%\com.personal.translator\settings.json

Linux:
~/.config/com.personal.translator/settings.json
```

#### Settings Sync Flow

```
┌──────────────────────────┐
│ Startup                  │
└──────────┬───────────────┘
           │
    ┌──────▼───────────────────────┐
    │ Rust: Settings::load()        │
    │ ├─ Read from disk             │
    │ └─ Return defaults if missing │
    └──────┬────────────────────────┘
           │
    ┌──────▼─────────────────────┐
    │ Tauri state: SettingsState  │
    │ (Mutex<Settings>)           │
    │ ├─ Thread-safe             │
    │ └─ Accessible via IPC      │
    └──────┬────────────────────┘
           │
    ┌──────▼────────────────────────┐
    │ Frontend: settingsManager.load│
    │ invoke('get_settings')         │
    └──────┬──────────────────────────┘
           │
    ┌──────▼────────────────┐
    │ App.js cache          │
    │ this.settings = {...} │
    └──────┬─────────────────┘
           │
    ┌──────▼────────────────────────────┐
    │ User changes setting (UI)         │
    └──────┬─────────────────────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │ settingsManager.save({key: value})  │
    │ invoke('save_settings', {...})      │
    └──────┬───────────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ Rust: save_settings command     │
    │ ├─ Update state Mutex           │
    │ └─ Settings::save() to disk     │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────┐
    │ On-disk JSON updated    │
    │ (persisted for next run)│
    └─────────────────────────┘
```

#### Settings Fields

| Category | Fields |
|----------|--------|
| **STT** | `soniox_api_key`, `source_language`, `target_language`, `translation_mode` |
| **Audio** | `audio_source`, `microphone_device_id` |
| **UI** | `overlay_opacity`, `font_size`, `max_lines`, `show_original` |
| **TTS** | `tts_enabled`, `tts_provider`, `tts_voice_id`, `tts_speed`, `tts_auto_read` |
| **TTS (Google)** | `google_tts_api_key`, `google_tts_voice`, `google_tts_speed` |
| **TTS (ElevenLabs)** | `elevenlabs_api_key` |
| **TTS (Edge)** | `edge_tts_voice`, `edge_tts_speed` |
| **AI** | `ai_endpoint`, `ai_api_key`, `ai_model` |
| **Custom Context** | `custom_context` (domain hints, translation terms) |

---

### 6. Auto-Update Flow

Tauri updater plugin manages version checking and installation.

```
┌──────────────────────────────┐
│ App Startup (or manual check)│
└──────────┬───────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ updater.check()                  │
    │ → Tauri updater plugin           │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ Fetch from GitHub release       │
    │ GET latest.json endpoint         │
    │ https://github.com/.../latest.json│
    └──────┬───────────────────────────┘
           │
    ┌──────┴─────────────────────────┐
    │ No update available             │
    │ ✓ User on latest version        │
    └─────────────────────────────────┘
           OR
    ┌──────▼──────────────────────────┐
    │ Update available                │
    │ ├─ Version: v0.5.2              │
    │ └─ Download URL + signature     │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ Show notification to user       │
    │ "New version available"         │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ User accepts update             │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ Download + verify signature     │
    │ ├─ Integrity check              │
    │ └─ Signature validation         │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ Install on next restart         │
    │ └─ Replace app binaries         │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ Restart app                     │
    │ ✓ New version running           │
    └─────────────────────────────────┘
```

**Configuration**:
- `tauri.conf.json` specifies public key and update endpoint
- GitHub releases checked via `latest.json` endpoint
- Signature verification ensures integrity

---

## Data Flow Diagram (End-to-End)

```
User speaks → System Audio → Audio Capture (Rust)
                                    ↓
                            PCM 16kHz chunks
                                    ↓
                        Tauri event → Frontend
                                    ↓
                        SonioxClient.sendAudio()
                                    ↓
                        Soniox API (WebSocket)
                                    ↓
                        Segments {original, translation}
                                    ↓
                        TranscriptUI.addSegment()
                                    ↓
                        DOM render (on-screen)
                                    ↓
                        TTS provider.speak(translation)
                                    ↓
                        Audio playback (Web Audio API)
                                    ↓
                        Speaker output
```

---

## Error Handling & Resilience

### Audio Capture Failures

| Scenario | Behavior |
|----------|----------|
| Microphone not connected | Show error, fall back to system audio |
| WASAPI loopback unavailable | Prompt for virtual audio device setup |
| Permission denied | Redirect to OS settings |
| Stream interrupted | Auto-reconnect with backoff |

### Soniox Failures

| Scenario | Behavior |
|----------|----------|
| Connection timeout | Retry with exponential backoff (1s, 2s, 4s, 8s) |
| Authentication failure | Show error, prompt for valid API key |
| Rate limit | Buffer audio, queue for processing |
| Session reset | Reconnect, lose partial session (expected) |

### TTS Failures

| Scenario | Behavior |
|----------|----------|
| API key invalid | Log error, skip TTS, continue transcription |
| Rate limit (Google) | Queue TTS requests; process as quota allows |
| Network timeout | Skip TTS narration for this segment; continue |
| Provider down | Fall back to next provider (if configured) |

### Settings Corruption

| Scenario | Behavior |
|----------|----------|
| JSON parse error | Load defaults, continue |
| Permissions denied | Warn user, suggest troubleshooting |
| Disk full | Error on save; prompt user |

---

## Performance Characteristics

| Metric | Target | Measured |
|--------|--------|----------|
| Audio capture latency | <100ms | ~50-100ms (varies by OS) |
| UI render latency | <50ms | ~20-50ms (DOM update) |
| Soniox response time | 2-3s | 2-3s (API-dependent) |
| Memory baseline | <200MB | ~120-180MB (varies by OS) |
| Memory under load | <500MB | ~300-400MB (sustained use) |
| CPU idle | <5% | ~2-5% (polling + event loops) |

---

**Document updated**: 2026-04-06  
**Diagrams updated**: 2026-04-06  
**Next review**: After major architecture changes
