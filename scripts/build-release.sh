#!/bin/bash
# Build portable release zip for GitHub
# Usage: ./scripts/build-release.sh [version]
# Example: ./scripts/build-release.sh 0.5.2

set -e

# Get version from argument or Cargo.toml
VERSION=${1:-$(grep '^version' src-tauri/Cargo.toml | head -1 | sed 's/.*"\(.*\)"/\1/')}
APP_NAME="MyTranslator"
DIST_DIR="dist"
EXE_PATH="src-tauri/target/release/my-translator.exe"
ZIP_NAME="${APP_NAME}-v${VERSION}-windows-x64.zip"

echo "=== Building ${APP_NAME} v${VERSION} ==="

# Build release binary
echo "[1/3] Building release binary..."
cargo build --release --manifest-path src-tauri/Cargo.toml

# Verify exe exists
if [ ! -f "$EXE_PATH" ]; then
    echo "ERROR: Release binary not found at $EXE_PATH"
    exit 1
fi

# Create dist directory
echo "[2/3] Packaging portable zip..."
mkdir -p "$DIST_DIR"
rm -f "${DIST_DIR}/${ZIP_NAME}"

# Create zip with renamed exe
cp "$EXE_PATH" "/tmp/${APP_NAME}.exe"
cd /tmp && powershell.exe -Command "Compress-Archive -Path '${APP_NAME}.exe' -DestinationPath '${APP_NAME}-v${VERSION}-windows-x64.zip' -Force"
mv "/tmp/${ZIP_NAME}" "$(cd - > /dev/null && pwd)/${DIST_DIR}/${ZIP_NAME}"
rm -f "/tmp/${APP_NAME}.exe"

# Show result
EXE_SIZE=$(du -h "$EXE_PATH" | cut -f1)
ZIP_SIZE=$(du -h "${DIST_DIR}/${ZIP_NAME}" | cut -f1)
echo "[3/3] Done!"
echo ""
echo "  Binary: ${EXE_PATH} (${EXE_SIZE})"
echo "  Zip:    ${DIST_DIR}/${ZIP_NAME} (${ZIP_SIZE})"
echo ""
echo "To release:"
echo "  gh release create v${VERSION} ${DIST_DIR}/${ZIP_NAME} --title \"v${VERSION}\" --notes-file RELEASE_NOTES.md"
