# Code Standards & Conventions

This document defines the coding standards and patterns used throughout My Translator to ensure consistency, maintainability, and developer velocity.

## File Naming Conventions

### JavaScript & Frontend (`src/js/`)
- **Format**: kebab-case with `.js` extension
- **Length**: Descriptive, self-documenting names (length is acceptable for clarity)
- **Examples**: `app.js`, `soniox.js`, `elevenlabs-tts.js`, `google-tts.js`, `audio-player.js`
- **Pattern**: Module name indicates responsibility clearly

### Rust & Backend (`src-tauri/src/`)
- **Format**: snake_case with `.rs` extension (Rust convention)
- **Length**: Concise, descriptive names
- **Examples**: `lib.rs`, `settings.rs`, `system_audio.rs`, `edge_tts.rs`, `local_pipeline.rs`
- **Pattern**: Module hierarchy via folders (e.g., `audio/microphone.rs`, `commands/audio.rs`)

### Python Scripts (`scripts/`)
- **Format**: snake_case with `.py` extension
- **Examples**: `local_pipeline.py`, `setup_mlx.py`
- **Executables**: Marked as entry points in CI/CD

### Configuration Files
- **Format**: kebab-case or lowercase
- **Examples**: `tauri.conf.json`, `Cargo.toml`, `package.json`, `Entitlements.plist`

---

## Frontend Code Patterns

### Module Structure (ES Modules)

All frontend modules are **ES module** exports (`export class`, `export const`).

**Pattern**:
```javascript
// soniox.js — Singleton pattern

class SonioxClient {
    constructor() {
        this.isConnected = false;
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    async connect(token, lang1, lang2, context) {
        // Implementation
    }
}

export const sonioxClient = new SonioxClient();
```

**Why**: No framework required; simple, testable, follows browser native patterns.

### Naming Conventions (Frontend)

| Category | Convention | Example |
|----------|-----------|---------|
| **Classes** | PascalCase | `TranscriptUI`, `SonioxClient`, `AudioPlayer` |
| **Variables/Functions** | camelCase | `isRunning`, `audioPlayer`, `settingsManager` |
| **Constants** | camelCase (mutable singletons) or UPPER_SNAKE_CASE (immutable) | `maxLines`, `DEFAULT_LANG` |
| **Private methods** | Prefix `_` | `_applySettings()`, `_handleKeyPress()` |
| **Boolean variables** | Prefix `is`, `has`, `should`, `can` | `isRunning`, `hasPermission`, `shouldAutoScroll` |

### Error Handling (Frontend)

**Pattern**: Try-catch with user-friendly error messages.

```javascript
async speakText(text) {
    try {
        const audio = await googleTTS.speak(text);
        await audioPlayer.play(audio);
    } catch (error) {
        console.error('TTS failed:', error);
        // Notify user via UI
        this.showError(`Text-to-speech failed: ${error.message}`);
    }
}
```

**Guidelines**:
- Catch errors at operation boundaries (API calls, IPC invokes)
- Log to console for debugging
- Show user-friendly error messages in UI
- Never silently fail

### TTS Provider Interface Pattern

Each TTS provider implements a consistent interface:

```javascript
class GoogleTTS {
    async speak(text, options = {}) {
        // options: { languageCode, voiceName, speed }
        // Returns: Promise<base64 MP3 string>
        const { languageCode, voiceName, speed } = options;
        // Call API
        return base64Mp3;
    }
}

export const googleTTS = new GoogleTTS();
```

**Providers**: `google-tts.js`, `elevenlabs-tts.js`, `edge-tts.js`, `web-speech-tts.js`

**Usage in app.js**:
```javascript
const ttsProvider = this.settings.tts_provider === 'google' 
    ? googleTTS 
    : this.settings.tts_provider === 'elevenlabs' 
    ? elevenLabsTTS 
    : edgeTTSRust;

await ttsProvider.speak(translationText, options);
```

### Settings Pattern

Settings are fetched from Rust backend via IPC, cached in frontend, and persisted on change.

```javascript
// settings.js
class SettingsManager {
    constructor() {
        this.data = {};
    }

    async load() {
        const result = await invoke('get_settings');
        this.data = result;
    }

    get() {
        return this.data;
    }

    async save(updates) {
        this.data = { ...this.data, ...updates };
        const result = await invoke('save_settings', { settings: this.data });
        if (result.error) throw new Error(result.error);
    }
}

export const settingsManager = new SettingsManager();
```

**Usage in app.js**:
```javascript
async init() {
    await settingsManager.load();
    const settings = settingsManager.get();
    this.sourceLang = settings.source_language;
}

async updateSettings(key, value) {
    await settingsManager.save({ [key]: value });
}
```

### Event Emission Pattern

Decoupled communication via event emitters.

```javascript
// soniox.js
class SonioxClient {
    emit(event, data) {
        // Emits: 'segment', 'connected', 'error', 'disconnected'
    }
}

// app.js
sonioxClient.on('segment', ({ original, translation }) => {
    this.transcriptUI.addSegment(original, translation);
});
```

**Events**:
- `'segment'` — New transcription segment
- `'connected'` — WebSocket connected
- `'disconnected'` — WebSocket disconnected
- `'error'` — Error occurred

---

## Rust Backend Code Patterns

### Module Structure

Modules organized by responsibility:

```
src/
├── lib.rs           # Entry point, app builder
├── settings.rs      # Settings struct + persistence
├── audio/           # Audio capture modules
├── commands/        # Tauri IPC command handlers
└── [other modules]
```

**Pattern**: Module tree; public APIs via `mod.rs`.

### Naming Conventions (Rust)

| Category | Convention | Example |
|----------|-----------|---------|
| **Structs** | PascalCase | `Settings`, `AudioState`, `SystemAudioCapture` |
| **Functions** | snake_case | `start_capture`, `save_settings` |
| **Constants** | UPPER_SNAKE_CASE | `DEFAULT_SAMPLE_RATE`, `MAX_BUFFER_SIZE` |
| **Methods** | snake_case | `impl SystemAudioCapture { fn start(&self) {} }` |
| **Type parameters** | Single uppercase letter or descriptive | `T`, `E`, `AudioBuffer` |

### Error Handling (Rust)

**Pattern**: Use `Result<T, String>` for Tauri commands.

```rust
#[tauri::command]
pub async fn start_capture(source: String) -> Result<(), String> {
    match source.as_str() {
        "system" => {
            system_audio.start()
                .map_err(|e| format!("Failed to start system audio: {}", e))
        },
        "microphone" => {
            microphone.start()
                .map_err(|e| format!("Failed to start microphone: {}", e))
        },
        _ => Err("Invalid audio source".to_string())
    }
}
```

**Guidelines**:
- Return `Result<T, String>` for Tauri commands (serializable to frontend)
- Use descriptive error messages
- Don't panic in production code
- Log errors to stderr for debugging

### Settings Pattern (Rust)

Settings struct with serde serialization and disk persistence.

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub soniox_api_key: String,
    pub source_language: String,
    pub target_language: String,
    pub audio_source: String,
    // ... 20+ fields
}

impl Settings {
    pub fn load() -> Self {
        let path = settings_path();
        if path.exists() {
            match fs::read_to_string(&path) {
                Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
                Err(_) => Self::default(),
            }
        } else {
            Self::default()
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let path = settings_path();
        fs::create_dir_all(path.parent().unwrap())?;
        let json = serde_json::to_string_pretty(self)?;
        fs::write(&path, json)?;
        Ok(())
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            soniox_api_key: String::new(),
            source_language: "auto".to_string(),
            // ...
        }
    }
}
```

### Audio Capture Interface Pattern

Each platform's audio capture follows a consistent trait:

```rust
pub trait AudioCapture {
    fn start(&mut self) -> Result<(), String>;
    fn stop(&mut self) -> Result<(), String>;
    fn is_running(&self) -> bool;
}

impl AudioCapture for SystemAudioCapture {
    fn start(&mut self) -> Result<(), String> { /* macOS ScreenCaptureKit */ }
    fn stop(&mut self) -> Result<(), String> { /* cleanup */ }
    fn is_running(&self) -> bool { /* check state */ }
}

impl AudioCapture for MicCapture {
    fn start(&mut self) -> Result<(), String> { /* CPAL init */ }
    fn stop(&mut self) -> Result<(), String> { /* CPAL cleanup */ }
    fn is_running(&self) -> bool { /* check state */ }
}
```

### Tauri Command Pattern

Commands are public functions decorated with `#[tauri::command]`:

```rust
#[tauri::command]
pub fn get_settings(state: tauri::State<SettingsState>) -> Result<Settings, String> {
    let settings = state.0.lock().unwrap();
    Ok(settings.clone())
}

#[tauri::command]
pub fn save_settings(
    updates: Settings,
    state: tauri::State<SettingsState>,
) -> Result<(), String> {
    {
        let mut settings = state.0.lock().unwrap();
        *settings = updates;
    }
    settings.save()
}
```

**Guidelines**:
- Use descriptive names matching frontend invoke calls
- Accept `tauri::State<T>` for managed state (thread-safe Mutex)
- Return `Result<T, String>` for JSON serialization
- Implement error recovery before returning errors

---

## Code Quality Standards

### Logging & Debugging

**Frontend**:
```javascript
// Use console for debugging
console.log('App started with settings:', settings);
console.error('Soniox connection failed:', error);
console.warn('Low microphone volume detected');
```

**Rust**:
```rust
// Use eprintln! for stderr debugging
eprintln!("Audio capture started: {:?}", config);
eprintln!("Settings saved to: {:?}", path);
```

### Comments & Documentation

**Inline comments**: Explain *why*, not *what*.
```javascript
// Good
if (!this.isRunning) {
    // Only start capture if not already running; prevents duplicate streams
    this.start();
}

// Bad
if (!this.isRunning) {
    // Set isRunning to true
    this.start();
}
```

**Module-level comments**: Describe module purpose.
```javascript
/**
 * SonioxClient — WebSocket client for real-time speech-to-text + translation
 * Maintains persistent connection to Soniox API, handles reconnection,
 * and emits segments with original + translated text.
 */
```

### Performance Considerations

| Concern | Standard |
|---------|----------|
| **Audio latency** | <100ms PCM capture to frontend |
| **UI render** | <50ms DOM update for new segments |
| **Memory** | <200MB baseline, <500MB under heavy use |
| **CPU idle** | <5% when capturing without processing |

### Accessibility

- High contrast overlay support
- Keyboard navigation in settings
- Font sizing up to 140px for visually impaired users
- Alt text on images (screenshots in docs)

### Security

- **No secrets in code** — API keys loaded from settings only
- **HTTPS/WSS only** — No unencrypted external connections
- **Input validation** — Validate API responses before using
- **Process safety** — Use `std::process` carefully; validate spawned process inputs

### CSS Design Tokens (`src/styles/main.css`)

`main.css` ships raw (no bundler, no preprocessor). Its `:root` block defines scales that
every rule should draw from:

- **Colors** — theme colors (`--accent`, `--error`, `--success`, `--warning`, surfaces
  `--surface-1/2/3`, named accents like `--accent-speaker`) plus `--text-*` / `--border-*`.
- **Spacing** — `--space-3xs` (2px) through `--space-3xl` (24px).
- **Type** — `--font-size-xs` (10px) through `--font-size-xl` (16px).
- **Z-index** — `--z-floating` / `--z-compact-reveal` / `--z-compact-catch` / `--z-overlay`, named by stacking intent.
- **Control heights** — `--control-h-sm/md/lg`, the overlay chrome's interactive-control heights only.
- **Radius** — `--radius-2xs` through `--radius-lg`.

**Allowlisted color literals** (not tokenized, checked by rule rather than by listing every
site): an alpha variant whose RGB triple matches an existing `:root` color token; black
shadow colors (`rgba(0,0,0,*)`); the header-wash color (`rgba(20,20,30,*)`); and the single
`#ffffff` fallback of the JS-injected `--transcript-font-color` property. A handful of
one-off pixel values also stay literal by deliberate judgment call (hairlines, one-off
sizes, the `select` arrow's mechanical offset) — see `plans/260821-1640-uiux-overhaul/phase-03-design-token-layer.md` §3c for the full rationale.

**Guard test**: `tests/js/css-tokens.test.js` enforces this mechanically — no `var()`
references an undefined custom property (except the JS-injected exemptions:
`--transcript-font-size`, `--transcript-font-color`, `--overlay-opacity`), no `:root`
token goes unreferenced, and no color literal outside `:root` falls outside the allowlist
rules above. Run it via `npm test` whenever `main.css`'s `:root` block changes.

---

## Testing & CI/CD Standards

### Unit Tests
- Test individual modules in isolation
- Mock external APIs (Soniox, Google TTS)
- Aim for 70%+ code coverage on critical paths

### Integration Tests
- Test full workflows (audio → STT → TTS)
- Verify IPC communication
- Test settings persistence

### CI/CD Pipeline
- **GitHub Actions**: Build on push to main/branches
- **Linting**: rustfmt for Rust (no strict enforcement)
- **Tests**: Run before release builds
- **Code signing**: macOS builds signed + notarized

### Pre-commit Standards
- No console.log left in production code (use eprintln!)
- No hardcoded API keys or secrets
- No trailing whitespace
- Consistent indentation (4 spaces Rust, 2 spaces JS)

---

## Documentation Standards

### Code Comments
- File headers describe module purpose
- Complex logic receives step-by-step comments
- Public APIs documented with examples

### Markdown Docs
- Keep doc files under 800 LOC
- Use tables for structured data
- Include code examples
- Cross-reference related docs

### Changelog Entries
- Describe change from user perspective
- Include issue/PR reference
- Use present tense ("Add feature", not "Added feature")

---

## Common Patterns & Anti-Patterns

### Good Patterns ✅

| Pattern | Example | Benefit |
|---------|---------|---------|
| **Singleton services** | `export const sonioxClient = new SonioxClient()` | Single instance, shared state |
| **Event emitters** | `on('segment', callback)` | Decoupled communication |
| **Settings as source of truth** | Load once, sync on change | Consistent app state |
| **Error recovery** | Retry with backoff, fallback providers | Resilient to failures |
| **Type guards** | Check `typeof`, `instanceof` before use | Prevent runtime errors |

### Anti-Patterns ❌

| Pattern | Problem | Alternative |
|---------|---------|--------------|
| **Global variables** | Hard to test, unpredictable state | Use module singletons |
| **Silent failures** | Bugs hidden, hard to debug | Throw errors, log to console |
| **Callbacks (deep nesting)** | Callback hell, hard to read | Use Promises/async-await |
| **Hardcoded values** | Not configurable, brittle | Use settings or constants |
| **Mocking internal state** | Tests couple to implementation | Test public interfaces only |

---

## Versioning & Release Standards

### Semantic Versioning
- **Major**: Breaking changes (API, UI)
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, no new features

### Version Bumping
1. Update `package.json` version
2. Update `src-tauri/Cargo.toml` version
3. Update `src-tauri/tauri.conf.json` version
4. Commit with message: `chore: bump to vX.Y.Z`
5. Tag: `git tag vX.Y.Z`
6. Push: `git push origin main --tags`

---

## Continuous Improvement

Standards evolve with the codebase. Review and update this document quarterly or when:
- New patterns emerge as code grows
- Bugs traced to inconsistent standards
- Team feedback indicates confusion
- New dependencies introduce conventions

**Last updated**: 2026-04-06  
**Next review**: 2026-07-06
