# Deployment & Build Guide

This guide covers building My Translator from source, setting up the development environment, and releasing new versions.

## Prerequisites

### System Requirements

#### macOS
- **OS**: macOS 13.0 or later
- **Architecture**: ARM64 (M1+) or Intel x86_64
- **RAM**: 8GB minimum (16GB recommended)
- **Disk**: 2GB available (build artifacts)
- **Tools**:
  - Xcode Command Line Tools (includes clang, git)
  - Homebrew (optional, for package management)

#### Windows
- **OS**: Windows 10 (Build 19041) or Windows 11
- **Architecture**: x86_64
- **RAM**: 8GB minimum (16GB recommended)
- **Disk**: 2GB available (build artifacts)
- **Tools**:
  - Visual Studio 2022 (Build Tools for C++) OR MinGW-w64
  - Git for Windows

### Development Tools

| Tool | Version | Purpose | Link |
|------|---------|---------|------|
| **Rust** | Stable (1.70+) | Backend compilation | https://rustup.rs/ |
| **Node.js** | 18+ LTS | Package management, CLI | https://nodejs.org/ |
| **npm** | 8+ | Frontend dependencies | bundled with Node.js |
| **Cargo** | Latest stable | Rust package manager | bundled with Rust |
| **git** | 2.30+ | Source control | https://git-scm.com/ |

---

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/phuc-nt/my-translator.git
cd my-translator
```

### 2. Install Rust

**macOS / Linux / Windows (via WSL)**:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version  # Verify installation
```

**Windows (native)**:
- Download from https://rustup.rs/
- Run installer; follow prompts
- Restart terminal after installation
- Verify: `rustc --version`

### 3. Install Node.js

**macOS** (via Homebrew):
```bash
brew install node@18
node --version  # Verify installation
```

**Windows** (via installer or Chocolatey):
```bash
# Option 1: Direct download from https://nodejs.org/
# Option 2: Via Chocolatey
choco install nodejs
```

### 4. Install Dependencies

```bash
npm install
```

This installs:
- `@tauri-apps/cli` — Tauri build tools
- `@tauri-apps/plugin-updater` — Auto-updater runtime
- `@tauri-apps/plugin-process` — Process management

---

## Building from Source

### Development Build (Debug)

**macOS / Linux / Windows**:
```bash
npm run tauri build
```

**Output**:
- macOS: `src-tauri/target/release/bundle/macos/MyTranslator.app`
- Windows: `src-tauri/target/release/MyTranslator.exe`

**Characteristics**:
- Includes debug symbols
- Slower performance
- Smaller download size for development
- Not suitable for distribution

### Production Build (Release)

```bash
npm run tauri build --release
```

**Output** (same as debug, but optimized):
- Stripped of debug symbols
- Full performance optimizations
- Ready for distribution

---

## Building with Code Signing (macOS)

macOS requires code signing for the app to run without quarantine warnings and to enable auto-updates.

### Prerequisites

1. **Apple Developer Account** — Required for code signing certificates
2. **Certificate**: Obtain from Apple Developer portal
   - Type: "Developer ID Application" or "Apple Distribution"
3. **Provisioning Profile** (optional for direct distribution)

### Setup Code Signing

1. **Export certificate** as `.p8` or `.p12` file with password
2. **Set environment variables**:

```bash
export APPLE_CERTIFICATE_PATH="/path/to/certificate.p8"
export APPLE_CERTIFICATE_PASSWORD="your-password"
export APPLE_DEVELOPER_IDENTITY="Developer ID Application: Name (ABC123XYZ)"
```

3. **Update tauri.conf.json** (if needed):

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Name (ABC123XYZ)"
    }
  }
}
```

### Build Signed App

```bash
npm run tauri build --release
```

**Output**: Signed app bundle ready for distribution + notarization

### Notarization (Required for Gatekeeper)

Notarization allows the app to run on other macOS systems without quarantine warnings.

1. **Install Apple Notary tool** (via Xcode):
```bash
xcode-select --install
```

2. **Generate app-specific password**:
   - Visit https://appleid.apple.com/
   - Generate "App-Specific Password"

3. **Run notarization**:

```bash
xcrun notarytool submit build/MyTranslator.dmg \
  --apple-id "your-apple-id@example.com" \
  --password "app-specific-password" \
  --team-id "ABC123XYZ"
```

4. **Check notarization status**:

```bash
xcrun notarytool info <submission-id> \
  --apple-id "your-apple-id@example.com" \
  --password "app-specific-password" \
  --team-id "ABC123XYZ"
```

5. **Staple ticket** (after approval):

```bash
xcrun stapler staple build/MyTranslator.app
```

---

## Windows Code Signing (Optional)

Windows does not require code signing for release, but signing adds trust indicators.

### Setup

1. **Obtain code signing certificate** (DigiCert, Sectigo, etc.)
2. **Export as `.pfx` file** with password
3. **Set environment variables**:

```bash
set APPLE_CERTIFICATE_PATH=C:\path\to\certificate.pfx
set APPLE_CERTIFICATE_PASSWORD=your-password
```

### Build Signed

```bash
npm run tauri build --release
```

---

## CI/CD Pipeline (GitHub Actions)

The repository includes `.github/workflows/release.yml` for automated builds and releases.

### Workflow Overview

```
┌─────────────────────────────────────┐
│ Push tag: git tag v0.5.1            │
└────────────┬────────────────────────┘
             │
    ┌────────▼────────────────────────┐
    │ GitHub Actions Triggered         │
    │ .github/workflows/release.yml    │
    └────────┬───────────────────────┘
             │
    ┌────────▼────────────────────────┐
    │ Matrix: [macos, windows]         │
    │ ├─ Checkout code                 │
    │ ├─ Setup Rust + Node.js          │
    │ └─ Install dependencies          │
    └────────┬───────────────────────┘
             │
    ┌────────▼────────────────────────┐
    │ macOS Build                      │
    │ ├─ Build app (release)           │
    │ ├─ Code sign (from secrets)      │
    │ ├─ Notarize                      │
    │ └─ Create DMG                    │
    └────────┬───────────────────────┘
             │
    ┌────────▼────────────────────────┐
    │ Windows Build                    │
    │ ├─ Build app (release)           │
    │ ├─ Create MSI installer          │
    │ └─ Code sign (optional)          │
    └────────┬───────────────────────┘
             │
    ┌────────▼────────────────────────┐
    │ Create GitHub Release            │
    │ ├─ Upload DMG (macOS)            │
    │ ├─ Upload MSI (Windows)          │
    │ ├─ Generate latest.json          │
    │ └─ Draft release notes           │
    └────────┬───────────────────────┘
             │
    ┌────────▼────────────────────────┐
    │ Auto-update Available            │
    │ Users notified in-app            │
    └─────────────────────────────────┘
```

### Secrets Required in GitHub

Set these in repository **Settings → Secrets and Variables → Actions**:

| Secret | Purpose | Example |
|--------|---------|---------|
| `APPLE_CERTIFICATE` | Base64 code signing cert | (base64-encoded `.p8`) |
| `APPLE_CERTIFICATE_PASSWORD` | Code signing password | (password) |
| `APPLE_DEVELOPER_IDENTITY` | Signing identity | `Developer ID Application: Name (ABC)` |
| `APPLE_TEAM_ID` | Apple Team ID | `ABC123XYZ` |
| `APPLE_ID` | Apple ID for notarization | `name@example.com` |
| `APPLE_ID_PASSWORD` | App-specific password | (app-specific password) |

### Manual Release Trigger

To create a release:

1. **Create local tag**:
```bash
git tag v0.6.0
git push origin main --tags
```

2. **GitHub Actions automatically**:
   - Builds both macOS (signed, notarized) and Windows
   - Creates GitHub Release
   - Uploads artifacts
   - Generates `latest.json` for auto-updater

3. **Verify release**:
   - Visit https://github.com/phuc-nt/my-translator/releases
   - Confirm artifacts are uploaded and checksummed

---

## Auto-Update Mechanism

The app checks for updates via `latest.json` endpoint on GitHub releases.

### latest.json Format

```json
{
  "version": "0.6.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-05-15T10:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://github.com/.../MyTranslator_0.6.0_aarch64.dmg"
    },
    "darwin-x86_64": {
      "signature": "...",
      "url": "https://github.com/.../MyTranslator_0.6.0_x64.dmg"
    },
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/.../MyTranslator_0.6.0_x64-setup.nsis.zip"
    }
  }
}
```

### Configuration

In `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6...",
      "endpoints": [
        "https://github.com/phuc-nt/my-translator/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### Update Flow

1. **App startup**: Auto-checks for updates via `updater.check()`
2. **User notified**: "New version available" modal
3. **User accepts**: Download + verify signature
4. **Install on restart**: App replaces binaries on next launch

---

## Local Pipeline Setup (Optional)

For offline/local STT (Apple Silicon only):

### Prerequisites

- **Python 3.10+** installed
- **MLX, Whisper, Qwen2.5** models (~10GB disk)

### Setup Models

```bash
cd scripts
python3 setup_mlx.py
```

This downloads and caches models to:
```
~/Library/Application Support/my-translator/mlx/
```

### Verify Setup

```bash
python3 local_pipeline.py < test_audio.json
```

---

## Troubleshooting Build Issues

### macOS

| Issue | Solution |
|-------|----------|
| `xcrun: error: unable to find utility` | Run `xcode-select --install` |
| Code signing failed | Verify certificate path and password in env vars |
| Notarization timeout | Retry; Apple service occasionally slow |
| `target/release/` doesn't exist | Run `cargo build --release` first |

### Windows

| Issue | Solution |
|-------|----------|
| `cl.exe not found` | Install Visual Studio Build Tools for C++ |
| WASAPI compilation error | Update Windows SDK or install latest toolchain |
| MSI creation fails | Ensure WiX is installed (bundled in CI/CD) |

### General

| Issue | Solution |
|-------|----------|
| `npm ERR! 404 Not Found` | Update npm: `npm install -g npm@latest` |
| Rust toolchain outdated | Run `rustup update` |
| Dependencies cache issues | Delete `Cargo.lock` and `node_modules/`; rebuild |

---

## Distribution

### macOS Distribution

1. **Via DMG** (default):
   - Double-click to mount
   - Drag app to Applications folder
   - Run from Applications

2. **Via Homebrew Cask** (future consideration):
   ```bash
   brew install my-translator
   ```

3. **Direct binary** (advanced):
   - Export app from build artifacts
   - Ensure signed & notarized

### Windows Distribution

1. **Via MSI Installer** (default):
   - Run `.msi` file
   - Follow installer prompts
   - App installed to `Program Files\MyTranslator\`

2. **Via Portable Exe** (alternative):
   - Ship standalone `.exe`
   - No installation required
   - Settings still persisted locally

---

## Release Checklist

Before releasing a new version:

- [ ] Update `package.json` version
- [ ] Update `src-tauri/Cargo.toml` version
- [ ] Update `src-tauri/tauri.conf.json` version
- [ ] Update `docs/project-roadmap.md` (milestone status)
- [ ] Update `docs/project-changelog.md` (new entry)
- [ ] Run full test suite: `npm run test` (if tests exist)
- [ ] Test build on macOS: `npm run tauri build`
- [ ] Test build on Windows: `npm run tauri build`
- [ ] Commit changes: `git commit -m "chore: bump to vX.Y.Z"`
- [ ] Tag release: `git tag vX.Y.Z`
- [ ] Push with tags: `git push origin main --tags`
- [ ] Monitor GitHub Actions for build completion
- [ ] Verify GitHub Release created with correct artifacts
- [ ] Test auto-update on real machines
- [ ] Announce release on social channels

---

## Performance Optimization

### Build Time Reduction

```bash
# Use mold linker (faster on Linux/macOS)
export RUSTFLAGS="-C link-arg=-fuse-ld=mold"
npm run tauri build

# Parallel compilation
export CARGO_BUILD_JOBS=$(nproc)
npm run tauri build
```

### Binary Size Reduction

Current sizes:
- **macOS DMG**: ~70MB (code-signed)
- **Windows MSI**: ~50MB

Strategies:
- Strip debug symbols: `strip build/release/my-translator`
- Enable LTO in `Cargo.toml`:
```toml
[profile.release]
lto = true
codegen-units = 1
```

---

## Maintenance & Support

### Bug Fix Releases (Patch)

Example: v0.5.0 → v0.5.1

```bash
git tag v0.5.1
git push origin main --tags
```

GitHub Actions automatically builds + releases.

### Feature Releases (Minor)

Example: v0.5.x → v0.6.0

Follow same process; coordinate with roadmap.

### Breaking Changes (Major)

Example: v0.x.x → v1.0.0

- Plan 1-2 months ahead
- Communicate with users early
- Provide migration guide in release notes

---

## Monitoring & Analytics

Tracked metrics (via GitHub):
- **Download counts** — Release page views
- **Issues** — Bug reports, feature requests
- **Stars** — Community sentiment
- **Releases** — Version adoption trends

Tools:
- GitHub Insights dashboard
- Release notes feedback in issues
- Star history: https://star-history.com

---

**Document updated**: 2026-04-06  
**Last CI/CD update**: 2026-04-06 (release.yml v2.1)  
**Next review**: After first v0.6.0 release
