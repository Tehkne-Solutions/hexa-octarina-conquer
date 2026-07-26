#!/usr/bin/env python3
"""Reassemble HOC PACK 99 from the eleven final split-pack archives.

The original runtime archive is intentionally kept outside Git. This recovery
command rebuilds the canonical packages/ layout, restores the institutional
asset license when it is absent, validates every published checksum and emits a
new ZIP plus a machine-readable report.

Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
EXPECTED_ASSETS = 1037
EXPECTED_ENTITIES = 46
EXPECTED_PACKS = 11
CHUNK_SIZE = 1024 * 1024

PACK_ARCHIVES = {
    "HOC_PACK_00_FOUNDATION_FINAL.zip": "PACK_00_FOUNDATION",
    "HOC_PACK_01_TERRAIN_CORE_FINAL.zip": "PACK_01_TERRAIN_CORE",
    "HOC_PACK_02_BOARD_SYSTEM_FINAL.zip": "PACK_02_BOARD_SYSTEM",
    "HOC_PACK_03_RESOURCES_FINAL.zip": "PACK_03_RESOURCES",
    "HOC_PACK_04_PROPS_OBSTACLES_FINAL.zip": "PACK_04_PROPS_OBSTACLES",
    "HOC_PACK_05_MAPS_PROCEDURAL_FINAL.zip": "PACK_05_MAPS_PROCEDURAL",
    "HOC_PACK_06_HERO_MAGE_FINAL.zip": "PACK_06_HERO_MAGE",
    "HOC_PACK_07_HERO_ROSTER_FINAL.zip": "PACK_07_HERO_ROSTER",
    "HOC_PACK_08_BASIC_UNITS_FINAL.zip": "PACK_08_BASIC_UNITS",
    "HOC_PACK_09_CHAMPIONS_ADVANCED_FINAL.zip": "PACK_09_CHAMPIONS_ADVANCED",
    "HOC_PACK_10_VFX_UI_TCG_FINAL.zip": "PACK_10_VFX_UI_TCG",
}

DEFAULT_LICENSE = """# Licença de Assets — Hexa Octarina Conquer

Copyright © 2026 Tehkné Solutions. Todos os direitos reservados.

Os arquivos visuais, animações, sprites, tiles, mapas, efeitos, interfaces,
cartas, manifestos e demais componentes deste pacote foram produzidos para o
projeto **Hexa Octarina Conquer**.

A Tehkné Solutions e as pessoas formalmente autorizadas por ela podem usar,
adaptar tecnicamente e distribuir estes assets incorporados às builds oficiais
do jogo, incluindo Web, PWA, Godot e Android.

Não é permitido, sem autorização expressa da Tehkné Solutions, revender,
relicenciar, redistribuir os arquivos-fonte como pacote independente, remover a
autoria institucional, usar os assets em outro produto ou disponibilizá-los em
bancos públicos de assets ou datasets de treinamento.

Substituições devem preservar, quando aplicável, ID canônico, canvas, âncora,
footprint, orientação isométrica, estados, frames, máscaras e assinatura.

**Tehkné Solutions**
"""


class AssemblyError(RuntimeError):
    """Raised when split packs cannot be safely assembled."""


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise AssemblyError(f"Arquivo obrigatório ausente: {path}") from error
    except json.JSONDecodeError as error:
        raise AssemblyError(f"JSON inválido em {path}: {error}") from error


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_extract(archive_path: Path, destination: Path) -> None:
    """Extract a ZIP without allowing absolute paths or directory traversal."""
    with zipfile.ZipFile(archive_path) as archive:
        destination_root = destination.resolve()
        for info in archive.infolist():
            member = PurePosixPath(info.filename)
            if member.is_absolute() or ".." in member.parts:
                raise AssemblyError(f"Entrada insegura no ZIP {archive_path.name}: {info.filename}")
            resolved = (destination / Path(*member.parts)).resolve()
            if resolved != destination_root and destination_root not in resolved.parents:
                raise AssemblyError(f"Entrada fora do destino em {archive_path.name}: {info.filename}")
        archive.extractall(destination)


def apply_a01_overlay(source_dir: Path, package_root: Path) -> dict[str, Any]:
    """Apply the A01 grass-flat premium overlay to PACK 01 without creating an extra pack."""
    overlay_archive = source_dir / "HOC_FINAL_A01_GRASS_FLAT_PREMIUM.zip"
    if not overlay_archive.is_file():
        return {"applied": False, "reason": "overlay-archive-missing"}

    with zipfile.ZipFile(overlay_archive) as archive:
        manifest_name = None
        for member_name in archive.namelist():
            if member_name.endswith("manifest.grass-flat-premium.json"):
                manifest_name = member_name
                break
        if manifest_name is None:
            raise AssemblyError("Manifesto do overlay A01 não encontrado.")

        overlay_manifest = json.loads(archive.read(manifest_name).decode("utf-8"))
        terrain_id = overlay_manifest.get("terrain", {}).get("id")
        if not terrain_id:
            raise AssemblyError("Overlay A01 não possui terrain.id válido.")

        entries: list[dict[str, str]] = []
        for member_name in archive.namelist():
            if member_name.endswith("/"):
                continue
            if member_name.startswith(("tiles/", "masks/", "validation/")):
                target = package_root / member_name
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member_name) as source_handle, target.open("wb") as dest_handle:
                    shutil.copyfileobj(source_handle, dest_handle)
                entries.append({"path": member_name, "terrainId": terrain_id})

    return {
        "applied": True,
        "overlayArchive": overlay_archive.name,
        "terrainId": terrain_id,
        "entries": entries,
    }


def copy_metadata(metadata_dir: Path, assembly_root: Path) -> None:
    if not metadata_dir.is_dir():
        raise AssemblyError(f"Diretório global do PACK 99 não encontrado: {metadata_dir}")
    for source in metadata_dir.rglob("*"):
        relative = source.relative_to(metadata_dir)
        if relative.parts and relative.parts[0] == "packages":
            continue
        destination = assembly_root / relative
        if source.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)


def restore_license(assembly_root: Path, license_source: Path | None) -> str:
    license_path = assembly_root / "license" / "LICENSE-ASSETS.md"
    license_path.parent.mkdir(parents=True, exist_ok=True)
    if license_source:
        if not license_source.is_file():
            raise AssemblyError(f"Licença informada não encontrada: {license_source}")
        shutil.copy2(license_source, license_path)
    elif not license_path.is_file():
        license_path.write_text(DEFAULT_LICENSE, encoding="utf-8")
    return file_sha256(license_path)


def update_license_checksum(assembly_root: Path, license_hash: str) -> None:
    checksums = assembly_root / "checksums" / "SHA256SUMS.txt"
    lines = checksums.read_text(encoding="utf-8").splitlines()
    target = "./license/LICENSE-ASSETS.md"
    replacement = f"{license_hash}  {target}"
    output: list[str] = []
    replaced = False
    for line in lines:
        if line.endswith(f"  {target}"):
            output.append(replacement)
            replaced = True
        else:
            output.append(line)
    if not replaced:
        output.append(replacement)
    checksums.write_text("\n".join(output) + "\n", encoding="utf-8")


def checksum_entries(checksum_file: Path) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    for line_number, line in enumerate(checksum_file.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            digest, relative = line.split("  ", 1)
        except ValueError as error:
            raise AssemblyError(f"Linha inválida em {checksum_file}:{line_number}") from error
        if len(digest) != 64:
            raise AssemblyError(f"Hash inválido em {checksum_file}:{line_number}")
        entries.append((digest.lower(), relative.removeprefix("./")))
    return entries


def validate_checksums(assembly_root: Path) -> int:
    entries = checksum_entries(assembly_root / "checksums" / "SHA256SUMS.txt")
    failures: list[str] = []
    for expected, relative in entries:
        path = assembly_root / relative
        if not path.is_file():
            failures.append(f"ausente: {relative}")
        elif file_sha256(path) != expected:
            failures.append(f"hash divergente: {relative}")
    if failures:
        preview = "\n".join(failures[:20])
        raise AssemblyError(f"Falha de checksum em {len(failures)} arquivo(s):\n{preview}")
    return len(entries)


def validate_contracts(assembly_root: Path) -> dict[str, int]:
    manifest = read_json(assembly_root / "pack-manifest.json")
    validation = read_json(assembly_root / "validation" / "validation-report.json")
    assets = read_json(assembly_root / "registry" / "assets-global.json")
    entities = read_json(assembly_root / "registry" / "entities-global.json")
    packs = read_json(assembly_root / "registry" / "packs-global.json")

    if manifest.get("packId") != PACK_ID:
        raise AssemblyError(f"Pack incorreto: {manifest.get('packId')!r}")
    if manifest.get("signature") != SIGNATURE:
        raise AssemblyError("Assinatura institucional inválida.")
    if validation.get("passed") is not True:
        raise AssemblyError("Relatório global de validação não aprovado.")

    counts = {
        "assets": len(assets.get("assets", [])),
        "entities": len(entities.get("entities", [])),
        "packs": len(packs.get("packs", [])),
    }
    expected = {"assets": EXPECTED_ASSETS, "entities": EXPECTED_ENTITIES, "packs": EXPECTED_PACKS}
    if counts != expected:
        raise AssemblyError(f"Contagens divergentes: esperado {expected}, recebido {counts}")
    return counts


def create_archive(assembly_root: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(assembly_root.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(assembly_root).as_posix())
    with zipfile.ZipFile(output) as archive:
        bad = archive.testzip()
        if bad:
            raise AssemblyError(f"ZIP final corrompido no arquivo: {bad}")


def assemble(
    source_dir: Path,
    metadata_dir: Path,
    output: Path,
    *,
    license_source: Path | None = None,
    work_dir: Path | None = None,
) -> dict[str, Any]:
    source_dir = source_dir.expanduser().resolve()
    metadata_dir = metadata_dir.expanduser().resolve()
    output = output.expanduser().resolve()
    temporary = work_dir is None
    root = Path(tempfile.mkdtemp(prefix="hoc-pack99-assembly-")) if temporary else work_dir.resolve()
    try:
        if root.exists() and not temporary:
            shutil.rmtree(root)
        root.mkdir(parents=True, exist_ok=True)
        copy_metadata(metadata_dir, root)
        packages_root = root / "packages"
        packages_root.mkdir(parents=True, exist_ok=True)
        for archive_name, package_name in PACK_ARCHIVES.items():
            archive_path = source_dir / archive_name
            if not archive_path.is_file():
                raise AssemblyError(f"ZIP obrigatório ausente: {archive_path}")
            safe_extract(archive_path, packages_root / package_name)

        overlay_report = apply_a01_overlay(source_dir, packages_root / "PACK_01_TERRAIN_CORE")
        license_hash = restore_license(root, license_source)
        update_license_checksum(root, license_hash)
        counts = validate_contracts(root)
        checksum_count = validate_checksums(root)
        create_archive(root, output)
        report = {
            "project": "Hexa Octarina Conquer",
            "packId": PACK_ID,
            "archive": output.name,
            "sha256": file_sha256(output),
            "bytes": output.stat().st_size,
            "checksumEntries": checksum_count,
            **counts,
            "passed": True,
            "signature": SIGNATURE,
            "a01Overlay": overlay_report,
        }
        report_path = output.with_suffix(output.suffix + ".report.json")
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        output.with_suffix(output.suffix + ".sha256").write_text(
            f"{report['sha256']}  {output.name}\n", encoding="utf-8"
        )
        return report
    finally:
        if temporary:
            shutil.rmtree(root, ignore_errors=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reconstrói o HOC PACK 99 a partir dos PACKS 00–10.")
    parser.add_argument("source_dir", type=Path, help="Pasta contendo os 11 ZIPs finais")
    parser.add_argument("--metadata-dir", type=Path, required=True, help="Pasta com manifestos globais do PACK 99")
    parser.add_argument("--output", type=Path, default=Path("HOC_PACK_99_FINAL_RUNTIME_RECOVERED.zip"))
    parser.add_argument("--license", type=Path, help="LICENSE-ASSETS.md original, quando disponível")
    parser.add_argument("--work-dir", type=Path, help="Diretório de montagem persistente para auditoria")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        report = assemble(
            args.source_dir,
            args.metadata_dir,
            args.output,
            license_source=args.license,
            work_dir=args.work_dir,
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print(SIGNATURE)
        return 0
    except (AssemblyError, OSError, zipfile.BadZipFile) as error:
        print(f"Erro: {error}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
