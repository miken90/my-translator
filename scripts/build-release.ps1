# Build portable release zip for GitHub.
# Usage: powershell.exe -NoProfile -File scripts\build-release.ps1 [version]
# Example: powershell.exe -NoProfile -File scripts\build-release.ps1 0.7.0
#
# PowerShell, not bash: this app builds on Windows only (WASAPI + native cargo
# toolchain). A bash/WSL build silently compiles the wrong (Linux) binary
# while still exiting 0 — this script runs cargo natively and proves the
# resulting .exe was actually produced by this run before packaging it.

param(
    [string]$Version
)

$ErrorActionPreference = 'Stop'

$AppName = 'MyTranslator'
$DistDir = 'dist'
$ExePath = 'src-tauri\target\release\my-translator.exe'
$ManifestPath = 'src-tauri\Cargo.toml'

if (-not $Version) {
    $line = Select-String -Path $ManifestPath -Pattern '^version' | Select-Object -First 1
    if (-not $line) {
        Write-Error "Could not read version from $ManifestPath"
        exit 1
    }
    $Version = [regex]::Match($line.Line, '"(.*)"').Groups[1].Value
}

if (-not $Version) {
    Write-Error "Version resolution failed (empty)"
    exit 1
}

$ZipName = "$AppName-v$Version-windows-x64.zip"
$ZipPath = Join-Path $DistDir $ZipName

Write-Host "=== Building $AppName v$Version ==="

# Delete any pre-existing exe so it structurally cannot survive to the
# packaging step unless THIS cargo invocation (re)creates it.
if (Test-Path $ExePath) {
    Remove-Item $ExePath -Force
}

Write-Host "[1/3] Building release binary..."
cargo build --release --manifest-path $ManifestPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "cargo build failed with exit code $LASTEXITCODE"
    exit 1
}

if (-not (Test-Path $ExePath)) {
    Write-Error "Release binary not found at $ExePath after build"
    exit 1
}

# cargo hardlinks unchanged binaries from its cache and preserves their
# ORIGINAL compile mtime, so "newer than before" is not a valid freshness
# signal on a no-op incremental rebuild. Instead assert the binary is at
# least as new as the source it's built from - the same staleness test a
# real build system uses. Combined with the delete above, this is airtight:
# a wrong-toolchain build (e.g. from WSL bash) never recreates this exact
# Windows path at all, and a build that is behind current source fails here.
$sourceFiles = @(Get-Item $ManifestPath)
$lockPath = Join-Path (Split-Path $ManifestPath -Parent) 'Cargo.lock'
if (Test-Path $lockPath) { $sourceFiles += Get-Item $lockPath }
$srcDir = Join-Path (Split-Path $ManifestPath -Parent) 'src'
if (Test-Path $srcDir) { $sourceFiles += Get-ChildItem -Path $srcDir -Recurse -File }
$newestSourceTime = ($sourceFiles | Measure-Object -Property LastWriteTimeUtc -Maximum).Maximum

$exeItem = Get-Item $ExePath
if ($exeItem.LastWriteTimeUtc -lt $newestSourceTime) {
    Write-Error "Binary at $ExePath ($($exeItem.LastWriteTimeUtc)) is older than source ($newestSourceTime) - refusing to package a stale artifact"
    exit 1
}

Write-Host "[2/3] Packaging portable zip..."
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

$stageDir = Join-Path $DistDir "_stage_$AppName"
if (Test-Path $stageDir) {
    Remove-Item $stageDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
Copy-Item $ExePath (Join-Path $stageDir "$AppName.exe")

Compress-Archive -Path (Join-Path $stageDir "$AppName.exe") -DestinationPath $ZipPath -Force
Remove-Item $stageDir -Recurse -Force

if (-not (Test-Path $ZipPath)) {
    Write-Error "Zip was not created at $ZipPath"
    exit 1
}

$exeSize = [math]::Round((Get-Item $ExePath).Length / 1MB, 1)
$zipSize = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)

Write-Host "[3/3] Done!"
Write-Host ""
Write-Host "  Binary: $ExePath ($exeSize MB)"
Write-Host "  Zip:    $ZipPath ($zipSize MB)"
Write-Host ""
Write-Host "To release:"
Write-Host "  gh release create v$Version $ZipPath --title `"v$Version`" --notes-file RELEASE_NOTES.md"
