#!/usr/bin/env python3
"""Audit one HOC asset pack before progressive promotion.

Each PACK 00–10 passes its own integrity, manifest, registry, checksum,
reference, image and runtime-contract gates before entering the cumulative
runtime.

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
from collections import Counter
from pathlib import Path, PurePosixPath
from typing import Any

SIGNATURE = "Tehkné Solutions"
PACK00_ID = "HOC_PACK_00_FOUNDATION"
PACK01_ID = "HOC_PACK_01_TERRAIN_CORE_FINAL"

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

PACK01_REQUIRED = {
    "README.md",
    "pack-manifest.json",
    "assets-registry.json",
    "registry/assets-registry.json",
    "registry/pack-registry.json",
    "specs/terrain-runtime-contract.json",
    "specs/autotile-contract.json",
    "validation/validation-report.json",
    "validation/a01-overlay-report.json",
    "validation/PACK01_TERRAIN_FAMILIES_PREVIEW.png",
    "SHA256SUMS.txt",
    "LICENSE-ASSETS.md",
    "CHANGELOG.md",
}

PACK01_TERRAINS = {
    "A01_GRASS_ANCESTRAL": ("TERRAIN_GRASS_ANCESTRAL", "GRASS"),
    "A02_RUNIC_STONE": ("TERRAIN_RUNIC_STONE", "RUNIC"),
    "A03_FOREST": ("TERRAIN_FOREST", "FOREST"),
    "A04_CORRUPTED": ("TERRAIN_CORRUPTED", "CORRUPTED"),
    "A05_SHALLOW_WATER": ("TERRAIN_SHALLOW_WATER", "WATER"),
    "A06_LAVA": ("TERRAIN_LAVA", "LAVA"),
}
PACK01_SUPPORT = "A07_SUPPORT_MODULES"
PACK01_ASSET_COUNT = 103
PACK01_TERRAIN_ASSETS = 16
PACK01_SUPPORT_ASSETS = 7
PACK01_TILE_SIZE = (1024, 512)
PACK01_MASK_SIZE = (1024, 1024)
PACK01_RUNTIME_TILE_SIZE = [512, 256]
PACK01_RUNTIME_GRID_STEP = [252, 124]
PACK01_EDGE_BLEED = 8
PACK01_A01_OVERLAY_SHA256 = "39a950605cfd2102e7956792ca49573beb14e8e5bf6cb657ece1856c28f8ebc2"

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


def png_metadata(data: bytes, label: str) -> tuple[int, int, int]:
    if len(data) < 26 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AuditError(f"{label} não é um PNG válido.")
    width, height = struct.unpack(">II", data[16:24])
    color_type = data[25]
    return width, height, color_type


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
    covered: set[str] = set()
    for line_number, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line:
            continue
        parts = line.split("  ", 1)
        if len(parts) != 2 or not re.fullmatch(r"[0-9a-f]{64}", parts[0]):
            errors.append(f"Linha {line_number} inválida em SHA256SUMS.txt")
            continue
        expected, filename = parts
        if filename in covered:
            errors.append(f"Checksum duplicado: {filename}")
            continue
        covered.add(filename)
        if filename not in names:
            errors.append(f"Checksum aponta para arquivo ausente: {filename}")
            continue
        actual = sha256_bytes(archive.read(filename))
        if actual != expected:
            errors.append(f"Checksum divergente: {filename}")
        checked += 1
    expected_coverage = names - {"SHA256SUMS.txt"}
    missing_coverage = sorted(expected_coverage - covered)
    extra_coverage = sorted(covered - expected_coverage)
    if missing_coverage:
        errors.append("Arquivos sem checksum: " + ", ".join(missing_coverage[:20]))
    if extra_coverage:
        errors.append("Checksums sem arquivo correspondente: " + ", ".join(extra_coverage[:20]))
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
    width, height, _color_type = png_metadata(style_data, "STYLE_LOCK_01.png")
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


def _require_pack01_subpack_files(names: set[str]) -> None:
    missing: list[str] = []
    for subpack, (_terrain_id, prefix) in PACK01_TERRAINS.items():
        required = {
            f"{subpack}/README.md",
            f"{subpack}/manifest.terrain.json",
            f"{subpack}/autotile-rules.json",
            f"{subpack}/tileset.ts",
            f"{subpack}/validation/{prefix}_16_ASSETS_PREVIEW.png",
            f"{subpack}/validation/{prefix}_3X3_CONNECTION_TEST.png",
        }
        missing.extend(sorted(required - names))
    required_support = {
        f"{PACK01_SUPPORT}/manifest.support.json",
        f"{PACK01_SUPPORT}/validation/A07_SUPPORT_PREVIEW.png",
    }
    missing.extend(sorted(required_support - names))
    if missing:
        raise AuditError("PACK 01 incompleto; ausentes: " + ", ".join(missing[:30]))


def _validate_pack01_contracts(archive: zipfile.ZipFile) -> None:
    contract = read_json(archive, "specs/terrain-runtime-contract.json")
    if contract.get("signature") != SIGNATURE:
        raise AuditError("Contrato de terreno sem assinatura institucional.")
    req = contract.get("requirements", {})
    expected = {
        "masterCanvasPx": list(PACK01_TILE_SIZE),
        "runtimeTilePx": PACK01_RUNTIME_TILE_SIZE,
        "runtimeGridStepPx": PACK01_RUNTIME_GRID_STEP,
        "edgeBleedPx": PACK01_EDGE_BLEED,
        "canonicalIdsIdentical": True,
        "zeroUnresolvedReferences": True,
        "webGodotPathParity": True,
    }
    for key, value in expected.items():
        if req.get(key) != value:
            raise AuditError(f"Contrato de terreno inválido em {key}: {req.get(key)!r}")

    autotile = read_json(archive, "specs/autotile-contract.json")
    if autotile.get("signature") != SIGNATURE:
        raise AuditError("Contrato de autotile sem assinatura institucional.")
    if autotile.get("bitOrder") != ["N", "E", "S", "W"]:
        raise AuditError("Contrato de autotile usa ordem de bits inválida.")
    if autotile.get("baseTilesPerTerrain") != 3 or autotile.get("transitionAssetsPerTerrain") != 13:
        raise AuditError("Contrato de autotile não corresponde ao conjunto 3 + 13.")


def audit_pack01(archive: zipfile.ZipFile, names: set[str]) -> dict[str, Any]:
    missing = sorted(PACK01_REQUIRED - names)
    if missing:
        raise AuditError("PACK 01 incompleto; ausentes: " + ", ".join(missing))
    _require_pack01_subpack_files(names)

    manifest = read_json(archive, "pack-manifest.json")
    if manifest.get("packId") != PACK01_ID:
        raise AuditError(f"packId inválido: {manifest.get('packId')!r}")
    if manifest.get("signature") != SIGNATURE:
        raise AuditError("Assinatura do manifesto do PACK 01 inválida.")
    if manifest.get("status") != "runtime_ready":
        raise AuditError("PACK 01 precisa estar em status runtime_ready.")
    if manifest.get("version") != "1.1.0":
        raise AuditError("PACK 01 validado precisa estar na versão 1.1.0.")
    summary = manifest.get("summary", {})
    if summary.get("runtimeAssetCount") != PACK01_ASSET_COUNT:
        raise AuditError("Manifesto do PACK 01 não declara 103 assets runtime.")
    if summary.get("edgeBleedPx") != PACK01_EDGE_BLEED:
        raise AuditError("Manifesto do PACK 01 não corrige o edge bleed para 8 px.")
    if summary.get("runtimeGridStepPx") != PACK01_RUNTIME_GRID_STEP:
        raise AuditError("Manifesto do PACK 01 não declara o grid 252 × 124.")

    registry = read_json(archive, "registry/assets-registry.json")
    legacy_registry = read_json(archive, "assets-registry.json")
    if registry != legacy_registry:
        raise AuditError("Registros root e registry/ divergem.")
    if registry.get("signature") != SIGNATURE:
        raise AuditError("Assinatura do registro do PACK 01 inválida.")
    assets = registry.get("assets")
    if not isinstance(assets, list) or len(assets) != PACK01_ASSET_COUNT:
        raise AuditError("PACK 01 precisa registrar exatamente 103 assets.")
    ids = [str(asset.get("id", "")) for asset in assets]
    if any(not ID_PATTERN.fullmatch(asset_id) for asset_id in ids):
        raise AuditError("PACK 01 contém ID fora da convenção canônica.")
    if len(set(ids)) != PACK01_ASSET_COUNT:
        raise AuditError("PACK 01 contém IDs duplicados.")

    package_counts: Counter[str] = Counter()
    terrain_counts: Counter[str] = Counter()
    tile_count = 0
    mask_count = 0
    unresolved: list[str] = []
    for asset in assets:
        package_root = str(asset.get("packageRoot", ""))
        runtime_file = str(asset.get("runtimeFile", ""))
        runtime_mask = str(asset.get("runtimeMask", "")) if asset.get("runtimeMask") else ""
        provenance = asset.get("_provenance", {})
        if provenance.get("packId") != PACK01_ID or provenance.get("packageRoot") != package_root:
            raise AuditError(f"Provenance inválida em {asset.get('id')}.")
        if package_root not in {*PACK01_TERRAINS, PACK01_SUPPORT}:
            raise AuditError(f"packageRoot inválido em {asset.get('id')}: {package_root}")
        if not runtime_file.startswith(package_root + "/") or runtime_file not in names:
            unresolved.append(f"{asset.get('id')}:runtimeFile:{runtime_file}")
        else:
            width, height, color_type = png_metadata(archive.read(runtime_file), runtime_file)
            if (width, height) != PACK01_TILE_SIZE or color_type != 6:
                raise AuditError(f"Tile inválido {runtime_file}: {(width, height)}, colorType={color_type}")
            tile_count += 1
        if runtime_mask:
            if not runtime_mask.startswith(package_root + "/") or runtime_mask not in names:
                unresolved.append(f"{asset.get('id')}:runtimeMask:{runtime_mask}")
            else:
                width, height, color_type = png_metadata(archive.read(runtime_mask), runtime_mask)
                if (width, height) != PACK01_MASK_SIZE or color_type != 6:
                    raise AuditError(f"Máscara inválida {runtime_mask}: {(width, height)}, colorType={color_type}")
                mask_count += 1
        package_counts[package_root] += 1
        if asset.get("terrainId"):
            terrain_counts[str(asset.get("terrainId"))] += 1

    if unresolved:
        raise AuditError("Referências não resolvidas: " + ", ".join(unresolved[:20]))
    for subpack, (terrain_id, _prefix) in PACK01_TERRAINS.items():
        if package_counts[subpack] != PACK01_TERRAIN_ASSETS:
            raise AuditError(f"{subpack} precisa conter 16 assets.")
        if terrain_counts[terrain_id] != PACK01_TERRAIN_ASSETS:
            raise AuditError(f"{terrain_id} precisa conter 16 assets.")
        sub_manifest = read_json(archive, f"{subpack}/manifest.terrain.json")
        if sub_manifest.get("signature") != SIGNATURE or sub_manifest.get("status") != "runtime-ready":
            raise AuditError(f"Manifesto inválido em {subpack}.")
        sub_ids = {str(asset.get("id", "")) for asset in sub_manifest.get("assets", [])}
        registry_ids = {str(asset.get("id", "")) for asset in assets if asset.get("packageRoot") == subpack}
        if sub_ids != registry_ids:
            raise AuditError(f"IDs do manifesto e registro divergem em {subpack}.")
        technical = sub_manifest.get("technical", {})
        if technical.get("edgeBleedPx") != PACK01_EDGE_BLEED:
            raise AuditError(f"{subpack} não declara edge bleed de 8 px.")
        if technical.get("overlapPx") != PACK01_EDGE_BLEED:
            raise AuditError(f"{subpack} não declara overlap de 8 px.")
        if technical.get("recommendedRuntimeGridStepPx") != PACK01_RUNTIME_GRID_STEP:
            raise AuditError(f"{subpack} não declara grid runtime 252 × 124.")

    if package_counts[PACK01_SUPPORT] != PACK01_SUPPORT_ASSETS:
        raise AuditError("A07_SUPPORT_MODULES precisa conter 7 assets.")
    support_manifest = read_json(archive, f"{PACK01_SUPPORT}/manifest.support.json")
    if support_manifest.get("signature") != SIGNATURE or support_manifest.get("status") != "runtime-ready":
        raise AuditError("Manifesto do A07 inválido.")
    support_ids = {str(asset.get("id", "")) for asset in support_manifest.get("contains", [])}
    registry_support_ids = {str(asset.get("id", "")) for asset in assets if asset.get("packageRoot") == PACK01_SUPPORT}
    if support_ids != registry_support_ids:
        raise AuditError("IDs do A07 divergem entre manifesto e registro.")

    overlay = read_json(archive, "validation/a01-overlay-report.json")
    if overlay.get("signature") != SIGNATURE or overlay.get("decision") != "applied":
        raise AuditError("Overlay A01 não está aprovado.")
    source = overlay.get("sourceArchive", {})
    if source.get("sha256") != PACK01_A01_OVERLAY_SHA256:
        raise AuditError("SHA-256 do overlay A01 diverge do arquivo auditado.")
    comparison = overlay.get("comparison", {})
    if comparison.get("changedTiles") != 10 or comparison.get("changedMasks") != 0:
        raise AuditError("Relatório A01 não preserva máscaras e dez tiles alterados.")
    if comparison.get("idsChanged") is not False or comparison.get("geometryChanged") is not False:
        raise AuditError("Overlay A01 altera IDs ou geometria.")

    validation = read_json(archive, "validation/validation-report.json")
    if validation.get("passed") is not True or validation.get("signature") != SIGNATURE:
        raise AuditError("Relatório de validação do PACK 01 não está aprovado.")
    checks = validation.get("checks", {})
    if checks.get("runtimeAssets") != PACK01_ASSET_COUNT or checks.get("unresolvedReferences") != 0:
        raise AuditError("Relatório do PACK 01 não confirma 103 assets e zero pendências.")
    if checks.get("overlayA01Applied") is not True:
        raise AuditError("Relatório do PACK 01 não confirma o overlay A01.")

    _validate_pack01_contracts(archive)
    checked, checksum_errors = validate_checksums(archive, names)
    if checksum_errors:
        raise AuditError("; ".join(checksum_errors))

    return {
        "packId": PACK01_ID,
        "version": manifest.get("version"),
        "status": manifest.get("status"),
        "runtimeAssets": PACK01_ASSET_COUNT,
        "uniqueIds": len(set(ids)),
        "terrainFamilies": len(PACK01_TERRAINS),
        "supportModules": PACK01_SUPPORT_ASSETS,
        "tilesValidated": tile_count,
        "masksValidated": mask_count,
        "unresolvedReferences": 0,
        "edgeBleedPx": PACK01_EDGE_BLEED,
        "runtimeGridStepPx": PACK01_RUNTIME_GRID_STEP,
        "overlayA01": {"applied": True, "sha256": PACK01_A01_OVERLAY_SHA256, "changedTiles": 10},
        "checksumsValidated": checked,
        "promotionReady": bool(validation.get("promotionReady", False)),
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
        if pack_id == PACK00_ID:
            pack_report = audit_pack00(archive, names)
        elif pack_id == PACK01_ID:
            pack_report = audit_pack01(archive, names)
        else:
            raise AuditError(f"Pack progressivo ainda não suportado: {pack_id!r}. Suportados: {PACK00_ID}, {PACK01_ID}.")
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
