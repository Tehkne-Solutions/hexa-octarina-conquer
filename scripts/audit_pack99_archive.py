#!/usr/bin/env python3
"""Audit every file and runtime reference in a PACK 99 archive.

This audit complements the historical SHA256SUMS contract. It hashes every file
inside the reconstructed ZIP, verifies canonical counts and confirms that every
runtime path referenced by the global registry exists in the archive.

Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
EXPECTED_ASSETS = 1037
EXPECTED_ENTITIES = 46
EXPECTED_PACKS = 11
RUNTIME_FIELDS = ("file", "shadow", "emissive", "factionMask", "spritesheet", "atlas", "preview")
CHUNK_SIZE = 1024 * 1024


class AuditError(RuntimeError):
    """Raised when the archive cannot be promoted safely."""


def archive_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(archive: zipfile.ZipFile, name: str) -> dict[str, Any]:
    try:
        return json.loads(archive.read(name).decode("utf-8"))
    except KeyError as error:
        raise AuditError(f"Arquivo obrigatório ausente no ZIP: {name}") from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AuditError(f"JSON inválido no ZIP: {name}: {error}") from error


def safe_members(archive: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
    members: list[zipfile.ZipInfo] = []
    for info in archive.infolist():
        path = PurePosixPath(info.filename)
        if path.is_absolute() or ".." in path.parts:
            raise AuditError(f"Entrada insegura no ZIP: {info.filename}")
        if not info.is_dir():
            members.append(info)
    return members


def runtime_candidates(asset: dict[str, Any], field: str) -> tuple[str, ...]:
    value = asset.get(field)
    if not isinstance(value, str) or not value:
        return ()
    provenance = asset.get("_provenance") or {}
    package_root = provenance.get("packageRoot")
    if not isinstance(package_root, str) or not package_root:
        return (value,)

    root = PurePosixPath(package_root)
    parts = list(root.parts)
    variants = [root]
    if len(parts) >= 2 and parts[0] == "packages":
        package = parts[1]
        if package.startswith("HOC_") and package.endswith("_FINAL"):
            parts[1] = package[len("HOC_") : -len("_FINAL")]
            variants.append(PurePosixPath(*parts))
    return tuple((variant / PurePosixPath(value)).as_posix() for variant in variants)


def resolve_reference(asset: dict[str, Any], field: str, names: set[str]) -> str | None:
    candidates = runtime_candidates(asset, field)
    if not candidates:
        return None
    for candidate in candidates:
        if candidate in names:
            return candidate

    value = str(asset[field])
    suffix_matches = sorted(name for name in names if name.endswith("/" + value) or name == value)
    if len(suffix_matches) == 1:
        return suffix_matches[0]
    return ""


def audit_archive(path: Path, report_path: Path | None = None) -> dict[str, Any]:
    path = path.expanduser().resolve()
    if not path.is_file() or not zipfile.is_zipfile(path):
        raise AuditError(f"ZIP inválido: {path}")

    with zipfile.ZipFile(path) as archive:
        members = safe_members(archive)
        names = {info.filename for info in members}
        if len(names) != len(members):
            raise AuditError("O ZIP contém nomes de arquivo duplicados.")

        manifest = read_json(archive, "pack-manifest.json")
        assets_registry = read_json(archive, "registry/assets-global.json")
        entities_registry = read_json(archive, "registry/entities-global.json")
        packs_registry = read_json(archive, "registry/packs-global.json")
        validation = read_json(archive, "validation/validation-report.json")

        if manifest.get("packId") != PACK_ID or assets_registry.get("packId") != PACK_ID:
            raise AuditError("Manifestos não pertencem ao PACK 99.")
        if manifest.get("signature") != SIGNATURE:
            raise AuditError("Assinatura institucional inválida.")
        if validation.get("passed") is not True:
            raise AuditError("Relatório global de validação não aprovado.")

        assets = assets_registry.get("assets")
        entities = entities_registry.get("entities")
        packs = packs_registry.get("packs")
        if not isinstance(assets, list) or len(assets) != EXPECTED_ASSETS:
            raise AuditError(f"Esperados {EXPECTED_ASSETS} assets canônicos.")
        if not isinstance(entities, list) or len(entities) != EXPECTED_ENTITIES:
            raise AuditError(f"Esperadas {EXPECTED_ENTITIES} entidades.")
        if not isinstance(packs, list) or len(packs) != EXPECTED_PACKS:
            raise AuditError(f"Esperados {EXPECTED_PACKS} packs.")

        ids = [asset.get("id") for asset in assets]
        if any(not isinstance(asset_id, str) or not asset_id for asset_id in ids):
            raise AuditError("Registro contém asset sem ID canônico.")
        if len(set(ids)) != EXPECTED_ASSETS:
            raise AuditError("Registro contém IDs duplicados.")

        unresolved: list[dict[str, str]] = []
        resolved_count = 0
        for asset in assets:
            for field in RUNTIME_FIELDS:
                if not asset.get(field):
                    continue
                resolved = resolve_reference(asset, field, names)
                if resolved:
                    resolved_count += 1
                else:
                    unresolved.append(
                        {"assetId": str(asset.get("id")), "field": field, "value": str(asset.get(field))}
                    )

        if unresolved:
            preview = ", ".join(f"{item['assetId']}:{item['field']}" for item in unresolved[:10])
            raise AuditError(f"{len(unresolved)} referências não resolvidas: {preview}")

        file_hashes: list[dict[str, Any]] = []
        for info in sorted(members, key=lambda item: item.filename):
            digest = hashlib.sha256()
            with archive.open(info) as handle:
                for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
                    digest.update(chunk)
            file_hashes.append({"path": info.filename, "bytes": info.file_size, "sha256": digest.hexdigest()})

    report = {
        "project": "Hexa Octarina Conquer",
        "packId": PACK_ID,
        "archive": path.name,
        "archiveBytes": path.stat().st_size,
        "archiveSha256": archive_sha256(path),
        "fileCount": len(file_hashes),
        "hashedFiles": len(file_hashes),
        "assets": EXPECTED_ASSETS,
        "entities": EXPECTED_ENTITIES,
        "packs": EXPECTED_PACKS,
        "resolvedRuntimeReferences": resolved_count,
        "unresolvedRuntimeReferences": 0,
        "files": file_hashes,
        "passed": True,
        "signature": SIGNATURE,
    }
    if report_path is not None:
        report_path = report_path.expanduser().resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audita integralmente o ZIP recuperado do PACK 99.")
    parser.add_argument("archive", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--summary-only", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        report = audit_archive(args.archive, args.report)
        output = {key: value for key, value in report.items() if key != "files"}
        print(json.dumps(output if args.summary_only else report, ensure_ascii=False, indent=2))
        print(SIGNATURE)
        return 0
    except (AuditError, OSError, zipfile.BadZipFile) as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
