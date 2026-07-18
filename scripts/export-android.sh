#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GODOT_BIN="${GODOT_BIN:-godot}"
OUTPUT="${1:-$ROOT_DIR/build/android/HexaOctarinaConquer-debug.apk}"

if ! command -v "$GODOT_BIN" >/dev/null 2>&1; then
  echo "Godot não encontrado. Defina GODOT_BIN com o executável Godot 4.6.3." >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then
  echo "ANDROID_HOME ou ANDROID_SDK_ROOT precisa apontar para o Android SDK." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"
"$GODOT_BIN" --headless --path "$ROOT_DIR/client/godot" --import
"$GODOT_BIN" --headless --path "$ROOT_DIR/client/godot" --export-debug Android "$OUTPUT"

echo "APK gerado em: $OUTPUT"
echo "Tehkné Solutions"
