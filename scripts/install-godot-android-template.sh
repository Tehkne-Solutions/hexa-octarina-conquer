#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-client/godot}"
TEMPLATE_DIR="${GODOT_TEMPLATE_DIR:-$HOME/.local/share/godot/export_templates/4.6.3.stable}"
SOURCE_ZIP="$TEMPLATE_DIR/android_source.zip"
DEST="$PROJECT_DIR/android/build"

if [[ ! -f "$SOURCE_ZIP" ]]; then
  echo "Android Gradle template not found: $SOURCE_ZIP" >&2
  exit 1
fi

rm -rf "$PROJECT_DIR/android"
mkdir -p "$DEST"
unzip -q "$SOURCE_ZIP" -d "$DEST"

# Some template archives may contain one wrapping directory.
if [[ ! -f "$DEST/build.gradle" ]]; then
  nested="$(find "$DEST" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)"
  if [[ -n "$nested" && -f "$nested/build.gradle" ]]; then
    shopt -s dotglob
    mv "$nested"/* "$DEST"/
    rmdir "$nested"
  fi
fi

test -f "$DEST/build.gradle"
test -f "$DEST/gradlew"
test -f "$DEST/src/main/AndroidManifest.xml"
chmod +x "$DEST/gradlew"

echo "Godot Android Gradle template installed at $DEST"
