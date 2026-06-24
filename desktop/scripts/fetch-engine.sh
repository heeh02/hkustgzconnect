#!/usr/bin/env bash
# Fetch zju-connect engine binaries into desktop/engine/ for the given OS.
# Usage: fetch-engine.sh [mac|win|linux]   (defaults to host OS)
# Requires: curl + unzip (mac/linux). On Windows CI use the PowerShell step in build.yml.
set -euo pipefail

VER="${ZJU_VERSION:-v1.1.1}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/engine"
BASE="https://github.com/Mythologyli/zju-connect/releases/download/$VER"
mkdir -p "$OUT"

fetch() { # $1 = asset stem (no .zip)   $2 = destination filename
  local zip="$1.zip" tmp; tmp="$(mktemp -d)"
  echo "↓ $zip -> $2"
  curl -fL --retry 3 -o "$tmp/a.zip" "$BASE/$zip"
  unzip -o -q "$tmp/a.zip" -d "$tmp"
  local bin
  bin="$(find "$tmp" -type f \( -name 'zju-connect' -o -name 'zju-connect.exe' \) | head -1)"
  [ -n "$bin" ] || bin="$(find "$tmp" -type f ! -name '*.zip' | head -1)"
  cp "$bin" "$OUT/$2"
  chmod +x "$OUT/$2" 2>/dev/null || true
  rm -rf "$tmp"
}

case "${1:-$(uname -s)}" in
  mac|Darwin|darwin)
    fetch zju-connect-darwin-arm64 zju-connect-darwin-arm64
    fetch zju-connect-darwin-amd64 zju-connect-darwin-amd64
    ;;
  win|windows|Windows*|MINGW*|MSYS*)
    fetch zju-connect-windows-amd64 zju-connect-windows-amd64.exe
    ;;
  linux|Linux)
    fetch zju-connect-linux-amd64 zju-connect-linux-amd64
    ;;
  *) echo "unknown platform: ${1:-}" >&2; exit 1 ;;
esac

echo "engine/ now contains:"
ls -la "$OUT"
