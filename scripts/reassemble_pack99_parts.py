#!/usr/bin/env python3
"""Reassemble a fragmented PACK 99 archive with atomic validation.

Signature: Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any
from zipfile import BadZipFile, ZipFile

SIGNATURE = "Tehkné Solutions"
CHUNK_SIZE = 1024 * 1024


class ReassemblyError(RuntimeError):
    """Raised when a fragmented release cannot be trusted."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def require_hex_sha256(value: Any, label: str) -> str:
    if not isinstance(value, str) or len(value) != 64:
        raise ReassemblyError(f"{label} deve conter um SHA-256 de 64 caracteres")
    lowered = value.lower()
    if any(character not in "0123456789abcdef" for character in lowered):
        raise ReassemblyError(f"{label} contém caracteres inválidos")
    return lowered


def safe_part_name(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ReassemblyError("Nome de parte ausente")
    name = value.strip()
    path = PurePosixPath(name.replace("\\", "/"))
    if path.is_absolute() or len(path.parts) != 1 or path.name in {".", ".."}:
        raise ReassemblyError(f"Nome de parte inseguro: {name}")
    return path.name


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ReassemblyError(f"Manifesto inválido: {error}") from error

    if not isinstance(manifest, dict):
        raise ReassemblyError("O manifesto deve ser um objeto JSON")

    artifact = safe_part_name(manifest.get("artifact"))
    total_bytes = manifest.get("bytes")
    if not isinstance(total_bytes, int) or total_bytes <= 0:
        raise ReassemblyError("bytes deve ser um inteiro positivo")
    archive_sha = require_hex_sha256(manifest.get("sha256"), "sha256 final")

    parts = manifest.get("parts")
    if not isinstance(parts, list) or not parts:
        raise ReassemblyError("O manifesto não contém partes")

    normalized_parts: list[dict[str, Any]] = []
    used_names: set[str] = set()
    used_orders: set[int] = set()
    for raw in parts:
        if not isinstance(raw, dict):
            raise ReassemblyError("Cada parte deve ser um objeto JSON")
        name = safe_part_name(raw.get("name"))
        order = raw.get("order")
        size = raw.get("bytes")
        if not isinstance(order, int) or order <= 0:
            raise ReassemblyError(f"Ordem inválida para {name}")
        if not isinstance(size, int) or size <= 0:
            raise ReassemblyError(f"Tamanho inválido para {name}")
        if name in used_names:
            raise ReassemblyError(f"Parte duplicada: {name}")
        if order in used_orders:
            raise ReassemblyError(f"Ordem duplicada: {order}")
        used_names.add(name)
        used_orders.add(order)
        normalized_parts.append(
            {
                "name": name,
                "order": order,
                "bytes": size,
                "sha256": require_hex_sha256(raw.get("sha256"), f"sha256 de {name}"),
            }
        )

    normalized_parts.sort(key=lambda item: item["order"])
    expected_orders = list(range(1, len(normalized_parts) + 1))
    actual_orders = [item["order"] for item in normalized_parts]
    if actual_orders != expected_orders:
        raise ReassemblyError(
            f"Sequência de partes incompleta: esperado {expected_orders}, recebido {actual_orders}"
        )

    if sum(item["bytes"] for item in normalized_parts) != total_bytes:
        raise ReassemblyError("A soma dos tamanhos das partes difere do tamanho final")

    return {
        **manifest,
        "artifact": artifact,
        "bytes": total_bytes,
        "sha256": archive_sha,
        "parts": normalized_parts,
    }


def validate_parts(manifest: dict[str, Any], parts_dir: Path) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for part in manifest["parts"]:
        path = parts_dir / part["name"]
        if not path.is_file():
            raise ReassemblyError(f"Parte ausente: {path}")
        actual_bytes = path.stat().st_size
        if actual_bytes != part["bytes"]:
            raise ReassemblyError(
                f"Tamanho incorreto em {part['name']}: esperado {part['bytes']}, recebido {actual_bytes}"
            )
        actual_sha = sha256_file(path)
        if actual_sha != part["sha256"]:
            raise ReassemblyError(
                f"SHA-256 incorreto em {part['name']}: esperado {part['sha256']}, recebido {actual_sha}"
            )
        results.append(
            {
                "name": part["name"],
                "order": part["order"],
                "bytes": actual_bytes,
                "sha256": actual_sha,
                "passed": True,
            }
        )
    return results


def validate_zip_archive(path: Path) -> dict[str, Any]:
    try:
        with ZipFile(path) as archive:
            names = archive.namelist()
            if not names:
                raise ReassemblyError("O ZIP remontado está vazio")
            seen: set[str] = set()
            for name in names:
                normalized = PurePosixPath(name.replace("\\", "/"))
                if normalized.is_absolute() or ".." in normalized.parts:
                    raise ReassemblyError(f"Entrada insegura no ZIP: {name}")
                canonical = normalized.as_posix().lower()
                if canonical in seen:
                    raise ReassemblyError(f"Entrada duplicada no ZIP: {name}")
                seen.add(canonical)
            corrupt = archive.testzip()
            if corrupt:
                raise ReassemblyError(f"Entrada corrompida no ZIP: {corrupt}")
            required = {
                "pack-manifest.json",
                "registry/assets-global.json",
                "registry/entities-global.json",
                "registry/packs-global.json",
            }
            missing = sorted(required.difference(names))
            if missing:
                raise ReassemblyError(f"Entradas canônicas ausentes no ZIP: {missing}")
            return {"entryCount": len(names), "requiredEntries": sorted(required), "passed": True}
    except BadZipFile as error:
        raise ReassemblyError(f"ZIP remontado inválido: {error}") from error


def reassemble(
    manifest_path: Path,
    parts_dir: Path,
    output: Path | None = None,
    report_path: Path | None = None,
    audit_zip: bool = True,
) -> dict[str, Any]:
    manifest = load_manifest(manifest_path)
    parts_dir = parts_dir.resolve()
    if not parts_dir.is_dir():
        raise ReassemblyError(f"Diretório de partes não encontrado: {parts_dir}")

    output = (output or (parts_dir / manifest["artifact"])).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.name != manifest["artifact"]:
        raise ReassemblyError(
            f"O nome do arquivo final deve ser {manifest['artifact']}, recebido {output.name}"
        )

    part_results = validate_parts(manifest, parts_dir)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", prefix=f".{output.name}.", suffix=".partial", dir=output.parent, delete=False
        ) as destination:
            temporary = Path(destination.name)
            for part in manifest["parts"]:
                with (parts_dir / part["name"]).open("rb") as source:
                    shutil.copyfileobj(source, destination, length=CHUNK_SIZE)
            destination.flush()
            os.fsync(destination.fileno())

        actual_bytes = temporary.stat().st_size
        if actual_bytes != manifest["bytes"]:
            raise ReassemblyError(
                f"Tamanho final incorreto: esperado {manifest['bytes']}, recebido {actual_bytes}"
            )
        actual_sha = sha256_file(temporary)
        if actual_sha != manifest["sha256"]:
            raise ReassemblyError(
                f"SHA-256 final incorreto: esperado {manifest['sha256']}, recebido {actual_sha}"
            )

        zip_result = validate_zip_archive(temporary) if audit_zip else None
        os.replace(temporary, output)
        temporary = None

        report = {
            "project": manifest.get("project", "Hexa Octarina Conquer"),
            "artifact": output.name,
            "output": str(output),
            "bytes": actual_bytes,
            "sha256": actual_sha,
            "partCount": len(part_results),
            "parts": part_results,
            "zipAudit": zip_result,
            "passed": True,
            "signature": SIGNATURE,
        }
        report_path = (report_path or output.with_suffix(output.suffix + ".reassembly-report.json")).resolve()
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return report
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remonta e valida o PACK 99 dividido em partes.")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--parts-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--skip-zip-audit", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        report = reassemble(
            manifest_path=args.manifest,
            parts_dir=args.parts_dir,
            output=args.output,
            report_path=args.report,
            audit_zip=not args.skip_zip_audit,
        )
    except ReassemblyError as error:
        print(f"PACK99_REASSEMBLY=FAILED\nERROR={error}\nSIGNATURE={SIGNATURE}", file=sys.stderr)
        return 2

    print("PACK99_REASSEMBLY=PASSED")
    print(f"ARTIFACT={report['artifact']}")
    print(f"BYTES={report['bytes']}")
    print(f"SHA256={report['sha256']}")
    print(f"PARTS={report['partCount']}")
    print(f"SIGNATURE={SIGNATURE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
