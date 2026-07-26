#!/usr/bin/env python3
"""Download, validate and install the complete HOC PACK 99 runtime.

The archive remains outside Git. This command accepts a local source or a private
HTTPS URL, validates the official SHA-256, delegates installation to
scripts/install_pack99.py and verifies the generated runtime manifests.

Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
ARCHIVE_NAME = "HOC_PACK_99_FINAL_RUNTIME.zip"
OFFICIAL_SHA256 = "d749943cdb8c8e8afa6bbe21f2c6558e3816371fc44e7cb2dbedb63157185575"
EXPECTED_MINIMUM_ASSETS = {"core": 597, "full": 1037}
CHUNK_SIZE = 1024 * 1024


class SyncError(RuntimeError):
    """Raised when PACK 99 cannot be downloaded, validated or installed."""


@dataclass(frozen=True)
class TargetResult:
    target: str
    profile: str
    asset_count: int
    unresolved_references: int
    manifest: str


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_sha256(value: str) -> str:
    normalized = value.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", normalized):
        raise SyncError("SHA-256 inválido; informe exatamente 64 caracteres hexadecimais.")
    return normalized


def verify_archive(path: Path, expected_sha256: str) -> str:
    if not path.is_file():
        raise SyncError(f"Arquivo do PACK 99 não encontrado: {path}")
    expected = normalize_sha256(expected_sha256)
    actual = file_sha256(path)
    if actual != expected:
        raise SyncError(
            "Checksum do PACK 99 não confere: "
            f"esperado {expected}, recebido {actual}."
        )
    return actual


def download_archive(url: str, destination: Path, expected_sha256: str, *, force: bool) -> Path:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise SyncError("A origem remota do PACK 99 deve usar HTTPS.")

    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and not force:
        try:
            verify_archive(destination, expected_sha256)
            print(f"Cache verificado: {destination}")
            return destination
        except SyncError:
            destination.unlink(missing_ok=True)

    partial = destination.with_suffix(destination.suffix + ".part")
    partial.unlink(missing_ok=True)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Tehkne-HOC-Pack99-Sync/1.0"},
    )
    print(f"Baixando {ARCHIVE_NAME} por canal HTTPS protegido...")
    try:
        with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as output:
            while True:
                chunk = response.read(CHUNK_SIZE)
                if not chunk:
                    break
                output.write(chunk)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        partial.unlink(missing_ok=True)
        raise SyncError(f"Falha ao baixar o PACK 99: {error}") from error

    partial.replace(destination)
    try:
        verify_archive(destination, expected_sha256)
    except SyncError:
        destination.unlink(missing_ok=True)
        raise
    print(f"Download validado por SHA-256: {destination}")
    return destination


def installer_command(
    repo_root: Path,
    archive: Path,
    *,
    target: str,
    profile: str,
    clean: bool,
    dry_run: bool,
) -> list[str]:
    command = [
        sys.executable,
        str(repo_root / "scripts" / "install_pack99.py"),
        str(archive),
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


def target_destinations(repo_root: Path, target: str) -> Iterable[tuple[str, Path]]:
    if target in ("godot", "all"):
        yield "godot", repo_root / "client" / "godot" / "assets" / "runtime"
    if target in ("web", "all"):
        yield "web", repo_root / "client" / "web" / "public" / "assets" / "runtime"


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise SyncError(f"Manifesto de instalação ausente: {path}") from error
    except json.JSONDecodeError as error:
        raise SyncError(f"Manifesto JSON inválido em {path}: {error}") from error


def validate_install_manifest(path: Path, profile: str) -> TargetResult:
    data = read_json(path)
    if data.get("packId") != PACK_ID:
        raise SyncError(f"Runtime instalado não pertence ao {PACK_ID}: {path}")
    if data.get("signature") != SIGNATURE:
        raise SyncError(f"Assinatura institucional inválida: {path}")
    if data.get("profile") != profile:
        raise SyncError(
            f"Perfil instalado divergente em {path}: "
            f"esperado {profile}, recebido {data.get('profile')!r}."
        )

    asset_count = int(data.get("assetCount", 0))
    minimum = EXPECTED_MINIMUM_ASSETS[profile]
    if asset_count < minimum:
        raise SyncError(
            f"Cobertura insuficiente em {path}: {asset_count} assets; mínimo {minimum}."
        )
    unresolved = int(data.get("unresolvedReferences", -1))
    if unresolved != 0:
        raise SyncError(f"Runtime possui {unresolved} referências não resolvidas: {path}")

    target = "godot" if "/godot/" in path.as_posix() else "web"
    return TargetResult(
        target=target,
        profile=profile,
        asset_count=asset_count,
        unresolved_references=unresolved,
        manifest=path.as_posix(),
    )


def write_report(
    report_path: Path,
    *,
    archive: Path,
    checksum: str,
    target: str,
    profile: str,
    dry_run: bool,
    results: list[TargetResult],
) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "project": "Hexa Octarina Conquer",
        "packId": PACK_ID,
        "archive": archive.name,
        "sha256": checksum,
        "target": target,
        "profile": profile,
        "dryRun": dry_run,
        "results": [asdict(result) for result in results],
        "passed": True,
        "signature": SIGNATURE,
    }
    report_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sincroniza o PACK 99 completo por origem local ou URL HTTPS.",
    )
    source_group = parser.add_mutually_exclusive_group()
    source_group.add_argument("--source", type=Path, help="ZIP local do PACK 99")
    source_group.add_argument("--url", help="URL HTTPS privada do PACK 99")
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--target", choices=("godot", "web", "all"), default="all")
    parser.add_argument("--profile", choices=("core", "full"), default="core")
    parser.add_argument("--expected-sha256", default=os.getenv("PACK99_SHA256", OFFICIAL_SHA256))
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/pack99"))
    parser.add_argument("--force-download", action="store_true")
    parser.add_argument("--clean", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--report", type=Path, default=Path(".cache/pack99/sync-report.json"))
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    repo_root = args.repo.expanduser().resolve()
    if not (repo_root / "scripts" / "install_pack99.py").is_file():
        print("Erro: scripts/install_pack99.py não foi encontrado.", file=sys.stderr)
        return 2

    expected_sha256 = normalize_sha256(args.expected_sha256)
    source = args.source
    remote_url = args.url or os.getenv("PACK99_URL")
    if source is None and not remote_url:
        print(
            "Erro: informe --source, --url ou configure o secret PACK99_URL.",
            file=sys.stderr,
        )
        return 2

    try:
        if source is not None:
            archive = source.expanduser().resolve()
            checksum = verify_archive(archive, expected_sha256)
        else:
            cache_dir = args.cache_dir
            if not cache_dir.is_absolute():
                cache_dir = repo_root / cache_dir
            archive = download_archive(
                remote_url,
                cache_dir / ARCHIVE_NAME,
                expected_sha256,
                force=args.force_download,
            )
            checksum = expected_sha256

        command = installer_command(
            repo_root,
            archive,
            target=args.target,
            profile=args.profile,
            clean=args.clean,
            dry_run=args.dry_run,
        )
        completed = subprocess.run(command, cwd=repo_root, check=False)
        if completed.returncode != 0:
            raise SyncError(
                f"O instalador do PACK 99 terminou com código {completed.returncode}."
            )

        results: list[TargetResult] = []
        if not args.dry_run:
            for _target_name, destination in target_destinations(repo_root, args.target):
                results.append(
                    validate_install_manifest(
                        destination / "runtime-install.json",
                        args.profile,
                    )
                )

        report_path = args.report
        if not report_path.is_absolute():
            report_path = repo_root / report_path
        write_report(
            report_path,
            archive=archive,
            checksum=checksum,
            target=args.target,
            profile=args.profile,
            dry_run=args.dry_run,
            results=results,
        )
        print(f"Sincronização do PACK 99 aprovada. Relatório: {report_path}")
        print(SIGNATURE)
        return 0
    except (SyncError, ValueError) as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
