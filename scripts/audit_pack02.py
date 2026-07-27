#!/usr/bin/env python3
"""Audit HOC PACK 02 Board System before progressive promotion.

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
PACK_ID = "HOC_PACK_02_BOARD_SYSTEM_FINAL"
CANONICAL_PACK_ID = "HOC_PACK_02_BOARD_SYSTEM"
VERSION = "1.1.0"
ASSET_COUNT = 55
CANVAS = (1024, 1024)
PACKAGE_ROOTS = {
    "P01_PILLARS": ("P01_PILLARS/manifest.pillars.json", 6),
    "P02_EDGES": ("P02_EDGES/manifest.edges.json", 24),
    "P03_TERRITORY_EVOLUTION": ("P03_TERRITORY_EVOLUTION/manifest.territory.json", 25),
}
PILLAR_STATES = {"neutral", "blue", "red", "energized", "blocked", "selected"}
EDGE_MATERIALS = {"wood", "stone", "arcane"}
EDGE_STATES = {"preview", "built", "damaged", "destroyed"}
EDGE_ORIENTATIONS = {"NE_SW", "NW_SE"}
TERRITORY_STATES = {"neutral", "blue", "red", "construction", "damaged"}
TERRITORY_LINEAGE = ["TERR_SIGIL", "TERR_CAMP", "TERR_OUTPOST", "TERR_FORT", "TERR_CITADEL"]
REQUIRED = {
    "README.md",
    "pack-manifest.json",
    "assets-registry.json",
    "registry/assets-registry.json",
    "registry/pack-registry.json",
    "specs/board-runtime-contract.json",
    "specs/board-state-contract.json",
    "validation/validation-report.json",
    "validation/canvas-boundary-report.json",
    "validation/PILLARS_PREVIEW.png",
    "validation/EDGES_PREVIEW.png",
    "validation/TERRITORY_PREVIEW.png",
    "validation/PACK02_BOARD_SYSTEM_PREVIEW.png",
    "validation/PACK02_CONNECTION_TEST.png",
    "SHA256SUMS.txt",
    "LICENSE-ASSETS.md",
    "CHANGELOG.md",
    "board-system.ts",
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


def png_metadata(data: bytes, label: str) -> tuple[int, int, int]:
    if len(data) < 26 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AuditError(f"{label} não é um PNG válido.")
    width, height = struct.unpack(">II", data[16:24])
    return width, height, data[25]


def validate_paths(names: list[str]) -> None:
    for name in names:
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts or "\\" in name:
            raise AuditError(f"Caminho inseguro no ZIP: {name}")


def validate_checksums(archive: zipfile.ZipFile, names: set[str]) -> int:
    if "SHA256SUMS.txt" not in names:
        raise AuditError("SHA256SUMS.txt ausente.")
    covered: set[str] = set()
    checked = 0
    errors: list[str] = []
    for line_number, raw in enumerate(archive.read("SHA256SUMS.txt").decode("utf-8").splitlines(), start=1):
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
        if sha256_bytes(archive.read(filename)) != expected:
            errors.append(f"Checksum divergente: {filename}")
        checked += 1
    expected_coverage = names - {"SHA256SUMS.txt"}
    if expected_coverage != covered:
        missing = sorted(expected_coverage - covered)
        extra = sorted(covered - expected_coverage)
        if missing:
            errors.append("Arquivos sem checksum: " + ", ".join(missing[:20]))
        if extra:
            errors.append("Checksums sem arquivo: " + ", ".join(extra[:20]))
    if errors:
        raise AuditError("; ".join(errors))
    return checked


def _validate_contracts(archive: zipfile.ZipFile) -> None:
    runtime = read_json(archive, "specs/board-runtime-contract.json")
    if runtime.get("signature") != SIGNATURE:
        raise AuditError("Contrato runtime sem assinatura institucional.")
    requirements = runtime.get("requirements", {})
    expected = {
        "masterCanvasPx": [1024, 1024],
        "colorMode": "RGBA",
        "canonicalIdsIdentical": True,
        "zeroUnresolvedReferences": True,
        "webGodotPathParity": True,
        "referenceAssetsExcludedFromRuntime": True,
        "anchorMode": "normalized",
        "anchorPolicy": "bottom-center",
    }
    for key, value in expected.items():
        if requirements.get(key) != value:
            raise AuditError(f"Contrato runtime inválido em {key}: {requirements.get(key)!r}")
    anchors = runtime.get("anchors", {})
    if anchors.get("board-node") != [0.5, 0.92]:
        raise AuditError("Âncora de pilares divergente.")
    if anchors.get("board-edge") != [0.5, 0.78]:
        raise AuditError("Âncora de arestas divergente.")
    if anchors.get("territory-structure") != [0.5, 0.91]:
        raise AuditError("Âncora territorial divergente.")

    states = read_json(archive, "specs/board-state-contract.json")
    if states.get("signature") != SIGNATURE:
        raise AuditError("Contrato de estados sem assinatura institucional.")
    if set(states.get("pillars", {}).get("states", [])) != PILLAR_STATES:
        raise AuditError("Estados de pilares divergentes.")
    if set(states.get("edges", {}).get("materials", [])) != EDGE_MATERIALS:
        raise AuditError("Materiais de arestas divergentes.")
    if set(states.get("edges", {}).get("states", [])) != EDGE_STATES:
        raise AuditError("Estados de arestas divergentes.")
    if set(states.get("edges", {}).get("orientations", [])) != EDGE_ORIENTATIONS:
        raise AuditError("Orientações de arestas divergentes.")
    if states.get("territory", {}).get("lineage") != TERRITORY_LINEAGE:
        raise AuditError("Linhagem territorial divergente.")
    if set(states.get("territory", {}).get("states", [])) != TERRITORY_STATES:
        raise AuditError("Estados territoriais divergentes.")


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
        missing = sorted(REQUIRED - names)
        if missing:
            raise AuditError("PACK 02 incompleto; ausentes: " + ", ".join(missing))

        manifest = read_json(archive, "pack-manifest.json")
        if manifest.get("packId") != PACK_ID or manifest.get("canonicalPackId") != CANONICAL_PACK_ID:
            raise AuditError("Identidade do PACK 02 inválida.")
        if manifest.get("version") != VERSION or manifest.get("status") != "runtime_ready":
            raise AuditError("PACK 02 precisa estar validado na versão 1.1.0.")
        if manifest.get("signature") != SIGNATURE:
            raise AuditError("Assinatura do manifesto inválida.")
        summary = manifest.get("summary", {})
        if summary.get("runtimeAssets") != ASSET_COUNT:
            raise AuditError("Manifesto não declara 55 assets runtime.")
        if summary.get("pillars") != 6 or summary.get("edges") != 24 or summary.get("territoryStructures") != 25:
            raise AuditError("Resumo do PACK 02 diverge dos subpacks.")

        registry = read_json(archive, "registry/assets-registry.json")
        root_registry = read_json(archive, "assets-registry.json")
        if registry != root_registry:
            raise AuditError("Registros root e registry/ divergem.")
        if registry.get("packId") != PACK_ID or registry.get("canonicalPackId") != CANONICAL_PACK_ID:
            raise AuditError("Registro do PACK 02 possui identidade inválida.")
        if registry.get("version") != VERSION or registry.get("signature") != SIGNATURE:
            raise AuditError("Registro do PACK 02 possui versão ou assinatura inválida.")
        assets = registry.get("assets")
        if not isinstance(assets, list) or len(assets) != ASSET_COUNT:
            raise AuditError("PACK 02 precisa registrar exatamente 55 assets.")
        ids = [str(asset.get("id", "")) for asset in assets]
        if any(not ID_PATTERN.fullmatch(asset_id) for asset_id in ids):
            raise AuditError("PACK 02 contém ID fora da convenção canônica.")
        if len(set(ids)) != ASSET_COUNT:
            raise AuditError("PACK 02 contém IDs duplicados.")

        package_counts: Counter[str] = Counter()
        primary = shadow = emissive = 0
        unresolved: list[str] = []
        by_package: dict[str, set[str]] = {package: set() for package in PACKAGE_ROOTS}
        pillar_states: set[str] = set()
        edge_combinations: set[tuple[str, str, str]] = set()
        territory_combinations: set[tuple[int, str]] = set()
        for asset in assets:
            asset_id = str(asset.get("id"))
            package_root = str(asset.get("packageRoot", ""))
            if package_root not in PACKAGE_ROOTS:
                raise AuditError(f"packageRoot inválido em {asset_id}: {package_root}")
            provenance = asset.get("_provenance", {})
            if provenance.get("packId") != PACK_ID or provenance.get("packageRoot") != package_root:
                raise AuditError(f"Provenance inválida em {asset_id}.")
            for source_key, expected_prefix in (
                ("runtimeFile", package_root + "/"),
                ("runtimeShadow", package_root + "/"),
                ("runtimeEmissive", package_root + "/"),
            ):
                value = asset.get(source_key)
                if not value:
                    continue
                value = str(value)
                if not value.startswith(expected_prefix) or value not in names:
                    unresolved.append(f"{asset_id}:{source_key}:{value}")
                    continue
                width, height, color_type = png_metadata(archive.read(value), value)
                if (width, height) != CANVAS or color_type != 6:
                    raise AuditError(f"PNG inválido {value}: {(width, height)}, colorType={color_type}")
                if source_key == "runtimeFile":
                    primary += 1
                elif source_key == "runtimeShadow":
                    shadow += 1
                else:
                    emissive += 1
            package_counts[package_root] += 1
            by_package[package_root].add(asset_id)
            category = asset.get("category")
            if category == "board-node":
                pillar_states.add(str(asset.get("state")))
            elif category == "board-edge":
                edge_combinations.add((str(asset.get("material")), str(asset.get("state")), str(asset.get("orientation"))))
            elif category == "territory-structure":
                territory_combinations.add((int(asset.get("stage", 0)), str(asset.get("state"))))
            else:
                raise AuditError(f"Categoria inválida em {asset_id}: {category}")
        if unresolved:
            raise AuditError("Referências não resolvidas: " + ", ".join(unresolved[:20]))
        if (primary, shadow, emissive) != (55, 55, 28):
            raise AuditError(f"Contagem de PNGs runtime divergente: {(primary, shadow, emissive)}")
        if pillar_states != PILLAR_STATES:
            raise AuditError("Conjunto de pilares incompleto.")
        expected_edges = {(material, state, orientation) for material in EDGE_MATERIALS for state in EDGE_STATES for orientation in EDGE_ORIENTATIONS}
        if edge_combinations != expected_edges:
            raise AuditError("Matriz 3 × 4 × 2 de arestas incompleta.")
        expected_territory = {(stage, state) for stage in range(1, 6) for state in TERRITORY_STATES}
        if territory_combinations != expected_territory:
            raise AuditError("Matriz 5 × 5 de evolução territorial incompleta.")

        for package_root, (manifest_path, expected_count) in PACKAGE_ROOTS.items():
            if package_counts[package_root] != expected_count:
                raise AuditError(f"{package_root} precisa conter {expected_count} assets.")
            sub_manifest = read_json(archive, manifest_path)
            if sub_manifest.get("pack") != PACK_ID or sub_manifest.get("version") != VERSION:
                raise AuditError(f"Manifesto inválido em {package_root}.")
            if sub_manifest.get("status") != "runtime-ready" or sub_manifest.get("signature") != SIGNATURE:
                raise AuditError(f"Status ou assinatura inválidos em {package_root}.")
            sub_ids = {str(asset.get("id", "")) for asset in sub_manifest.get("assets", [])}
            if sub_ids != by_package[package_root]:
                raise AuditError(f"IDs do manifesto e registro divergem em {package_root}.")
            technical = sub_manifest.get("technical", {})
            if technical.get("masterCanvasPx") != [1024, 1024] or technical.get("colorMode") != "RGBA":
                raise AuditError(f"Contrato técnico inválido em {package_root}.")

        _validate_contracts(archive)
        validation = read_json(archive, "validation/validation-report.json")
        if validation.get("passed") is not True or validation.get("signature") != SIGNATURE:
            raise AuditError("Relatório de validação do PACK 02 não está aprovado.")
        checks = validation.get("checks", {})
        if checks.get("runtimeAssets") != 55 or checks.get("unresolvedReferences") != 0:
            raise AuditError("Relatório do PACK 02 não confirma 55 assets e zero pendências.")
        boundary = read_json(archive, "validation/canvas-boundary-report.json")
        if boundary.get("passed") is not True or boundary.get("signature") != SIGNATURE:
            raise AuditError("Relatório de limites do canvas inválido.")
        if boundary.get("checks", {}).get("topBoundaryContacts") != 0:
            raise AuditError("Existem assets cortados na borda superior.")
        if boundary.get("checks", {}).get("leftBoundaryContacts") != 0 or boundary.get("checks", {}).get("rightBoundaryContacts") != 0:
            raise AuditError("Existem assets cortados nas bordas laterais.")

        checked = validate_checksums(archive, names)
        return {
            "passed": True,
            "archive": path.name,
            "archiveBytes": path.stat().st_size,
            "archiveSha256": archive_sha,
            "entries": len(names_list),
            "unsafePaths": 0,
            "pack": {
                "packId": PACK_ID,
                "canonicalPackId": CANONICAL_PACK_ID,
                "version": VERSION,
                "status": manifest.get("status"),
                "runtimeAssets": ASSET_COUNT,
                "uniqueIds": len(set(ids)),
                "pillars": package_counts["P01_PILLARS"],
                "edges": package_counts["P02_EDGES"],
                "territoryStructures": package_counts["P03_TERRITORY_EVOLUTION"],
                "primaryPngs": primary,
                "shadowPngs": shadow,
                "emissivePngs": emissive,
                "unresolvedReferences": 0,
                "checksumsValidated": checked,
                "promotionReady": bool(validation.get("promotionReady", False)),
            },
            "signature": SIGNATURE,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Audita o PACK 02 Board System progressivo.")
    parser.add_argument("archive", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        report = audit(args.archive.expanduser().resolve())
    except AuditError as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 2
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
