#!/usr/bin/env bash
# One-command macOS install — downloads the latest hkustgzconnect (zip), strips the
# Gatekeeper quarantine flag, and installs to /Applications so it launches without
# the "damaged"/"cannot verify" prompt. (We aren't Apple-notarized.)
#
#   curl -fsSL https://raw.githubusercontent.com/heeh02/hkustgzconnect/main/desktop/scripts/install-mac.sh | bash
set -euo pipefail
REPO="heeh02/hkustgzconnect"
case "$(uname -m)" in arm64) A=arm64 ;; *) A=x64 ;; esac

echo "→ finding latest mac-$A build…"
URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep -oE "https://[^\"]*mac-$A\.zip" | head -1)
[ -n "$URL" ] || { echo "✗ no mac-$A.zip in latest release"; exit 1; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
echo "↓ $URL"
curl -fL# "$URL" -o "$TMP/app.zip"
ditto -x -k "$TMP/app.zip" "$TMP/x"
APP=$(find "$TMP/x" -maxdepth 2 -name '*.app' | head -1)
[ -n "$APP" ] || { echo "✗ no .app inside zip"; exit 1; }

rm -rf "/Applications/hkustgzconnect.app"
cp -R "$APP" /Applications/
xattr -dr com.apple.quarantine "/Applications/hkustgzconnect.app" 2>/dev/null || true
echo "✓ 已安装到 /Applications/hkustgzconnect.app — 直接从启动台/应用程序打开即可。"
