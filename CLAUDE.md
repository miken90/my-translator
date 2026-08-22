# CLAUDE.md — My Translator

## Project

Real-time speech translation desktop app. Tauri 2 (Rust) + Vanilla JS (no framework, no bundler).

- **Platform**: Windows only (portable build)
- **Build**: `npm install && npm run tauri build` — requires Rust (stable), Node.js 18+

## Build & Deploy

- **Target**: Portable `.exe` only (no installer)
- **Build**: `npm install && npm run tauri build` — requires Rust (stable), Node.js 18+
- **Release script**: `npm run build:release` (or `powershell.exe -NoProfile -File scripts/build-release.ps1 [version]`) — builds exe, zips to `dist/`
- **Release asset**: `dist/MyTranslator-v{version}-windows-x64.zip`
- **Auto-updater**: Hidden — code kept but inactive (`_checkForUpdates` commented out)
- **Output**: `src-tauri/target/release/my-translator.exe`

## Architecture

```
src/               Frontend (WebView) — vanilla JS ES modules, no bundler
src-tauri/         Rust backend — Tauri 2 IPC commands, audio capture, settings
```

- **Audio**: WASAPI (system audio) + cpal (microphone) → PCM 16kHz mono → Soniox WebSocket
- **TTS**: 3 providers with unified interface (`configure`, `connect`, `speak`, `disconnect`)
- **Settings**: `%APPDATA%/com.personal.translator/settings.json`

## Critical Implementation Details

- `sessionLog[]` = full session (never trimmed). `segments[]` = display buffer (trimmed).
- Copy and save use `sessionLog[]`. Only `clearSession()` resets it — call after successful save only.
- Error handlers must call `clearSession()` before `showPlaceholder()`.
