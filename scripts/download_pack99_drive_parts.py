#!/usr/bin/env python3
"""Download and verify the private Google Drive fragments of PACK 99.

The workflow authenticates with Google and provides a short-lived OAuth token.
No long-lived credential is parsed, stored or logged by this script.

Signature: Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path, PurePosixPath
from typing import Any

SIGNATURE = "Tehkné Solutions"
CHUNK_SIZE = 1024 * 1024
SHA_RE = re.compile(r"^[0-9a-f]{64}$")
ID_RE = re.compile(r"^[A-Za-z0-9_-]{10,}$")


class DriveSourceError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def safe_name(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise DriveSourceError("Nome de arquivo ausente")
    path = PurePosixPath(value.replace("\\", "/"))
    if path.is_absolute() or len(path.parts) != 1 or path.name in {".", ".."}:
        raise DriveSourceError(f"Nome de arquivo inseguro: {value}")
    return path.name


def require_sha(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SHA_RE.fullmatch(value.lower()):
        raise DriveSourceError(f"{label} inválido")
    return value.lower()


def load_source(path: Path) -> dict[str, Any]:
    try:
        source = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise DriveSourceError(f"Contrato de origem inválido: {error}") from error
    if not isinstance(source, dict) or source.get("provider") != "google-drive":
        raise DriveSourceError("O contrato deve usar provider google-drive")
    if source.get("signature") != SIGNATURE:
        raise DriveSourceError("Assinatura institucional inválida")

    artifact = safe_name(source.get("artifact"))
    total_bytes = source.get("bytes")
    if not isinstance(total_bytes, int) or total_bytes <= 0:
        raise DriveSourceError("Tamanho final inválido")
    final_sha = require_sha(source.get("sha256"), "SHA-256 final")
    raw_parts = source.get("parts")
    if not isinstance(raw_parts, list) or not raw_parts:
        raise DriveSourceError("O contrato não contém partes")

    names: set[str] = set()
    ids: set[str] = set()
    orders: set[int] = set()
    parts: list[dict[str, Any]] = []
    for raw in raw_parts:
        if not isinstance(raw, dict):
            raise DriveSourceError("Parte inválida no contrato")
        name = safe_name(raw.get("name"))
        file_id = raw.get("fileId")
        order = raw.get("order")
        size = raw.get("bytes")
        if not isinstance(file_id, str) or not ID_RE.fullmatch(file_id):
            raise DriveSourceError(f"fileId inválido para {name}")
        if not isinstance(order, int) or order <= 0:
            raise DriveSourceError(f"Ordem inválida para {name}")
        if not isinstance(size, int) or size <= 0:
            raise DriveSourceError(f"Tamanho inválido para {name}")
        if name in names or file_id in ids or order in orders:
            raise DriveSourceError(f"Parte, fileId ou ordem duplicada: {name}")
        names.add(name)
        ids.add(file_id)
        orders.add(order)
        parts.append({
            "name": name,
            "fileId": file_id,
            "order": order,
            "bytes": size,
            "sha256": require_sha(raw.get("sha256"), f"SHA-256 de {name}"),
        })

    parts.sort(key=lambda item: item["order"])
    if [item["order"] for item in parts] != list(range(1, len(parts) + 1)):
        raise DriveSourceError("Sequência de partes incompleta")
    if sum(item["bytes"] for item in parts) != total_bytes:
        raise DriveSourceError("A soma das partes difere do tamanho final")
    return {**source, "artifact": artifact, "bytes": total_bytes, "sha256": final_sha, "parts": parts}


def reassembly_manifest(source: dict[str, Any]) -> dict[str, Any]:
    return {
        "project": source.get("project", "Hexa Octarina Conquer"),
        "artifact": source["artifact"],
        "bytes": source["bytes"],
        "sha256": source["sha256"],
        "parts": [
            {key: part[key] for key in ("name", "order", "bytes", "sha256")}
            for part in source["parts"]
        ],
        "signature": SIGNATURE,
    }


def valid_cached(path: Path, part: dict[str, Any]) -> bool:
    return path.is_file() and path.stat().st_size == part["bytes"] and sha256_file(path) == part["sha256"]


def download_part(part: dict[str, Any], destination: Path, token: str, force: bool) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not force and valid_cached(destination, part):
        return "cached"
    partial = destination.with_name(f".{destination.name}.download")
    partial.unlink(missing_ok=True)
    url = f"https://www.googleapis.com/drive/v3/files/{part['fileId']}?alt=media&supportsAllDrives=true"
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "User-Agent": "Tehkne-HOC-Pack99/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=180) as response, partial.open("wb") as output:
            while chunk := response.read(CHUNK_SIZE):
                output.write(chunk)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        partial.unlink(missing_ok=True)
        raise DriveSourceError(f"Falha ao baixar {part['name']}: {error}") from error

    try:
        if partial.stat().st_size != part["bytes"]:
            raise DriveSourceError(f"Tamanho incorreto em {part['name']}")
        if sha256_file(partial) != part["sha256"]:
            raise DriveSourceError(f"SHA-256 incorreto em {part['name']}")
        os.replace(partial, destination)
        return "downloaded"
    finally:
        partial.unlink(missing_ok=True)


def download_source(source_path: Path, destination: Path, token: str, force: bool) -> dict[str, Any]:
    source = load_source(source_path)
    destination.mkdir(parents=True, exist_ok=True)
    results = []
    for part in source["parts"]:
        status = download_part(part, destination / part["name"], token, force)
        results.append({"name": part["name"], "status": status, "passed": True})
        print(f"{part['order']}/{len(source['parts'])} {part['name']}: {status}")

    manifest_path = destination / "HOC_PACK_99_RELEASE_PARTS_MANIFEST.json"
    manifest_path.write_text(json.dumps(reassembly_manifest(source), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {
        "project": source.get("project"),
        "artifact": source["artifact"],
        "bytes": source["bytes"],
        "sha256": source["sha256"],
        "partCount": len(results),
        "parts": results,
        "manifest": str(manifest_path),
        "passed": True,
        "signature": SIGNATURE,
    }
    (destination / "drive-download-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Baixa e valida as partes privadas do PACK 99.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--destination", type=Path, required=True)
    parser.add_argument("--token-env", default="PACK99_DRIVE_ACCESS_TOKEN")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    token = os.getenv(args.token_env, "").strip()
    if not token:
        print(f"Erro: configure {args.token_env} com um token OAuth temporário.", file=sys.stderr)
        return 2
    try:
        report = download_source(args.source, args.destination, token, args.force)
    except DriveSourceError as error:
        print(f"PACK99_DRIVE_DOWNLOAD=FAILED\nERROR={error}\nSIGNATURE={SIGNATURE}", file=sys.stderr)
        return 2
    print("PACK99_DRIVE_DOWNLOAD=PASSED")
    print(f"PARTS={report['partCount']}")
    print(f"SHA256={report['sha256']}")
    print(f"SIGNATURE={SIGNATURE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
