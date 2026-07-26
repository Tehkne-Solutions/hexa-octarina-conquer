#!/usr/bin/env python3
"""Rebuild and promote HOC PACK 99 from the local split archives.

This command is intentionally local-first: the large ZIP and installed runtime
remain outside Git, while machine-readable reports are written next to the
source archives for review.

Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

SIGNATURE = "Tehkné Solutions"
PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
OUTPUT_NAME = "HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip"
EXPECTED_FULL_ASSETS = 1037
EXPECTED_CORE_ASSETS = 597
EXPECTED_ENTITIES = 46
EXPECTED_PACKS = 11

PACK_ARCHIVES = (
    "HOC_PACK_00_FOUNDATION_FINAL.zip",
    "HOC_PACK_01_TERRAIN_CORE_FINAL.zip",
    "HOC_PACK_02_BOARD_SYSTEM_FINAL.zip",
    "HOC_PACK_03_RESOURCES_FINAL.zip",
    "HOC_PACK_04_PROPS_OBSTACLES_FINAL.zip",
    "HOC_PACK_05_MAPS_PROCEDURAL_FINAL.zip",
    "HOC_PACK_06_HERO_MAGE_FINAL.zip",
    "HOC_PACK_07_HERO_ROSTER_FINAL.zip",
    "HOC_PACK_08_BASIC_UNITS_FINAL.zip",
    "HOC_PACK_09_CHAMPIONS_ADVANCED_FINAL.zip",
    "HOC_PACK_10_VFX_UI_TCG_FINAL.zip",
)
A01_ARCHIVE = "HOC_FINAL_A01_GRASS_FLAT_PREMIUM.zip"
REQUIRED_REPO_FILES = (
    "scripts/assemble_pack99.py",
    "scripts/install_pack99.py",
    "scripts/sync_pack99.py",
    "scripts/validate_pack99_promotion.py",
)
METADATA_MARKERS = (
    "pack-manifest.json",
    "registry/assets-global.json",
    "registry/entities-global.json",
    "registry/packs-global.json",
    "validation/validation-report.json",
    "checksums/SHA256SUMS.txt",
)


class RunnerError(RuntimeError):
    """Raised when the local rebuild cannot continue safely."""


@dataclass(frozen=True)
class SourceArchive:
    name: str
    bytes: int
    sha256: str


@dataclass(frozen=True)
class TargetSummary:
    target: str
    profile: str
    asset_count: int
    unresolved_references: int


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise RunnerError(f"Arquivo obrigatório ausente: {path}") from error
    except json.JSONDecodeError as error:
        raise RunnerError(f"JSON inválido em {path}: {error}") from error


def is_metadata_root(path: Path) -> bool:
    return path.is_dir() and all((path / marker).is_file() for marker in METADATA_MARKERS)


def validate_repo(repo_root: Path) -> None:
    if not (repo_root / "client").is_dir():
        raise RunnerError(f"O caminho não parece ser a raiz do repositório: {repo_root}")
    missing = [relative for relative in REQUIRED_REPO_FILES if not (repo_root / relative).is_file()]
    if missing:
        raise RunnerError("Arquivos de runtime ausentes no repositório: " + ", ".join(missing))


def validate_source_archives(assets_root: Path) -> list[SourceArchive]:
    required = (*PACK_ARCHIVES, A01_ARCHIVE)
    inventory: list[SourceArchive] = []
    for name in required:
        path = assets_root / name
        if not path.is_file():
            raise RunnerError(f"ZIP obrigatório ausente: {path}")
        if not zipfile.is_zipfile(path):
            raise RunnerError(f"Arquivo não é um ZIP válido: {path}")
        inventory.append(SourceArchive(name=name, bytes=path.stat().st_size, sha256=file_sha256(path)))
    return inventory


def _safe_relative(member_name: str, prefix: tuple[str, ...]) -> PurePosixPath | None:
    member = PurePosixPath(member_name)
    if member.is_absolute() or ".." in member.parts:
        raise RunnerError(f"Entrada insegura no ZIP de metadados: {member_name}")
    if prefix and member.parts[: len(prefix)] != prefix:
        return None
    relative_parts = member.parts[len(prefix) :]
    if not relative_parts:
        return None
    relative = PurePosixPath(*relative_parts)
    if relative.parts[0] == "packages":
        return None
    return relative


def extract_metadata_from_archive(archive_path: Path, destination: Path) -> Path:
    """Recover only PACK 99 global metadata from a prior reconstructed ZIP."""
    if not archive_path.is_file() or not zipfile.is_zipfile(archive_path):
        raise RunnerError(f"ZIP de metadados inválido: {archive_path}")

    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(archive_path) as archive:
        manifests = [
            PurePosixPath(info.filename)
            for info in archive.infolist()
            if not info.is_dir() and PurePosixPath(info.filename).name == "pack-manifest.json"
        ]
        if not manifests:
            raise RunnerError(f"pack-manifest.json não encontrado em {archive_path}")
        manifest = min(manifests, key=lambda item: len(item.parts))
        prefix = manifest.parts[:-1]

        for info in archive.infolist():
            if info.is_dir():
                continue
            relative = _safe_relative(info.filename, prefix)
            if relative is None:
                continue
            target = destination / Path(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)

    if not is_metadata_root(destination):
        raise RunnerError(
            f"O ZIP {archive_path.name} não forneceu todos os metadados globais necessários."
        )
    return destination


def metadata_candidates(assets_root: Path) -> Iterable[Path]:
    known = (
        assets_root / "HOC_PACK_99_FINAL_RUNTIME",
        assets_root / "PACK99-METADATA",
        assets_root / ".pack99-work" / "metadata",
        assets_root / ".pack99-work" / "HOC_PACK_99_FINAL_RUNTIME",
        assets_root / "PACK99-RECOVERED" / "HOC_PACK_99_FINAL_RUNTIME",
    )
    yield from known

    # Limited discovery avoids walking deeply through all binary package folders.
    for manifest in assets_root.glob("*/pack-manifest.json"):
        yield manifest.parent
    for manifest in assets_root.glob("*/*/pack-manifest.json"):
        yield manifest.parent


def resolve_metadata_root(
    assets_root: Path,
    work_root: Path,
    explicit: Path | None,
    recovered_zip: Path,
) -> tuple[Path, str]:
    if explicit is not None:
        candidate = explicit.expanduser().resolve()
        if not is_metadata_root(candidate):
            raise RunnerError(f"Diretório de metadados incompleto: {candidate}")
        return candidate, "explicit"

    seen: set[Path] = set()
    for candidate in metadata_candidates(assets_root):
        candidate = candidate.expanduser().resolve()
        if candidate in seen:
            continue
        seen.add(candidate)
        if is_metadata_root(candidate):
            return candidate, "directory-discovery"

    archive_candidates = [recovered_zip]
    recovered_dir = assets_root / "PACK99-RECOVERED"
    if recovered_dir.is_dir():
        archive_candidates.extend(sorted(recovered_dir.glob("HOC_PACK_99*.zip")))
    archive_candidates.extend(sorted(assets_root.glob("HOC_PACK_99*.zip")))

    seen_archives: set[Path] = set()
    for archive in archive_candidates:
        archive = archive.expanduser().resolve()
        if archive in seen_archives or not archive.is_file():
            continue
        seen_archives.add(archive)
        try:
            extracted = extract_metadata_from_archive(archive, work_root / "metadata-from-archive")
            return extracted, f"archive:{archive.name}"
        except RunnerError:
            continue

    raise RunnerError(
        "Metadados globais do PACK 99 não foram encontrados. Informe --metadata-dir ou preserve "
        "o ZIP reconstruído anterior em PACK99-RECOVERED."
    )


def run_command(label: str, command: list[str], cwd: Path, log_file: Path) -> None:
    print(f"\n=== {label} ===")
    print("$ " + subprocess.list2cmdline(command))
    log_file.parent.mkdir(parents=True, exist_ok=True)
    with log_file.open("a", encoding="utf-8") as log:
        log.write(f"\n=== {label} ===\n$ {subprocess.list2cmdline(command)}\n")
        process = subprocess.Popen(
            command,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        assert process.stdout is not None
        for line in process.stdout:
            print(line, end="")
            log.write(line)
        return_code = process.wait()
    if return_code != 0:
        raise RunnerError(f"{label} terminou com código {return_code}. Consulte {log_file}")


def target_summaries(report_path: Path, expected_profile: str) -> list[TargetSummary]:
    report = read_json(report_path)
    if report.get("passed") is not True or report.get("profile") != expected_profile:
        raise RunnerError(f"Relatório de sincronização não aprovado: {report_path}")
    results = report.get("results")
    if not isinstance(results, list) or len(results) != 2:
        raise RunnerError(f"Relatório não contém Web e Godot: {report_path}")

    summaries: list[TargetSummary] = []
    for result in results:
        summary = TargetSummary(
            target=str(result.get("target", "")),
            profile=str(result.get("profile", "")),
            asset_count=int(result.get("asset_count", 0)),
            unresolved_references=int(result.get("unresolved_references", -1)),
        )
        if summary.profile != expected_profile or summary.unresolved_references != 0:
            raise RunnerError(f"Target inválido no relatório {report_path}: {summary}")
        minimum = EXPECTED_FULL_ASSETS if expected_profile == "full" else EXPECTED_CORE_ASSETS
        if expected_profile == "full" and summary.asset_count != EXPECTED_FULL_ASSETS:
            raise RunnerError(f"Perfil full deve possuir exatamente 1.037 assets: {summary}")
        if expected_profile == "core" and summary.asset_count < minimum:
            raise RunnerError(f"Perfil core possui cobertura insuficiente: {summary}")
        summaries.append(summary)
    if {summary.target for summary in summaries} != {"web", "godot"}:
        raise RunnerError(f"Targets divergentes no relatório: {report_path}")
    return summaries


def validate_promotion(report_path: Path) -> dict[str, Any]:
    report = read_json(report_path)
    expected = {
        "expectedAssetIds": EXPECTED_FULL_ASSETS,
        "bootstrapAssetIds": 0,
        "bootstrapAliases": 0,
        "proceduralFallbackMode": False,
        "passed": True,
        "signature": SIGNATURE,
    }
    for key, value in expected.items():
        if report.get(key) != value:
            raise RunnerError(f"Gate de promoção divergente em {key}: {report.get(key)!r}")
    return report


def git_status(repo_root: Path) -> str:
    completed = subprocess.run(
        ["git", "status", "--short"],
        cwd=repo_root,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return completed.stdout.strip()


def write_summary(
    report_dir: Path,
    *,
    archive: Path,
    archive_hash: str,
    inventory: list[SourceArchive],
    metadata_source: str,
    core: list[TargetSummary],
    full: list[TargetSummary],
    promotion: dict[str, Any],
    repo_root: Path,
) -> Path:
    timestamp = datetime.now(timezone.utc).isoformat()
    payload = {
        "project": "Hexa Octarina Conquer",
        "packId": PACK_ID,
        "timestampUtc": timestamp,
        "archive": archive.name,
        "archiveBytes": archive.stat().st_size,
        "archiveSha256": archive_hash,
        "metadataSource": metadata_source,
        "sourceArchives": [asdict(item) for item in inventory],
        "core": [asdict(item) for item in core],
        "full": [asdict(item) for item in full],
        "promotion": promotion,
        "gitStatusAfterRun": git_status(repo_root),
        "passed": True,
        "signature": SIGNATURE,
    }
    report_dir.mkdir(parents=True, exist_ok=True)
    json_path = report_dir / "PACK99_LOCAL_PROMOTION_RESULT.json"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    core_lines = "\n".join(
        f"- {item.target}: {item.asset_count} assets, {item.unresolved_references} pendências"
        for item in core
    )
    full_lines = "\n".join(
        f"- {item.target}: {item.asset_count} assets, {item.unresolved_references} pendências"
        for item in full
    )
    md_path = report_dir / "PACK99_LOCAL_PROMOTION_RESULT.md"
    md_path.write_text(
        "# PACK 99 — Resultado da promoção local\n\n"
        f"- Estado: **APROVADO**\n"
        f"- Arquivo: `{archive.name}`\n"
        f"- Tamanho: `{archive.stat().st_size}` bytes\n"
        f"- SHA-256: `{archive_hash}`\n"
        f"- Metadados: `{metadata_source}`\n\n"
        "## Core\n\n"
        f"{core_lines}\n\n"
        "## Full\n\n"
        f"{full_lines}\n\n"
        "## Gate\n\n"
        f"- IDs esperados: `{promotion['expectedAssetIds']}`\n"
        f"- Bootstrap: `{promotion['bootstrapAssetIds']}`\n"
        f"- Aliases: `{promotion['bootstrapAliases']}`\n"
        f"- Fallback procedural: `{promotion['proceduralFallbackMode']}`\n"
        f"- Aprovado: `{promotion['passed']}`\n\n"
        "Os binários e o ZIP permanecem fora do Git.\n\n"
        "**Tehkné Solutions**\n",
        encoding="utf-8",
    )
    return md_path


def copy_runtime_reports(repo_root: Path, report_dir: Path) -> None:
    source_dir = repo_root / ".cache" / "pack99"
    if not source_dir.is_dir():
        return
    report_dir.mkdir(parents=True, exist_ok=True)
    for name in ("sync-core-report.json", "sync-full-report.json", "promotion-report.json"):
        source = source_dir / name
        if source.is_file():
            shutil.copy2(source, report_dir / name)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reconstrói e promove o PACK 99 local em um único comando.")
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument(
        "--assets-root",
        type=Path,
        default=Path(r"W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS"),
    )
    parser.add_argument("--metadata-dir", type=Path)
    parser.add_argument("--skip-tests", action="store_true")
    parser.add_argument("--keep-work", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    repo_root = args.repo.expanduser().resolve()
    assets_root = args.assets_root.expanduser().resolve()
    work_root = assets_root / ".pack99-work"
    recovered_dir = assets_root / "PACK99-RECOVERED"
    report_dir = assets_root / "PACK99-REPORTS"
    archive = recovered_dir / OUTPUT_NAME
    log_file = report_dir / "PACK99_LOCAL_PROMOTION.log"

    try:
        validate_repo(repo_root)
        if not assets_root.is_dir():
            raise RunnerError(f"Pasta de assets não encontrada: {assets_root}")
        inventory = validate_source_archives(assets_root)
        work_root.mkdir(parents=True, exist_ok=True)
        recovered_dir.mkdir(parents=True, exist_ok=True)
        report_dir.mkdir(parents=True, exist_ok=True)
        metadata_root, metadata_source = resolve_metadata_root(
            assets_root,
            work_root,
            args.metadata_dir,
            archive,
        )

        if not args.skip_tests:
            run_command(
                "Compilar scripts Python",
                [
                    sys.executable,
                    "-m",
                    "py_compile",
                    "scripts/assemble_pack99.py",
                    "scripts/install_pack99.py",
                    "scripts/sync_pack99.py",
                    "scripts/validate_pack99_promotion.py",
                    "scripts/rebuild_pack99_local.py",
                ],
                repo_root,
                log_file,
            )
            run_command(
                "Testes de runtime",
                [
                    sys.executable,
                    "-m",
                    "unittest",
                    "tests/test_assemble_pack99.py",
                    "tests/test_install_pack99.py",
                    "tests/test_sync_pack99.py",
                    "tests/test_validate_pack99_promotion.py",
                    "tests/test_rebuild_pack99_local.py",
                    "-v",
                ],
                repo_root,
                log_file,
            )

        assembly_work = work_root / "assembly"
        run_command(
            "Reconstruir PACK 99",
            [
                sys.executable,
                "scripts/assemble_pack99.py",
                str(assets_root),
                "--metadata-dir",
                str(metadata_root),
                "--output",
                str(archive),
                "--work-dir",
                str(assembly_work),
            ],
            repo_root,
            log_file,
        )
        archive_hash = file_sha256(archive)

        cache_dir = repo_root / ".cache" / "pack99"
        cache_dir.mkdir(parents=True, exist_ok=True)
        core_report = cache_dir / "sync-core-report.json"
        full_report = cache_dir / "sync-full-report.json"
        promotion_report = cache_dir / "promotion-report.json"

        common_sync = [
            sys.executable,
            "scripts/sync_pack99.py",
            "--source",
            str(archive),
            "--expected-sha256",
            archive_hash,
            "--repo",
            str(repo_root),
            "--target",
            "all",
            "--clean",
        ]
        run_command(
            "Sincronizar perfil core",
            [*common_sync, "--profile", "core", "--report", str(core_report)],
            repo_root,
            log_file,
        )
        core = target_summaries(core_report, "core")

        run_command(
            "Sincronizar perfil full",
            [*common_sync, "--profile", "full", "--report", str(full_report)],
            repo_root,
            log_file,
        )
        full = target_summaries(full_report, "full")

        run_command(
            "Validar promoção Web e Godot",
            [
                sys.executable,
                "scripts/validate_pack99_promotion.py",
                "--repo",
                str(repo_root),
                "--report",
                str(promotion_report),
            ],
            repo_root,
            log_file,
        )
        promotion = validate_promotion(promotion_report)
        copy_runtime_reports(repo_root, report_dir)
        summary = write_summary(
            report_dir,
            archive=archive,
            archive_hash=archive_hash,
            inventory=inventory,
            metadata_source=metadata_source,
            core=core,
            full=full,
            promotion=promotion,
            repo_root=repo_root,
        )

        if not args.keep_work and assembly_work.exists():
            shutil.rmtree(assembly_work, ignore_errors=True)

        print("\n=== RESULTADO PARA COLAR NO CHAT ===")
        print("PACK99_LOCAL_PROMOTION=PASSED")
        print(f"ARCHIVE={archive}")
        print(f"SHA256={archive_hash}")
        for item in core:
            print(f"CORE_{item.target.upper()}={item.asset_count};UNRESOLVED={item.unresolved_references}")
        for item in full:
            print(f"FULL_{item.target.upper()}={item.asset_count};UNRESOLVED={item.unresolved_references}")
        print(f"PROMOTION_REPORT={promotion_report}")
        print(f"SUMMARY={summary}")
        print(SIGNATURE)
        return 0
    except (RunnerError, OSError, ValueError, zipfile.BadZipFile) as error:
        print(f"\nERRO: {error}", file=sys.stderr)
        print(f"Log: {log_file}", file=sys.stderr)
        print("O bootstrap anterior foi preservado sempre que a instalação não chegou ao gate.", file=sys.stderr)
        print(SIGNATURE, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
