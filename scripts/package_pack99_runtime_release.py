#!/usr/bin/env python3
"""Package a validated PACK 99 runtime as a deterministic Release archive.

The archive is rooted at the runtime directory so production consumers can
extract it directly into `client/web/public/assets/runtime` or the equivalent
Godot location. Images and audio are already compressed, therefore ZIP_STORED
avoids expensive recompression and keeps publication deterministic.

Signature: Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
EXPECTED_CANONICAL_ASSETS = 1037
CHUNK_SIZE = 1024 * 1024
ZIP_TIMESTAMP = (2026, 1, 1, 0, 0, 0)


class ReleasePackageError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ReleasePackageError(f"Arquivo obrigatório ausente: {path}") from error
    except json.JSONDecodeError as error:
        raise ReleasePackageError(f"JSON inválido em {path}: {error}") from error
    if not isinstance(value, dict):
        raise ReleasePackageError(f"O JSON deve ser um objeto: {path}")
    return value


def validate_runtime(runtime_root: Path, expected_count: int) -> dict[str, Any]:
    install = read_json(runtime_root / "runtime-install.json")
    registry = read_json(runtime_root / "registry" / "assets-runtime.json")
    index = read_json(runtime_root / "pack99" / "runtime-index.json")
    for document, label in ((install, "manifesto"), (registry, "registro"), (index, "índice")):
        if document.get("packId") != PACK_ID:
            raise ReleasePackageError(f"{label} não pertence ao PACK 99")
        if document.get("signature") != SIGNATURE:
            raise ReleasePackageError(f"Assinatura institucional inválida no {label}")
    if install.get("profile") != "full" or registry.get("profile") != "full" or index.get("runtimeMode") != "full":
        raise ReleasePackageError("A Release exige runtime full")
    assets = registry.get("assets")
    indexed = index.get("assets")
    if not isinstance(assets, list) or len(assets) != expected_count:
        raise ReleasePackageError(f"Registro deve conter {expected_count} IDs canônicos")
    if int(index.get("canonicalAssetCount", -1)) != expected_count:
        raise ReleasePackageError(f"Índice deve declarar {expected_count} IDs canônicos")
    if not isinstance(indexed, list) or len(indexed) < expected_count:
        raise ReleasePackageError("Índice premium não materializou todos os IDs")
    if int(install.get("unresolvedReferences", -1)) != 0:
        raise ReleasePackageError("Runtime possui referências não resolvidas")
    for entry in indexed:
        if not isinstance(entry, dict):
            raise ReleasePackageError("Entrada inválida no índice premium")
        source = entry.get("sourcePath")
        if not isinstance(source, str) or not source:
            raise ReleasePackageError("Entrada do índice sem sourcePath")
        relative = PurePosixPath(source.replace("\\", "/"))
        if relative.is_absolute() or ".." in relative.parts:
            raise ReleasePackageError(f"Caminho inseguro no índice: {source}")
        if not (runtime_root / Path(*relative.parts)).is_file():
            raise ReleasePackageError(f"Payload indexado ausente: {source}")
    return {
        "version": install.get("version", "1.0.2"),
        "canonicalAssetCount": expected_count,
        "materializedAssetCount": len(indexed),
    }


def iter_runtime_files(runtime_root: Path) -> list[Path]:
    files: list[Path] = []
    for path in runtime_root.rglob("*"):
        if path.is_symlink():
            raise ReleasePackageError(f"Links simbólicos não são permitidos: {path}")
        if path.is_file():
            relative = path.relative_to(runtime_root)
            normalized = PurePosixPath(*relative.parts)
            if normalized.is_absolute() or ".." in normalized.parts:
                raise ReleasePackageError(f"Caminho inseguro no runtime: {relative}")
            files.append(path)
    files.sort(key=lambda item: item.relative_to(runtime_root).as_posix())
    if not files:
        raise ReleasePackageError("Runtime vazio")
    return files


def write_deterministic_zip(runtime_root: Path, output: Path) -> dict[str, Any]:
    runtime_root = runtime_root.resolve()
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    files = iter_runtime_files(runtime_root)
    temporary: Path | None = None
    try:
        descriptor, name = tempfile.mkstemp(prefix=f".{output.name}.", suffix=".partial", dir=output.parent)
        os.close(descriptor)
        temporary = Path(name)
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            for path in files:
                relative = path.relative_to(runtime_root).as_posix()
                info = zipfile.ZipInfo(relative, ZIP_TIMESTAMP)
                info.compress_type = zipfile.ZIP_STORED
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                with path.open("rb") as source, archive.open(info, "w", force_zip64=True) as destination:
                    while chunk := source.read(CHUNK_SIZE):
                        destination.write(chunk)
        with zipfile.ZipFile(temporary, "r") as archive:
            corrupt = archive.testzip()
            if corrupt:
                raise ReleasePackageError(f"Arquivo corrompido no ZIP: {corrupt}")
            if len(archive.infolist()) != len(files):
                raise ReleasePackageError("Contagem de arquivos divergente no ZIP")
        os.replace(temporary, output)
        temporary = None
    finally:
        if temporary and temporary.exists():
            temporary.unlink()

    return {
        "archive": output.name,
        "fileCount": len(files),
        "bytes": output.stat().st_size,
        "sha256": sha256_file(output),
    }


def package_runtime(runtime_root: Path, output: Path, *, target: str, expected_count: int = EXPECTED_CANONICAL_ASSETS) -> dict[str, Any]:
    validation = validate_runtime(runtime_root, expected_count)
    archive = write_deterministic_zip(runtime_root, output)
    checksum_path = output.with_suffix(output.suffix + ".sha256")
    checksum_path.write_text(f"{archive['sha256']}  {output.name}\n", encoding="utf-8")
    report = {
        "project": "Hexa Octarina Conquer",
        "packId": PACK_ID,
        "target": target,
        "profile": "full",
        **validation,
        **archive,
        "checksumFile": checksum_path.name,
        "passed": True,
        "signature": SIGNATURE,
    }
    report_path = output.with_suffix(output.suffix + ".report.json")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Empacota o runtime full do PACK 99 para GitHub Release.")
    parser.add_argument("--runtime-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--target", choices=("web", "godot"), required=True)
    args = parser.parse_args()
    try:
        report = package_runtime(args.runtime_root, args.output, target=args.target)
    except (ReleasePackageError, OSError, ValueError, zipfile.BadZipFile) as error:
        print(f"PACK99_RELEASE_PACKAGE=FAILED\nERROR={error}\nSIGNATURE={SIGNATURE}", file=sys.stderr)
        return 2
    print("PACK99_RELEASE_PACKAGE=PASSED")
    print(f"TARGET={report['target']}")
    print(f"FILES={report['fileCount']}")
    print(f"BYTES={report['bytes']}")
    print(f"SHA256={report['sha256']}")
    print(f"SIGNATURE={SIGNATURE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
