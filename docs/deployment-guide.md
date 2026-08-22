# Deployment & Build Guide

> **Windows-only.** macOS support and the auto-update / CI release infrastructure described further below are historical and no longer apply. For the current build/release process, see the root `CLAUDE.md` and `scripts/build-release.ps1`.

This guide covers building My Translator from source, setting up the development environment, and releasing new versions.

## Prerequisites

### System Requirements

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

---

## Building from Source

### Development Build (Debug)

```bash
npm run tauri build
```

**Output**: `src-tauri/target/release/my-translator.exe`

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

## Windows Code Signing (Optional)

Windows does not require code signing for release, but signing adds trust indicators.

### Setup

1. **Obtain code signing certificate** (DigiCert, Sectigo, etc.)
2. **Export as `.pfx` file** with password
3. **Set environment variables**:

```bash
set WINDOWS_CERTIFICATE_PATH=C:\path\to\certificate.pfx
set WINDOWS_CERTIFICATE_PASSWORD=your-password
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
    │ Setup Rust + Node.js             │
    │ Install dependencies             │
    └────────┬───────────────────────┘
             │
    ┌────────▼────────────────────────┐
    │ Windows Build                    │
    │ ├─ Build app (release)           │
    │ └─ Code sign (optional)          │
    └────────┬───────────────────────┘
             │
    ┌────────▼────────────────────────┐
    │ Create GitHub Release            │
    │ ├─ Upload portable .exe zip      │
    │ └─ Draft release notes           │
    └─────────────────────────────────┘
```

### Manual Release Trigger

To create a release:

1. **Build**: `npm run build:release` (or `powershell.exe -NoProfile -File scripts/build-release.ps1 [version]`)
2. **Create GitHub Release** and upload `dist/MyTranslator-v{version}-windows-x64.zip`

---

## Troubleshooting Build Issues

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

### Windows Distribution

Portable `.exe` only (no installer) — ship `dist/MyTranslator-v{version}-windows-x64.zip`, no installation required.
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
- [ ] Test build on Windows: `npm run build:release`
- [ ] Commit changes: `git commit -m "chore: bump to vX.Y.Z"`
- [ ] Tag release: `git tag vX.Y.Z`
- [ ] Push with tags: `git push origin main --tags`
- [ ] Create GitHub Release and upload `dist/MyTranslator-v{version}-windows-x64.zip`
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
- **Windows portable exe**: ~50MB

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
