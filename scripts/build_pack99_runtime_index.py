#!/usr/bin/env python3
"""Build the premium-client index from a validated PACK 99 runtime registry.

The canonical runtime registry stores one asset with multiple materialized layer
paths. The Web premium resolver consumes a flat searchable index. This command
creates one canonical entry per ID plus additional layer entries while keeping
`assetCount` equal to the 1,037 canonical IDs.

Signature: Tehkné Solutions
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path, PurePosixPath
from typing import Any

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
EXPECTED_CANONICAL_ASSETS = 1037
PATH_FIELDS = (
    ("_runtimeFile", "base"),
    ("_runtimeSpritesheet", "spritesheet"),
    ("_runtimePreview", "preview"),
    ("_runtimeAtlas", "atlas"),
    ("_runtimeShadow", "shadow"),
    ("_runtimeEmissive", "emissive"),
    ("_runtimeFactionMask", "faction-mask"),
)


class RuntimeIndexError(RuntimeError):
    pass


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise RuntimeIndexError(f"Arquivo obrigatório ausente: {path}") from error
    except json.JSONDecodeError as error:
        raise RuntimeIndexError(f"JSON inválido em {path}: {error}") from error
    if not isinstance(value, dict):
        raise RuntimeIndexError(f"O JSON deve ser um objeto: {path}")
    return value


def safe_runtime_path(value: str) -> str:
    normalized = PurePosixPath(value.replace("\\", "/"))
    if normalized.is_absolute() or ".." in normalized.parts:
        raise RuntimeIndexError(f"Caminho runtime inseguro: {value}")
    path = normalized.as_posix()
    if not path.startswith("packages/"):
        raise RuntimeIndexError(f"Payload não canônico fora de packages/: {value}")
    return path


def validate_runtime(runtime_root: Path, expected_count: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    install = read_json(runtime_root / "runtime-install.json")
    registry = read_json(runtime_root / "registry" / "assets-runtime.json")
    if install.get("packId") != PACK_ID or registry.get("packId") != PACK_ID:
        raise RuntimeIndexError("Runtime não pertence ao PACK 99")
    if install.get("signature") != SIGNATURE or registry.get("signature") != SIGNATURE:
        raise RuntimeIndexError("Assinatura institucional inválida")
    if install.get("profile") != "full" or registry.get("profile") != "full":
        raise RuntimeIndexError("O índice premium exige runtime full")
    if int(install.get("unresolvedReferences", -1)) != 0:
        raise RuntimeIndexError("O runtime possui referências não resolvidas")
    assets = registry.get("assets")
    if not isinstance(assets, list):
        raise RuntimeIndexError("Registro runtime sem lista de assets")
    if int(install.get("assetCount", -1)) != expected_count or len(assets) != expected_count:
        raise RuntimeIndexError(
            f"Cobertura canônica divergente: esperado {expected_count}, "
            f"manifesto={install.get('assetCount')!r}, lista={len(assets)}"
        )
    return install, assets


def build_index(runtime_root: Path, *, target: str, expected_count: int = EXPECTED_CANONICAL_ASSETS) -> dict[str, Any]:
    runtime_root = runtime_root.resolve()
    install, assets = validate_runtime(runtime_root, expected_count)
    entries: list[dict[str, Any]] = []
    canonical_ids: set[str] = set()

    for asset in assets:
        if not isinstance(asset, dict):
            raise RuntimeIndexError("Entrada de asset inválida")
        asset_id = asset.get("id")
        category = asset.get("category")
        if not isinstance(asset_id, str) or not asset_id:
            raise RuntimeIndexError("Asset sem ID canônico")
        if asset_id in canonical_ids:
            raise RuntimeIndexError(f"ID canônico duplicado: {asset_id}")
        if not isinstance(category, str) or not category:
            raise RuntimeIndexError(f"Asset sem categoria: {asset_id}")
        canonical_ids.add(asset_id)

        layers: list[tuple[str, str]] = []
        used_paths: set[str] = set()
        for field, layer in PATH_FIELDS:
            value = asset.get(field)
            if not isinstance(value, str) or not value:
                continue
            runtime_path = safe_runtime_path(value)
            if runtime_path in used_paths:
                continue
            materialized = runtime_root / Path(*PurePosixPath(runtime_path).parts)
            if not materialized.is_file():
                raise RuntimeIndexError(f"Payload ausente para {asset_id}: {runtime_path}")
            used_paths.add(runtime_path)
            layers.append((layer, runtime_path))

        if not layers:
            raise RuntimeIndexError(f"ID canônico sem payload materializado: {asset_id}")

        for layer_index, (layer, runtime_path) in enumerate(layers):
            materialized = runtime_root / Path(*PurePosixPath(runtime_path).parts)
            entry_id = asset_id if layer_index == 0 else f"{asset_id}__{layer.upper().replace('-', '_')}"
            entries.append(
                {
                    "id": entry_id,
                    "canonicalId": asset_id,
                    "category": category if layer_index == 0 else f"{category}-{layer}",
                    "layer": layer,
                    "sourcePath": runtime_path,
                    "web": f"client/web/public/assets/runtime/{runtime_path}",
                    "bytes": materialized.stat().st_size,
                }
            )

    if len(canonical_ids) != expected_count:
        raise RuntimeIndexError(f"Índice possui {len(canonical_ids)} IDs canônicos; esperado {expected_count}")
    if len(entries) < expected_count:
        raise RuntimeIndexError("Índice materializado possui menos entradas que IDs canônicos")

    return {
        "project": "Hexa Octarina Conquer",
        "packId": PACK_ID,
        "version": install.get("version", "1.0.2"),
        "profile": "full",
        "runtimeMode": "full",
        "target": target,
        "assetCount": expected_count,
        "canonicalAssetCount": expected_count,
        "materializedAssetCount": len(entries),
        "assets": entries,
        "fallback": None,
        "signature": SIGNATURE,
    }


def write_index(runtime_root: Path, *, target: str, output: Path | None = None, expected_count: int = EXPECTED_CANONICAL_ASSETS) -> Path:
    index = build_index(runtime_root, target=target, expected_count=expected_count)
    output = output or runtime_root / "pack99" / "runtime-index.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera o índice premium do PACK 99 full.")
    parser.add_argument("--runtime-root", type=Path, required=True)
    parser.add_argument("--target", choices=("web", "godot"), required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        output = write_index(args.runtime_root, target=args.target, output=args.output)
        index = read_json(output)
    except (RuntimeIndexError, OSError, ValueError) as error:
        print(f"PACK99_RUNTIME_INDEX=FAILED\nERROR={error}\nSIGNATURE={SIGNATURE}", file=sys.stderr)
        return 2
    print("PACK99_RUNTIME_INDEX=PASSED")
    print(f"CANONICAL_IDS={index['canonicalAssetCount']}")
    print(f"MATERIALIZED_ENTRIES={index['materializedAssetCount']}")
    print(f"OUTPUT={output}")
    print(f"SIGNATURE={SIGNATURE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
