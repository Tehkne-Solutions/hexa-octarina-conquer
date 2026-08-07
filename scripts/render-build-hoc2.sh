#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/client/web"
RUNTIME_NAME="hoc-pack99-web-full.zip"
CHECKSUM_NAME="hoc-pack99-web-full.zip.sha256"
RELEASE_BASE="https://github.com/Tehkne-Solutions/hexa-octarina-conquer/releases/download/pack99-runtime-v1.0.2"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "HOC2_RENDER_BUILD=START"

cd "$WEB_DIR"
npm install --no-audit --no-fund

curl --fail --location --silent --show-error --retry 3 \
  "$RELEASE_BASE/$RUNTIME_NAME" \
  -o "$TMP_DIR/$RUNTIME_NAME"
curl --fail --location --silent --show-error --retry 3 \
  "$RELEASE_BASE/$CHECKSUM_NAME" \
  -o "$TMP_DIR/$CHECKSUM_NAME"
(
  cd "$TMP_DIR"
  sha256sum --check "$CHECKSUM_NAME"
)

rm -rf public/assets/runtime
mkdir -p public/assets/runtime

python3 - "$TMP_DIR/$RUNTIME_NAME" "$WEB_DIR/public/assets/runtime" <<'PY'
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
import sys

archive = Path(sys.argv[1])
destination = Path(sys.argv[2]).resolve()

with ZipFile(archive) as zf:
    entries = []
    roots = []
    for info in zf.infolist():
        normalized = info.filename.replace('\\', '/')
        parts = [p for p in PurePosixPath(normalized).parts if p not in ('', '.')]
        if not parts or '..' in parts:
            raise SystemExit(f'PACK99_UNSAFE_ZIP_ENTRY:{info.filename}')
        entries.append((info, normalized, parts))
        if parts[-1] == 'runtime-install.json':
            roots.append(parts[:-1])

    if len(roots) != 1:
        raise SystemExit(f'PACK99_RUNTIME_ROOT_AMBIGUOUS:{roots}')

    root = roots[0]
    for info, normalized, parts in entries:
        if root and parts[:len(root)] == root:
            parts = parts[len(root):]
        if not parts:
            continue
        target = destination.joinpath(*parts).resolve()
        if destination not in target.parents and target != destination:
            raise SystemExit(f'PACK99_ZIP_ESCAPE:{info.filename}')
        if info.is_dir() or normalized.endswith('/'):
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as source, target.open('wb') as sink:
                sink.write(source.read())
PY

node ../../scripts/verify-web-pack99.mjs
npm run build

test -f dist/hoc2.html
cp dist/hoc2.html dist/index.html

test -f dist/assets/runtime/runtime-install.json

echo "HOC2_RENDER_ROOT=PASS source=hoc2.html target=index.html"
echo "HOC2_RENDER_PACK99=PASS"
echo "HOC2_RENDER_BUILD=PASS publish_dir=client/web/dist"
