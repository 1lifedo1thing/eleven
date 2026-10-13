#!/usr/bin/env bash
# Installs Eleven into /Applications.
#
#   curl -fsSL https://eleven.chizi.app/install.sh | bash
#
# It downloads the latest release zip for this Mac's architecture, unzips it,
# and opens it. The app is signed and notarized; Java and Ghidra download on first launch. Set
# ELEVEN_RELEASE_URL to install a specific zip (local path or URL) instead.
set -euo pipefail

REPO="${ELEVEN_REPO:-Zfinix/eleven}"
MIRROR="${ELEVEN_MIRROR:-https://dl.chizi.app}"
DEST="${ELEVEN_DEST:-/Applications}"
arch="$(uname -m)"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Eleven is macOS only for now." >&2
  exit 1
fi

url="${ELEVEN_RELEASE_URL:-}"
if [ -z "$url" ]; then
  echo "Finding the latest Eleven release…"
  version="$(curl -fsSL "$MIRROR/latest.json" 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || true)"
  if [ -n "$version" ]; then
    url="$MIRROR/v$version/Eleven-$version-$arch.zip"
    curl -fsIL "$url" > /dev/null 2>&1 || url=""
  fi
fi
if [ -z "$url" ]; then
  url="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep -o "https://[^\"]*Eleven-[^\"]*-$arch\.zip" | head -1)"
fi
if [ -z "$url" ]; then
  echo "No release found for $arch. Set ELEVEN_RELEASE_URL to a zip." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "Downloading $url"
case "$url" in
  http*) curl -fSL "$url" -o "$tmp/eleven.zip" ;;
  *) cp "$url" "$tmp/eleven.zip" ;;
esac

echo "Installing to $DEST/Eleven.app"
rm -rf "$DEST/Eleven.app"
ditto -x -k "$tmp/eleven.zip" "$DEST"
xattr -dr com.apple.quarantine "$DEST/Eleven.app" 2>/dev/null || true

echo "Installed. Open it with: open \"$DEST/Eleven.app\""
open "$DEST/Eleven.app"
