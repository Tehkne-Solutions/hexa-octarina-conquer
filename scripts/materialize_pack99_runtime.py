#!/usr/bin/env python3
"""Materializa o PACK 99 para Web e Godot aplicando a política oficial.

Signature: Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
from collections import Counter
from pathlib import Path, PurePosixPath
from typing import Any

SIGNATURE = "Tehkné Solutions"
PACK_ID = "HOC_PACK_99_FINAL_RUNTIME_RECOVERED"
CONTRACT_ROOT = Path("runtime/packs/PACK_99_RECOVERED")
POLICY_PATH = CONTRACT_ROOT / "runtime-policy.json"
CATALOG_PATH = CONTRACT_ROOT / "asset-catalog.json"
WEB_ROOT = Path("client/web/public/assets/runtime/pack99")
GODOT_ROOT = Path("client/godot/assets/runtime/pack99")
WEB_PUBLIC_ROOT = Path("assets/runtime/pack99")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Materializa o PACK 99 aplicando exclusões e categorias oficiais."
    )
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument(
        "--materialize-mode",
        choices=("hardlink", "copy"),
        default="hardlink",
    )
    parser.add_argument("--clean-generated", action="store_true")
    return parser.parse_args()


def fail(message: str, code: int = 2) -> None:
    print(f"ERRO: {message}", file=sys.stderr)
    raise SystemExit(code)


def normalize(path: Path) -> str:
    return PurePosixPath(*path.parts).as_posix()


def read_json(path: Path) -> Any:
    if not path.is_file():
        fail(f"Arquivo obrigatório ausente: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail(f"JSON inválido em {path}: {exc}")


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def same_content(source: Path, destination: Path) -> bool:
    return (
        destination.is_file()
        and destination.stat().st_size == source.stat().st_size
        and sha256_file(destination) == sha256_file(source)
    )


def materialize_one(source: Path, destination: Path, mode: str) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if same_content(source, destination):
            return "unchanged"
        if destination.is_dir():
            shutil.rmtree(destination)
        else:
            destination.unlink()

    if mode == "hardlink":
        try:
            os.link(source, destination)
            return "linked"
        except OSError:
            shutil.copy2(source, destination)
            return "copied-fallback"

    shutil.copy2(source, destination)
    return "copied"


def main() -> int:
    args = parse_args()
    repo = args.repo.resolve()
    if not (repo / ".git").exists():
        fail(f"Destino não parece ser um repositório Git: {repo}")

    catalog = read_json(repo / CATALOG_PATH)
    policy = read_json(repo / POLICY_PATH)
    if catalog.get("packId") != PACK_ID:
        fail("Catálogo não pertence ao PACK 99 recuperado.")
    if policy.get("packId") != PACK_ID:
        fail("Política não pertence ao PACK 99 recuperado.")

    category_overrides = dict(policy.get("categoryOverrides", {}))
    excluded_paths = set(policy.get("excludeFromRuntime", []))
    assets = catalog.get("assets")
    if not isinstance(assets, list):
        fail("Catálogo sem lista de assets.")

    if args.clean_generated:
        shutil.rmtree(repo / WEB_ROOT, ignore_errors=True)
        shutil.rmtree(repo / GODOT_ROOT, ignore_errors=True)

    results: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()
    excluded: list[dict[str, Any]] = []
    runtime_assets: list[dict[str, Any]] = []

    candidates = [asset for asset in assets if asset.get("runtime_candidate")]
    for index, asset in enumerate(candidates, start=1):
        source_path = str(asset.get("source_path", ""))
        canonical_path = str(asset.get("canonical_path", ""))
        if not source_path or not canonical_path:
            fail("Asset sem source_path ou canonical_path.")

        category = category_overrides.get(source_path, asset.get("category") or "unclassified")
        if source_path in excluded_paths:
            excluded.append(
                {
                    "id": asset.get("id"),
                    "sourcePath": source_path,
                    "category": category,
                    "reason": "runtime-policy",
                }
            )
            continue

        source = repo / Path(canonical_path)
        if not source.is_file():
            fail(f"Fonte canônica ausente: {source}")

        relative_target = Path(category) / Path(source_path)
        web_path = repo / WEB_ROOT / relative_target
        godot_path = repo / GODOT_ROOT / relative_target
        web_result = materialize_one(source, web_path, args.materialize_mode)
        godot_result = materialize_one(source, godot_path, args.materialize_mode)
        results[f"web:{web_result}"] += 1
        results[f"godot:{godot_result}"] += 1
        category_counts[category] += 1

        runtime_assets.append(
            {
                "id": asset.get("id"),
                "category": category,
                "packHint": asset.get("pack_hint"),
                "sourcePath": source_path,
                "canonicalPath": canonical_path,
                "sha256": asset.get("sha256"),
                "bytes": asset.get("bytes"),
                "duplicateOf": asset.get("duplicate_of"),
                "web": normalize(WEB_ROOT / relative_target),
                "webPublic": "/" + normalize(WEB_PUBLIC_ROOT / relative_target),
                "godot": normalize(GODOT_ROOT / relative_target),
            }
        )
        if index % 250 == 0:
            print(f"  runtime: {index}/{len(candidates)}", flush=True)

    runtime_index = {
        "schemaVersion": 2,
        "packId": PACK_ID,
        "namespace": "PACK_99_RECOVERED",
        "version": "1.0.2",
        "status": "materialized-local-policy-validated",
        "assetCount": len(runtime_assets),
        "excludedCount": len(excluded),
        "categoryCounts": dict(sorted(category_counts.items())),
        "assets": runtime_assets,
        "excluded": excluded,
        "signature": SIGNATURE,
    }
    report = {
        "mode": args.materialize_mode,
        "catalogAssetCount": len(assets),
        "runtimeCandidateCount": len(candidates),
        "materializedAssetCount": len(runtime_assets),
        "excludedAssetCount": len(excluded),
        "targetFileCount": len(runtime_assets) * 2,
        "results": dict(sorted(results.items())),
        "categoryCounts": dict(sorted(category_counts.items())),
        "excluded": excluded,
        "policy": normalize(POLICY_PATH),
        "signature": SIGNATURE,
    }

    write_json(repo / CONTRACT_ROOT / "runtime-index.json", runtime_index)
    write_json(repo / CONTRACT_ROOT / "materialization-report.json", report)
    write_json(repo / WEB_ROOT / "runtime-index.json", runtime_index)
    write_json(repo / GODOT_ROOT / "runtime-index.json", runtime_index)

    print("")
    print("=== PACK 99 MATERIALIZATION RESULT ===")
    print(f"CATALOG_ASSETS={len(assets)}")
    print(f"RUNTIME_CANDIDATES={len(candidates)}")
    print(f"MATERIALIZED_ASSETS={len(runtime_assets)}")
    print(f"EXCLUDED_ASSETS={len(excluded)}")
    print(f"TARGET_FILES={len(runtime_assets) * 2}")
    print(f"RESULTS={json.dumps(dict(sorted(results.items())), ensure_ascii=False)}")
    print(f"SIGNATURE={SIGNATURE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
