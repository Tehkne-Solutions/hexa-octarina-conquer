#!/usr/bin/env python3
"""Install validated HOC PACK 02 into isolated Web and Godot namespaces.

Tehkné Solutions
"""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

from scripts import audit_pack02

SIGNATURE = "Tehkné Solutions"
PACK_ID = audit_pack02.PACK_ID
CANONICAL_PACK_ID = audit_pack02.CANONICAL_PACK_ID
VERSION = audit_pack02.VERSION
NAMESPACE = "PACK_02_BOARD_SYSTEM"
ASSET_COUNT = audit_pack02.ASSET_COUNT
COPY_DIRECTORIES = (
    "P01_PILLARS",
    "P02_EDGES",
    "P03_TERRITORY_EVOLUTION",
    "specs",
    "validation",
)
METADATA_FILES = (
    "README.md",
    "pack-manifest.json",
    "LICENSE-ASSETS.md",
    "CHANGELOG.md",
    "board-system.ts",
)


class InstallError(RuntimeError):
    pass


@dataclass(frozen=True)
class InstallResult:
    target: str
    destination: Path
    asset_count: int
    copied_files: int


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def safe_extract(archive_path: Path, destination: Path) -> None:
    destination_root = destination.resolve()
    with zipfile.ZipFile(archive_path) as archive:
        for info in archive.infolist():
            member = PurePosixPath(info.filename)
            if member.is_absolute() or ".." in member.parts or "\\" in info.filename:
                raise InstallError(f"Entrada insegura no ZIP: {info.filename}")
            resolved = (destination / Path(*member.parts)).resolve()
            if resolved != destination_root and destination_root not in resolved.parents:
                raise InstallError(f"Entrada fora do staging: {info.filename}")
        archive.extractall(destination)


def locate_root(extracted: Path) -> Path:
    if (extracted / "pack-manifest.json").is_file():
        return extracted
    candidates = [item for item in extracted.iterdir() if item.is_dir() and (item / "pack-manifest.json").is_file()]
    if len(candidates) != 1:
        raise InstallError("Não foi possível localizar uma raiz única do PACK 02.")
    return candidates[0]


def build_runtime_registry(root: Path) -> dict[str, Any]:
    registry_path = root / "registry" / "assets-registry.json"
    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        raise InstallError(f"Registro progressivo inválido: {registry_path}") from exc
    assets = registry.get("assets")
    if registry.get("packId") != PACK_ID or registry.get("canonicalPackId") != CANONICAL_PACK_ID:
        raise InstallError("Registro do PACK 02 possui identidade inválida.")
    if registry.get("version") != VERSION or registry.get("signature") != SIGNATURE:
        raise InstallError("Registro do PACK 02 possui versão ou assinatura inválida.")
    if not isinstance(assets, list) or len(assets) != ASSET_COUNT:
        raise InstallError("Registro do PACK 02 precisa conter exatamente 55 assets.")

    runtime_assets: list[dict[str, Any]] = []
    unresolved: list[dict[str, str]] = []
    seen: set[str] = set()
    for original in assets:
        asset = dict(original)
        asset_id = str(asset.get("id", ""))
        if not asset_id or asset_id in seen:
            raise InstallError(f"ID vazio ou duplicado no PACK 02: {asset_id!r}")
        seen.add(asset_id)
        for source_key, runtime_key in (
            ("runtimeFile", "_runtimeFile"),
            ("runtimeShadow", "_runtimeShadow"),
            ("runtimeEmissive", "_runtimeEmissive"),
        ):
            value = asset.get(source_key)
            if not value:
                continue
            source = root / Path(*PurePosixPath(str(value)).parts)
            if not source.is_file():
                unresolved.append({"assetId": asset_id, "field": source_key, "value": str(value)})
            else:
                asset[runtime_key] = str(value)
        runtime_assets.append(asset)
    if unresolved:
        preview = ", ".join(f"{item['assetId']}:{item['field']}" for item in unresolved[:20])
        raise InstallError(f"PACK 02 possui {len(unresolved)} referência(s) ausente(s): {preview}")

    return {
        "project": "Hexa Octarina Conquer",
        "packId": PACK_ID,
        "canonicalPackId": CANONICAL_PACK_ID,
        "namespace": NAMESPACE,
        "version": VERSION,
        "status": "installed-progressive",
        "assetCount": len(runtime_assets),
        "assets": runtime_assets,
        "unresolved": [],
        "runtime": {
            "masterCanvasPx": [1024, 1024],
            "colorMode": "RGBA",
            "anchors": {
                "board-node": [0.5, 0.92],
                "board-edge": [0.5, 0.78],
                "territory-structure": [0.5, 0.91],
            },
            "renderOrder": {
                "terrain": 100,
                "edges": 200,
                "territory": 500,
                "pillars": 600,
                "actors": 700,
                "vfx": 800,
            },
        },
        "signature": SIGNATURE,
    }


def copy_pack(root: Path, staging: Path, runtime_registry: dict[str, Any]) -> int:
    copied = 0
    for directory in COPY_DIRECTORIES:
        source = root / directory
        if not source.is_dir():
            raise InstallError(f"Diretório obrigatório ausente: {directory}")
        shutil.copytree(source, staging / directory, dirs_exist_ok=True)
        copied += sum(1 for item in source.rglob("*") if item.is_file())
    for filename in METADATA_FILES:
        source = root / filename
        if not source.is_file():
            raise InstallError(f"Arquivo obrigatório ausente: {filename}")
        destination = staging / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied += 1
    write_json(staging / "registry" / "board-runtime.json", runtime_registry)
    write_json(staging / "runtime-install.json", {
        "packId": PACK_ID,
        "canonicalPackId": CANONICAL_PACK_ID,
        "namespace": NAMESPACE,
        "version": VERSION,
        "assetCount": ASSET_COUNT,
        "unresolvedReferences": 0,
        "bootstrapModified": False,
        "signature": SIGNATURE,
    })
    copied += 2
    return copied


def activate(staging: Path, destination: Path) -> None:
    backup = destination.with_name(f".{destination.name}.backup")
    shutil.rmtree(backup, ignore_errors=True)
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        if destination.exists():
            destination.replace(backup)
        staging.replace(destination)
    except OSError as exc:
        if destination.exists():
            shutil.rmtree(destination, ignore_errors=True)
        if backup.exists():
            backup.replace(destination)
        raise InstallError(f"Falha ao ativar {destination}: {exc}") from exc
    finally:
        shutil.rmtree(backup, ignore_errors=True)


def destination_for(repo: Path, target: str) -> Path:
    if target == "web":
        return repo / "client" / "web" / "public" / "assets" / "progressive" / NAMESPACE
    if target == "godot":
        return repo / "client" / "godot" / "assets" / "progressive" / NAMESPACE
    raise InstallError(f"Target desconhecido: {target}")


def install(archive: Path, repo: Path, targets: list[str]) -> list[InstallResult]:
    report = audit_pack02.audit(archive)
    if report.get("pack", {}).get("packId") != PACK_ID:
        raise InstallError("Arquivo não pertence ao PACK 02.")
    with tempfile.TemporaryDirectory(prefix="hoc-progressive-pack02-") as temporary:
        extracted = Path(temporary) / "source"
        extracted.mkdir(parents=True)
        safe_extract(archive, extracted)
        root = locate_root(extracted)
        runtime_registry = build_runtime_registry(root)
        prepared: list[tuple[str, Path, Path, int]] = []
        try:
            for target in targets:
                destination = destination_for(repo, target)
                staging = destination.with_name(f".{destination.name}.staging")
                shutil.rmtree(staging, ignore_errors=True)
                staging.mkdir(parents=True, exist_ok=True)
                copied = copy_pack(root, staging, runtime_registry)
                prepared.append((target, destination, staging, copied))
            results: list[InstallResult] = []
            for target, destination, staging, copied in prepared:
                activate(staging, destination)
                results.append(InstallResult(target, destination, ASSET_COUNT, copied))
            return results
        finally:
            for _target, _destination, staging, _copied in prepared:
                shutil.rmtree(staging, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Instala o PACK 02 progressivo em namespace isolado.")
    parser.add_argument("archive", type=Path)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--target", choices=("web", "godot", "all"), default="all")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    archive = args.archive.expanduser().resolve()
    repo = args.repo.expanduser().resolve()
    targets = ["web", "godot"] if args.target == "all" else [args.target]
    try:
        results = install(archive, repo, targets)
    except (audit_pack02.AuditError, InstallError) as exc:
        print(f"ERRO: {exc}")
        return 2
    payload = {
        "passed": True,
        "packId": PACK_ID,
        "version": VERSION,
        "targets": [
            {
                "target": result.target,
                "destination": str(result.destination),
                "assetCount": result.asset_count,
                "copiedFiles": result.copied_files,
            }
            for result in results
        ],
        "bootstrapModified": False,
        "signature": SIGNATURE,
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
