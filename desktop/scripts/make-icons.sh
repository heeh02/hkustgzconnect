#!/usr/bin/env bash
# Generate app icons (build/icon.icns, icon.ico, icon.png) from assets/logo.svg.
# Run on macOS after placing the logo. Then re-add the "icon" keys to package.json
# (mac:build/icon.icns, win:build/icon.ico, linux:build/icon.png).
# Requires: rsvg-convert (brew install librsvg) for SVG→PNG; iconutil (built-in) for icns.
set -euo pipefail
cd "$(dirname "$0")/.."
SVG="assets/logo.svg"
[ -f "$SVG" ] || { echo "missing $SVG — place the HKUST(GZ) logo there first"; exit 1; }
mkdir -p build build/icon.iconset

render() { # size out
  if command -v rsvg-convert >/dev/null; then rsvg-convert -w "$1" -h "$1" "$SVG" -o "$2"
  elif command -v inkscape >/dev/null; then inkscape "$SVG" -w "$1" -h "$1" -o "$2"
  else qlmanage -t -s "$1" -o /tmp "$SVG" >/dev/null 2>&1 && cp "/tmp/$(basename "$SVG").png" "$2"; fi
}

for s in 16 32 64 128 256 512 1024; do render "$s" "build/icon.iconset/icon_${s}x${s}.png"; done
cp build/icon.iconset/icon_512x512.png build/icon.png
# retina @2x variants for icns
for s in 16 32 128 256 512; do cp "build/icon.iconset/icon_$((s*2))x$((s*2)).png" "build/icon.iconset/icon_${s}x${s}@2x.png" 2>/dev/null || true; done
iconutil -c icns build/icon.iconset -o build/icon.icns && echo "✓ build/icon.icns"
# .ico (needs imagemagick); skip gracefully
if command -v magick >/dev/null || command -v convert >/dev/null; then
  bin=$(command -v magick || command -v convert)
  "$bin" build/icon.iconset/icon_16x16.png build/icon.iconset/icon_32x32.png \
         build/icon.iconset/icon_64x64.png build/icon.iconset/icon_128x128.png \
         build/icon.iconset/icon_256x256.png build/icon.ico && echo "✓ build/icon.ico"
else
  echo "⚠ no imagemagick → build/icon.ico not made (win build will use default icon)"
fi
echo "done. Re-add icon keys to package.json to use them."
