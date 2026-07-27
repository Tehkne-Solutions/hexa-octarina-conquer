#!/usr/bin/env python3
"""Audit one HOC asset pack before progressive promotion.

The auditor is intentionally independent from PACK 99. Each PACK 00–10 must
pass its own integrity, manifest, registry, checksum and reference gates.

Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

SIGNATURE = "Tehkné Solutions"
PACK00_ID = "HOC_PACK_00_FOUNDATION"
PACK00_REQUIRED = {
    "README.md",
    "STYLE_LOCK_01.png",
    "pack-manifest.json",
    "registry/assets-registry.json",
    "registry/pack-registry.json",
    "specs/art-bible.json",
    "specs/naming-conventions.json",
    "specs/runtime-contract.json",
    "validation/validation-report.json",
    "SHA256SUMS.txt",
    "LICENSE-ASSETS.md",
    "CHANGELOG.md",
}
ID_PATTERN = re.compile(r"^[A-Z0-9]+(?:_[A-Z0-9]+)*_[0-9]{2}$")


class AuditError(RuntimeError):
    pass


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(archive: zipfile.ZipFile, name: str) -> dict[str, Any]:
    try:
        return json.loads(archive.read(name).decode("utf-8"))
    except KeyError as exc:
        raise AuditError(f"Arquivo obrigatório ausente: {name}") from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AuditError(f"JSON inválido: {name}: {exc}") from exc


def png_dimensions(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AuditError("STYLE_LOCK_01.png não é um PNG válido.")
    return struct.unpack(">II", data[16:24])


def validate_paths(names: list[str]) -> None:
    for name in names:
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts:
            raise AuditError(f"Caminho inseguro no ZIP: {name}")
        if "\\" in name:
            raise AuditError(f"Separador inválido no ZIP: {name}")


def validate_checksums(archive: zipfile.ZipFile, names: set[str]) -> tuple[int, list[str]]:
    if "SHA256SUMS.txt" not in names:
        raise AuditError("SHA256SUMS.txt ausente.")
    lines = archive.read("SHA256SUMS.txt").decode("utf-8").splitlines()
    checked = 0
    errors: list[str] = []
    for line_number, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line:
            continue
        parts = line.split("  ", 1)
        if len(parts) != 2 or not re.fullmatch(r"[0-9a-f]{64}", parts[0]):
            errors.append(f"Linha {line_number} inválida em SHA256SUMS.txt")
            continue
        expected, filename = parts
        if filename not in names:
            errors.append(f"Checksum aponta para arquivo ausente: {filename}")
            continue
        actual = sha256_bytes(archive.read(filename))
        if actual != expected:
            errors.append(f"Checksum divergente: {filename}")
        checked += 1
    return checked, errors


def audit_pack00(archive: zipfile.ZipFile, names: set[str]) -> dict[str, Any]:
    missing = sorted(PACK00_REQUIRED - names)
    if missing:
        raise AuditError("PACK 00 incompleto; ausentes: " + ", ".join(missing))

    manifest = read_json(archive, "pack-manifest.json")
    if manifest.get("packId") != PACK00_ID:
        raise AuditError(f"packId inválido: {manifest.get('packId')!r}")
    if manifest.get("signature") != SIGNATURE:
        raise AuditError("Assinatura do manifesto inválida.")
    if manifest.get("status") != "runtime_ready":
        raise AuditError("PACK 00 precisa estar em status runtime_ready.")
    if manifest.get("runtimeAssetCount") != 0:
        raise AuditError("PACK 00 não pode declarar assets de gameplay.")

    assets = read_json(archive, "registry/assets-registry.json")
    if assets.get("signature") != SIGNATURE:
        raise AuditError("Assinatura do registro de assets inválida.")
    entries = assets.get("assets")
    if not isinstance(entries, list) or len(entries) != 1:
        raise AuditError("PACK 00 deve registrar exatamente uma referência visual.")
    asset = entries[0]
    if asset.get("id") != "REF_STYLE_LOCK_01" or asset.get("runtime") is not False:
        raise AuditError("Style Lock precisa ser referência não-runtime.")
    if not ID_PATTERN.fullmatch(str(asset.get("id", ""))):
        raise AuditError("ID da referência não segue a convenção canônica.")
    style_data = archive.read("STYLE_LOCK_01.png")
    width, height = png_dimensions(style_data)
    if [width, height] != [asset.get("width"), asset.get("height")]:
        raise AuditError("Dimensões do Style Lock divergem do registro.")
    if sha256_bytes(style_data) != asset.get("sha256"):
        raise AuditError("SHA-256 do Style Lock diverge do registro.")

    validation = read_json(archive, "validation/validation-report.json")
    if validation.get("passed") is not True or validation.get("signature") != SIGNATURE:
        raise AuditError("Relatório de validação do PACK 00 não está aprovado.")

    contract = read_json(archive, "specs/runtime-contract.json")
    if contract.get("signature") != SIGNATURE:
        raise AuditError("Contrato runtime sem assinatura institucional.")
    requirements = contract.get("requirements", {})
    for key in ("canonicalIdsIdentical", "zeroUnresolvedReferences", "referenceOnlyAssetsExcludedFromRuntime"):
        if requirements.get(key) is not True:
            raise AuditError(f"Contrato runtime não exige {key}.")

    checked, checksum_errors = validate_checksums(archive, names)
    if checksum_errors:
        raise AuditError("; ".join(checksum_errors))

    return {
        "packId": PACK00_ID,
        "version": manifest.get("version"),
        "status": manifest.get("status"),
        "runtimeAssets": 0,
        "referenceAssets": 1,
        "styleLock": {
            "width": width,
            "height": height,
            "sha256": sha256_bytes(style_data),
        },
        "checksumsValidated": checked,
    }


def audit(path: Path) -> dict[str, Any]:
    if not path.is_file() or not zipfile.is_zipfile(path):
        raise AuditError(f"ZIP inválido ou ausente: {path}")
    archive_sha = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as archive:
        corrupt = archive.testzip()
        if corrupt:
            raise AuditError(f"Entrada corrompida: {corrupt}")
        names_list = [item.filename for item in archive.infolist() if not item.is_dir()]
        validate_paths(names_list)
        names = set(names_list)
        manifest = read_json(archive, "pack-manifest.json")
        pack_id = manifest.get("packId")
        if pack_id != PACK00_ID:
            raise AuditError(f"Este estágio aceita somente {PACK00_ID}; recebido {pack_id!r}.")
        pack_report = audit_pack00(archive, names)
        return {
            "passed": True,
            "archive": path.name,
            "archiveBytes": path.stat().st_size,
            "archiveSha256": archive_sha,
            "entries": len(names_list),
            "unsafePaths": 0,
            "pack": pack_report,
            "signature": SIGNATURE,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Audita um pack progressivo HOC.")
    parser.add_argument("archive", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        report = audit(args.archive.expanduser().resolve())
    except AuditError as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 2
    payload = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(payload, encoding="utf-8")
    print(payload, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
