#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-client/godot}"
GODOT_TEMPLATE_VERSION="${GODOT_TEMPLATE_VERSION:-4.6.3.stable}"
TEMPLATE_DIR="${GODOT_TEMPLATE_DIR:-$HOME/.local/share/godot/export_templates/$GODOT_TEMPLATE_VERSION}"
SOURCE_ZIP="$TEMPLATE_DIR/android_source.zip"
ANDROID_DIR="$PROJECT_DIR/android"
DEST="$ANDROID_DIR/build"

if [[ ! -f "$SOURCE_ZIP" ]]; then
  echo "Android Gradle template not found: $SOURCE_ZIP" >&2
  exit 1
fi

rm -rf "$ANDROID_DIR"
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

# Godot validates this file before starting any Gradle export.
printf '%s\n' "$GODOT_TEMPLATE_VERSION" > "$ANDROID_DIR/.build_version"

test "$(tr -d '\r\n' < "$ANDROID_DIR/.build_version")" = "$GODOT_TEMPLATE_VERSION"
echo "Godot Android Gradle template $GODOT_TEMPLATE_VERSION installed at $DEST"
