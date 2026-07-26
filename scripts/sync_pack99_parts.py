#!/usr/bin/env python3
"""Download, assemble and install PACK 99 from independently hosted split packs.

The eleven production archives remain outside Git. A signed JSON manifest points to
HTTPS sources and immutable SHA-256 checksums. This command downloads each part,
reconstructs the recovered PACK 99 with scripts/assemble_pack99.py and delegates the
final installation to scripts/sync_pack99.py.

Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from assemble_pack99 import PACK_ARCHIVES, AssemblyError, assemble, safe_extract

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
RECOVERED_SHA256 = "e0a00bc450c0c80b4d9433f476b8377353433b0eb90318c9589b331923296c6d"
CHUNK_SIZE = 1024 * 1024
MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
MAX_METADATA_BYTES = 64 * 1024 * 1024


class PartsSyncError(RuntimeError):
    """Raised when a multipart PACK 99 source cannot be trusted or installed."""


@dataclass(frozen=True)
class RemoteFile:
    name: str
    url: str
    sha256: str
    max_bytes: int


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_sha256(value: str) -> str:
    normalized = value.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", normalized):
        raise PartsSyncError("SHA-256 inválido; informe 64 caracteres hexadecimais.")
    return normalized


def require_https(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise PartsSyncError(f"Origem remota deve usar HTTPS: {url!r}")
    return url


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise PartsSyncError(f"Manifesto não encontrado: {path}") from error
    except json.JSONDecodeError as error:
        raise PartsSyncError(f"Manifesto JSON inválido em {path}: {error}") from error
    if not isinstance(value, dict):
        raise PartsSyncError("O manifesto multipartes deve ser um objeto JSON.")
    return value


def validate_manifest(data: dict[str, Any]) -> tuple[RemoteFile, list[RemoteFile], str]:
    if data.get("packId") != PACK_ID:
        raise PartsSyncError("O manifesto não pertence ao PACK 99.")
    if data.get("signature") != SIGNATURE:
        raise PartsSyncError("Assinatura institucional do manifesto inválida.")

    metadata = data.get("metadata")
    if not isinstance(metadata, dict):
        raise PartsSyncError("Bloco metadata ausente no manifesto.")
    metadata_file = RemoteFile(
        name=str(metadata.get("name") or "HOC_PACK_99_METADATA.zip"),
        url=require_https(str(metadata.get("url") or "")),
        sha256=normalize_sha256(str(metadata.get("sha256") or "")),
        max_bytes=MAX_METADATA_BYTES,
    )

    archives = data.get("archives")
    if not isinstance(archives, list):
        raise PartsSyncError("Lista archives ausente no manifesto.")
    by_name: dict[str, RemoteFile] = {}
    for item in archives:
        if not isinstance(item, dict):
            raise PartsSyncError("Entrada inválida na lista archives.")
        name = str(item.get("name") or "")
        if name in by_name:
            raise PartsSyncError(f"Arquivo duplicado no manifesto: {name}")
        by_name[name] = RemoteFile(
            name=name,
            url=require_https(str(item.get("url") or "")),
            sha256=normalize_sha256(str(item.get("sha256") or "")),
            max_bytes=MAX_ARCHIVE_BYTES,
        )

    expected = set(PACK_ARCHIVES)
    received = set(by_name)
    if received != expected:
        missing = sorted(expected - received)
        extra = sorted(received - expected)
        raise PartsSyncError(f"Conjunto de packs divergente; ausentes={missing}, extras={extra}")

    recovered = data.get("recovered")
    recovered_sha = normalize_sha256(
        str(recovered.get("sha256") if isinstance(recovered, dict) else RECOVERED_SHA256)
    )
    return metadata_file, [by_name[name] for name in PACK_ARCHIVES], recovered_sha


def download_file(remote: RemoteFile, destination: Path, *, force: bool = False) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and not force:
        if destination.stat().st_size <= remote.max_bytes and file_sha256(destination) == remote.sha256:
            print(f"Cache verificado: {remote.name}")
            return destination
        destination.unlink(missing_ok=True)

    partial = destination.with_suffix(destination.suffix + ".part")
    partial.unlink(missing_ok=True)
    request = urllib.request.Request(
        remote.url,
        headers={"User-Agent": "Tehkne-HOC-Pack99-Parts/1.0"},
    )
    downloaded = 0
    try:
        with urllib.request.urlopen(request, timeout=180) as response, partial.open("wb") as output:
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > remote.max_bytes:
                raise PartsSyncError(f"Arquivo excede o limite permitido: {remote.name}")
            while True:
                chunk = response.read(CHUNK_SIZE)
                if not chunk:
                    break
                downloaded += len(chunk)
                if downloaded > remote.max_bytes:
                    raise PartsSyncError(f"Download excedeu o limite permitido: {remote.name}")
                output.write(chunk)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
        partial.unlink(missing_ok=True)
        if isinstance(error, PartsSyncError):
            raise
        raise PartsSyncError(f"Falha ao baixar {remote.name}: {error}") from error

    actual = file_sha256(partial)
    if actual != remote.sha256:
        partial.unlink(missing_ok=True)
        raise PartsSyncError(
            f"Checksum divergente em {remote.name}: esperado {remote.sha256}, recebido {actual}."
        )
    partial.replace(destination)
    print(f"Download validado: {remote.name}")
    return destination


def load_manifest(source: Path | None, url: str | None, cache_dir: Path, *, force: bool) -> Path:
    if source is not None:
        return source.expanduser().resolve()
    if not url:
        raise PartsSyncError(
            "Informe --manifest, --manifest-url ou configure PACK99_PARTS_MANIFEST_URL."
        )
    manifest_remote = RemoteFile(
        name="pack99-parts-manifest.json",
        url=require_https(url),
        sha256=normalize_sha256(os.getenv("PACK99_PARTS_MANIFEST_SHA256", "0" * 64)),
        max_bytes=2 * 1024 * 1024,
    )
    if manifest_remote.sha256 == "0" * 64:
        destination = cache_dir / manifest_remote.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "Tehkne-HOC-Pack99-Parts/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read(manifest_remote.max_bytes + 1)
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise PartsSyncError(f"Falha ao baixar o manifesto multipartes: {error}") from error
        if len(payload) > manifest_remote.max_bytes:
            raise PartsSyncError("Manifesto multipartes excede 2 MB.")
        destination.write_bytes(payload)
        return destination
    return download_file(manifest_remote, cache_dir / manifest_remote.name, force=force)


def sync_command(
    repo_root: Path,
    archive: Path,
    checksum: str,
    *,
    target: str,
    profile: str,
    clean: bool,
    dry_run: bool,
) -> list[str]:
    command = [
        sys.executable,
        str(repo_root / "scripts" / "sync_pack99.py"),
        "--source",
        str(archive),
        "--expected-sha256",
        checksum,
        "--repo",
        str(repo_root),
        "--target",
        target,
        "--profile",
        profile,
    ]
    if clean:
        command.append("--clean")
    if dry_run:
        command.append("--dry-run")
    return command


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sincroniza o PACK 99 pelos onze packs finais.")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--manifest", type=Path, help="Manifesto multipartes local")
    source.add_argument("--manifest-url", help="URL HTTPS do manifesto multipartes")
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/pack99-parts"))
    parser.add_argument("--target", choices=("all", "web", "godot"), default="all")
    parser.add_argument("--profile", choices=("core", "full"), default="core")
    parser.add_argument("--force-download", action="store_true")
    parser.add_argument("--clean", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    repo_root = args.repo.expanduser().resolve()
    cache_dir = args.cache_dir
    if not cache_dir.is_absolute():
        cache_dir = repo_root / cache_dir
    manifest_url = args.manifest_url or os.getenv("PACK99_PARTS_MANIFEST_URL")

    temporary_root: Path | None = None
    try:
        manifest_path = load_manifest(args.manifest, manifest_url, cache_dir, force=args.force_download)
        metadata_remote, archive_remotes, recovered_sha = validate_manifest(read_json(manifest_path))

        parts_dir = cache_dir / "parts"
        metadata_archive = download_file(
            metadata_remote,
            parts_dir / metadata_remote.name,
            force=args.force_download,
        )
        for remote in archive_remotes:
            download_file(remote, parts_dir / remote.name, force=args.force_download)

        temporary_root = Path(tempfile.mkdtemp(prefix="hoc-pack99-metadata-"))
        safe_extract(metadata_archive, temporary_root)
        metadata_candidates = [
            temporary_root,
            *[path for path in temporary_root.iterdir() if path.is_dir()],
        ]
        metadata_dir = next(
            (path for path in metadata_candidates if (path / "pack-manifest.json").is_file()),
            None,
        )
        if metadata_dir is None:
            raise PartsSyncError("O ZIP de metadados não contém pack-manifest.json.")

        assembled = cache_dir / "HOC_PACK_99_FINAL_RUNTIME_RECOVERED.zip"
        report = assemble(parts_dir, metadata_dir, assembled)
        if report.get("sha256") != recovered_sha:
            raise PartsSyncError(
                "Checksum do PACK 99 reconstruído diverge do manifesto: "
                f"esperado {recovered_sha}, recebido {report.get('sha256')}."
            )

        command = sync_command(
            repo_root,
            assembled,
            recovered_sha,
            target=args.target,
            profile=args.profile,
            clean=args.clean,
            dry_run=args.dry_run,
        )
        completed = subprocess.run(command, cwd=repo_root, check=False)
        if completed.returncode != 0:
            raise PartsSyncError(
                f"A instalação integral terminou com código {completed.returncode}."
            )
        print("Sincronização multipartes do PACK 99 aprovada.")
        print(SIGNATURE)
        return 0
    except (PartsSyncError, AssemblyError, OSError, zipfile.BadZipFile) as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 2
    finally:
        if temporary_root:
            shutil.rmtree(temporary_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
