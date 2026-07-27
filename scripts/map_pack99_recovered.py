#!/usr/bin/env python3
"""
PACK 99 recovered mapper/importer.

Creates a deterministic inventory for the recovered PACK 99, imports one
canonical copy into the repository, and optionally materializes Web/Godot
runtime trees without duplicating source organization.

Signature: Tehkné Solutions
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

SCRIPT_VERSION = "1.0.0"
SIGNATURE = "Tehkné Solutions"
PACK_ID = "HOC_PACK_99_FINAL_RUNTIME_RECOVERED"
CANONICAL_NAMESPACE = "PACK_99_RECOVERED"

DEFAULT_SOURCE = Path(r"W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS\PACK99-RECOVERED\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1")
DEFAULT_REPO = Path(r"W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\hexa-octarina-conquer")
DEFAULT_SHA_FILE = Path(r"W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS\PACK99-RECOVERED\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip.sha256")
DEFAULT_REPORT = Path(r"W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS\PACK99-RECOVERED\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip.report.json")

CATALOG_ROOT_REL = Path("assets/pack99/source")
CONTRACT_ROOT_REL = Path("runtime/packs/PACK_99_RECOVERED")
CACHE_ROOT_REL = Path(".cache/pack99-map")
WEB_RUNTIME_REL = Path("client/web/public/assets/runtime/pack99")
GODOT_RUNTIME_REL = Path("client/godot/assets/runtime/pack99")

RUNTIME_EXTENSIONS = {
    ".png", ".webp", ".jpg", ".jpeg", ".gif", ".svg",
    ".glb", ".gltf", ".obj", ".mtl", ".fbx",
    ".wav", ".ogg", ".mp3", ".flac",
    ".ttf", ".otf", ".woff", ".woff2",
    ".atlas", ".aseprite", ".tres", ".tscn", ".gdshader", ".shader",
    ".json", ".csv", ".yaml", ".yml",
}
BINARY_LFS_EXTENSIONS = {
    ".png", ".webp", ".jpg", ".jpeg", ".gif",
    ".glb", ".gltf", ".obj", ".mtl", ".fbx",
    ".wav", ".ogg", ".mp3", ".flac",
    ".ttf", ".otf", ".woff", ".woff2",
    ".atlas", ".aseprite", ".psd", ".kra",
}
DOCUMENT_EXTENSIONS = {
    ".md", ".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
}
IGNORED_NAMES = {
    "thumbs.db", "desktop.ini", ".ds_store",
}
CATEGORY_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("terrain", ("terrain", "tile", "biome", "grass", "lava", "water", "forest", "ground")),
    ("board", ("board", "pillar", "edge", "territory", "cell", "grid", "node")),
    ("resources", ("resource", "ore", "wood", "crystal", "mana", "food", "coin")),
    ("props", ("prop", "object", "decoration", "decor", "building", "structure")),
    ("maps", ("map", "background", "environment", "scene", "world")),
    ("heroes", ("hero", "heroes", "kael", "lyra", "brakk")),
    ("units", ("unit", "troop", "soldier", "enemy", "npc", "mob")),
    ("champions", ("champion", "boss", "elite")),
    ("vfx", ("vfx", "fx", "effect", "particle", "impact", "spell")),
    ("ui", ("ui", "hud", "icon", "button", "panel", "frame", "interface", "cursor")),
    ("tcg", ("tcg", "card", "deck", "portrait")),
    ("audio", ("audio", "sound", "music", "sfx", "voice")),
    ("fonts", ("font", "typeface")),
    ("docs", ("docs", "documentation", "report", "license", "readme", "changelog")),
]
PACK_PATTERN = re.compile(r"(?i)(?:^|[^a-z0-9])pack[\s_\-]*0?([0-9]|10)(?:[^a-z0-9]|$)")
ID_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]{5,}$")
SHA256_PATTERN = re.compile(r"\b[a-fA-F0-9]{64}\b")


@dataclass(slots=True)
class AssetRecord:
    id: str
    source_path: str
    canonical_path: str
    category: str
    pack_hint: str | None
    extension: str
    mime: str | None
    bytes: int
    sha256: str
    duplicate_of: str | None
    runtime_candidate: bool
    document: bool
    requires_lfs: bool
    web_runtime_path: str | None
    godot_runtime_path: str | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Inventaria, importa e materializa o PACK 99 recuperado."
    )
    parser.add_argument(
        "command",
        choices=("audit", "import", "materialize", "all", "status"),
        nargs="?",
        default="audit",
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--repo", type=Path, default=DEFAULT_REPO)
    parser.add_argument("--sha-file", type=Path, default=DEFAULT_SHA_FILE)
    parser.add_argument("--recovery-report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument(
        "--materialize-mode",
        choices=("hardlink", "copy"),
        default="hardlink",
        help="hardlink economiza espaço quando origem e repo estão no mesmo volume.",
    )
    parser.add_argument(
        "--exclude-documents",
        action="store_true",
        help="Não copia documentação para a fonte canônica. O padrão preserva tudo.",
    )
    parser.add_argument(
        "--skip-lfs-check",
        action="store_true",
        help="Permite importação sem Git LFS. Não recomendado.",
    )
    parser.add_argument(
        "--clean-generated",
        action="store_true",
        help="Remove runtimes gerados antes de materializar novamente.",
    )
    return parser.parse_args()


def log(message: str) -> None:
    print(message, flush=True)


def fail(message: str, code: int = 2) -> None:
    print(f"ERRO: {message}", file=sys.stderr)
    raise SystemExit(code)


def normalize_relative(path: Path) -> str:
    return PurePosixPath(*path.parts).as_posix()


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def infer_pack_hint(relative: str) -> str | None:
    match = PACK_PATTERN.search(relative)
    if not match:
        return None
    return f"PACK_{int(match.group(1)):02d}"


def infer_category(relative: str, extension: str) -> str:
    searchable = re.sub(r"[^a-z0-9]+", " ", relative.lower())
    tokens = set(searchable.split())
    for category, needles in CATEGORY_RULES:
        if any(needle in tokens or needle in searchable for needle in needles):
            return category
    if extension in {".wav", ".ogg", ".mp3", ".flac"}:
        return "audio"
    if extension in {".ttf", ".otf", ".woff", ".woff2"}:
        return "fonts"
    if extension in DOCUMENT_EXTENSIONS:
        return "docs"
    return "unclassified"


def stable_asset_id(relative: str, sha256: str) -> str:
    stem = Path(relative).stem.upper()
    normalized = re.sub(r"[^A-Z0-9]+", "_", stem).strip("_")
    if ID_PATTERN.match(normalized):
        return normalized
    path_slug = re.sub(r"[^A-Z0-9]+", "_", relative.upper()).strip("_")
    if len(path_slug) > 96:
        path_slug = path_slug[-96:]
    return f"P99_{path_slug}_{sha256[:10].upper()}"


def iter_source_files(source: Path) -> Iterable[Path]:
    for path in sorted(source.rglob("*"), key=lambda item: item.as_posix().lower()):
        if not path.is_file():
            continue
        if path.name.lower() in IGNORED_NAMES:
            continue
        yield path


def read_json_file(path: Path) -> Any | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def read_expected_sha(path: Path) -> str | None:
    if not path.is_file():
        return None
    match = SHA256_PATTERN.search(path.read_text(encoding="utf-8-sig", errors="replace"))
    return match.group(0).lower() if match else None


def validate_paths(source: Path, repo: Path) -> tuple[Path, Path]:
    if not source.is_dir():
        fail(f"Pasta extraída não encontrada: {source}")
    if not repo.is_dir():
        fail(f"Repositório não encontrado: {repo}")
    if not (repo / ".git").exists():
        fail(f"O destino não parece ser um repositório Git: {repo}")
    source = source.resolve()
    repo = repo.resolve()
    try:
        repo.relative_to(source)
    except ValueError:
        pass
    else:
        fail("O repositório não pode ficar dentro da pasta fonte do PACK 99.")
    return source, repo


def git_lfs_available(repo: Path) -> bool:
    try:
        result = subprocess.run(
            ["git", "lfs", "version"],
            cwd=repo,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
    except OSError:
        return False
    return result.returncode == 0


def build_inventory(source: Path, repo: Path, exclude_documents: bool) -> tuple[list[AssetRecord], dict[str, Any]]:
    files = list(iter_source_files(source))
    if not files:
        fail("A pasta do PACK 99 está vazia.")

    log(f"Inventariando {len(files)} arquivos...")
    raw: list[dict[str, Any]] = []
    hashes: defaultdict[str, list[int]] = defaultdict(list)
    total_bytes = 0

    for index, path in enumerate(files, start=1):
        relative_path = path.relative_to(source)
        relative = normalize_relative(relative_path)
        extension = path.suffix.lower()
        file_sha = sha256_file(path)
        size = path.stat().st_size
        total_bytes += size
        category = infer_category(relative, extension)
        document = extension in DOCUMENT_EXTENSIONS or category == "docs"
        runtime_candidate = extension in RUNTIME_EXTENSIONS and not document
        canonical_rel = CATALOG_ROOT_REL / relative_path
        runtime_rel = Path(category) / relative_path
        raw.append(
            {
                "source": path,
                "relative": relative,
                "relative_path": relative_path,
                "extension": extension,
                "sha256": file_sha,
                "bytes": size,
                "category": category,
                "pack_hint": infer_pack_hint(relative),
                "document": document,
                "runtime_candidate": runtime_candidate,
                "canonical_rel": canonical_rel,
                "runtime_rel": runtime_rel,
            }
        )
        hashes[file_sha].append(len(raw) - 1)
        if index % 250 == 0:
            log(f"  {index}/{len(files)} arquivos processados...")

    used_ids: dict[str, str] = {}
    records: list[AssetRecord] = []
    canonical_by_hash: dict[str, str] = {}

    for item in raw:
        duplicate_of = canonical_by_hash.get(item["sha256"])
        if duplicate_of is None:
            canonical_by_hash[item["sha256"]] = item["relative"]

        base_id = stable_asset_id(item["relative"], item["sha256"])
        asset_id = base_id
        if asset_id in used_ids and used_ids[asset_id] != item["sha256"]:
            asset_id = f"{base_id}_{item['sha256'][:8].upper()}"
        used_ids[asset_id] = item["sha256"]

        web_path = None
        godot_path = None
        if item["runtime_candidate"]:
            web_path = normalize_relative(WEB_RUNTIME_REL / item["runtime_rel"])
            godot_path = normalize_relative(GODOT_RUNTIME_REL / item["runtime_rel"])

        records.append(
            AssetRecord(
                id=asset_id,
                source_path=item["relative"],
                canonical_path=normalize_relative(item["canonical_rel"]),
                category=item["category"],
                pack_hint=item["pack_hint"],
                extension=item["extension"],
                mime=mimetypes.guess_type(item["relative"])[0],
                bytes=item["bytes"],
                sha256=item["sha256"],
                duplicate_of=duplicate_of,
                runtime_candidate=item["runtime_candidate"],
                document=item["document"],
                requires_lfs=item["extension"] in BINARY_LFS_EXTENSIONS,
                web_runtime_path=web_path,
                godot_runtime_path=godot_path,
            )
        )

    category_counts = Counter(record.category for record in records)
    pack_counts = Counter(record.pack_hint or "UNMAPPED" for record in records)
    duplicate_files = sum(1 for record in records if record.duplicate_of)
    duplicate_bytes = sum(record.bytes for record in records if record.duplicate_of)
    runtime_files = sum(1 for record in records if record.runtime_candidate)
    runtime_bytes = sum(record.bytes for record in records if record.runtime_candidate)
    unclassified = sum(1 for record in records if record.category == "unclassified")
    summary = {
        "schemaVersion": 1,
        "toolVersion": SCRIPT_VERSION,
        "project": "Hexa Octarina Conquer",
        "packId": PACK_ID,
        "canonicalNamespace": CANONICAL_NAMESPACE,
        "sourceRoot": str(source),
        "repoRoot": str(repo),
        "generatedAtUnix": int(time.time()),
        "fileCount": len(records),
        "totalBytes": total_bytes,
        "runtimeCandidateCount": runtime_files,
        "runtimeCandidateBytes": runtime_bytes,
        "uniqueContentCount": len(hashes),
        "duplicateFileCount": duplicate_files,
        "duplicateBytes": duplicate_bytes,
        "unclassifiedCount": unclassified,
        "categoryCounts": dict(sorted(category_counts.items())),
        "packHintCounts": dict(sorted(pack_counts.items())),
        "signature": SIGNATURE,
    }
    return records, summary


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False, sort_keys=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def write_inventory_outputs(
    repo: Path,
    records: list[AssetRecord],
    summary: dict[str, Any],
    recovery_report: Path,
    sha_file: Path,
) -> Path:
    output = repo / CACHE_ROOT_REL
    output.mkdir(parents=True, exist_ok=True)
    expected_zip_sha = read_expected_sha(sha_file)
    report_value = read_json_file(recovery_report)
    sibling_zip = sha_file.with_suffix("") if sha_file.name.lower().endswith(".sha256") else None
    zip_verification: dict[str, Any] = {
        "shaFile": str(sha_file) if sha_file.exists() else None,
        "expectedSha256": expected_zip_sha,
        "zipPath": str(sibling_zip) if sibling_zip and sibling_zip.is_file() else None,
        "actualSha256": None,
        "verified": None,
    }
    if sibling_zip and sibling_zip.is_file():
        actual = sha256_file(sibling_zip)
        zip_verification["actualSha256"] = actual
        zip_verification["verified"] = actual == expected_zip_sha if expected_zip_sha else None

    catalog = {
        **summary,
        "recoveryEvidence": {
            "zip": zip_verification,
            "reportPath": str(recovery_report) if recovery_report.exists() else None,
            "report": report_value,
        },
        "assets": [asdict(record) for record in records],
    }
    write_json(output / "asset-catalog.json", catalog)
    write_json(output / "summary.json", summary)
    write_json(
        output / "duplicates.json",
        {
            "duplicates": [asdict(record) for record in records if record.duplicate_of],
            "signature": SIGNATURE,
        },
    )
    write_json(
        output / "unclassified.json",
        {
            "assets": [asdict(record) for record in records if record.category == "unclassified"],
            "signature": SIGNATURE,
        },
    )

    with (output / "asset-review.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "id", "source_path", "category", "pack_hint", "extension", "bytes",
                "sha256", "duplicate_of", "runtime_candidate", "requires_lfs",
            ],
        )
        writer.writeheader()
        for record in records:
            writer.writerow({key: getattr(record, key) for key in writer.fieldnames})

    summary_md = [
        "# PACK 99 — relatório de mapeamento",
        "",
        f"- arquivos: **{summary['fileCount']}**",
        f"- tamanho total: **{summary['totalBytes']} bytes**",
        f"- candidatos de runtime: **{summary['runtimeCandidateCount']}**",
        f"- conteúdos únicos: **{summary['uniqueContentCount']}**",
        f"- duplicados: **{summary['duplicateFileCount']}**",
        f"- não classificados: **{summary['unclassifiedCount']}**",
        "",
        "## Categorias",
        "",
    ]
    for category, count in summary["categoryCounts"].items():
        summary_md.append(f"- {category}: {count}")
    summary_md += ["", f"**{SIGNATURE}**", ""]
    (output / "PACK99_MAPPING_REPORT.md").write_text(
        "\n".join(summary_md), encoding="utf-8", newline="\n"
    )
    return output


def append_managed_block(path: Path, marker: str, lines: list[str]) -> None:
    start = f"# BEGIN {marker}"
    end = f"# END {marker}"
    existing = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
    pattern = re.compile(
        rf"(?ms)^{re.escape(start)}\n.*?^{re.escape(end)}\n?"
    )
    block = start + "\n" + "\n".join(lines) + "\n" + end + "\n"
    if pattern.search(existing):
        updated = pattern.sub(block, existing)
    else:
        updated = existing.rstrip() + ("\n\n" if existing.strip() else "") + block
    path.write_text(updated, encoding="utf-8", newline="\n")


def configure_repo(repo: Path) -> None:
    lfs_lines = [
        "assets/pack99/source/**/*.png filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.webp filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.jpg filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.jpeg filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.gif filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.glb filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.gltf filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.fbx filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.obj filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.mtl filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.wav filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.ogg filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.mp3 filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.flac filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.ttf filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.otf filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.woff filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.woff2 filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.atlas filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.aseprite filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.psd filter=lfs diff=lfs merge=lfs -text",
        "assets/pack99/source/**/*.kra filter=lfs diff=lfs merge=lfs -text",
    ]
    append_managed_block(repo / ".gitattributes", "TEHKNE PACK99 LFS", lfs_lines)
    append_managed_block(
        repo / ".gitignore",
        "TEHKNE PACK99 GENERATED",
        [
            ".cache/pack99-map/",
            "client/web/public/assets/runtime/pack99/",
            "client/godot/assets/runtime/pack99/",
        ],
    )


def copy_if_needed(source: Path, destination: Path) -> bool:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_file():
        if destination.stat().st_size == source.stat().st_size and sha256_file(destination) == sha256_file(source):
            return False
    shutil.copy2(source, destination)
    return True


def import_canonical(
    source: Path,
    repo: Path,
    records: list[AssetRecord],
    summary: dict[str, Any],
    exclude_documents: bool,
) -> dict[str, int]:
    configure_repo(repo)
    copied = 0
    skipped = 0
    excluded_documents = 0
    for index, record in enumerate(records, start=1):
        if record.document and exclude_documents:
            excluded_documents += 1
            continue
        src = source / Path(record.source_path)
        dst = repo / Path(record.canonical_path)
        if copy_if_needed(src, dst):
            copied += 1
        else:
            skipped += 1
        if index % 250 == 0:
            log(f"  importação: {index}/{len(records)}")

    contract_root = repo / CONTRACT_ROOT_REL
    contract_root.mkdir(parents=True, exist_ok=True)
    catalog_value = {
        **summary,
        "status": "imported-canonical",
        "canonicalRoot": normalize_relative(CATALOG_ROOT_REL),
        "webRuntimeRoot": normalize_relative(WEB_RUNTIME_REL),
        "godotRuntimeRoot": normalize_relative(GODOT_RUNTIME_REL),
        "assets": [asdict(record) for record in records if not (exclude_documents and record.document)],
        "signature": SIGNATURE,
    }
    write_json(contract_root / "asset-catalog.json", catalog_value)
    write_json(
        contract_root / "runtime-contract.json",
        {
            "schemaVersion": 1,
            "packId": PACK_ID,
            "namespace": CANONICAL_NAMESPACE,
            "version": "1.0.1",
            "status": "mapped-ready-for-runtime-integration",
            "canonicalRoot": normalize_relative(CATALOG_ROOT_REL),
            "generatedTargets": {
                "web": normalize_relative(WEB_RUNTIME_REL),
                "godot": normalize_relative(GODOT_RUNTIME_REL),
            },
            "rules": {
                "singleCanonicalCopy": True,
                "generatedTargetsAreIgnored": True,
                "preserveRelativePaths": True,
                "deduplicateBySha256": True,
                "requireManifestLookup": True,
                "fallbackRequired": True,
            },
            "signature": SIGNATURE,
        },
    )
    write_json(
        contract_root / "import-report.json",
        {
            "copied": copied,
            "unchanged": skipped,
            "excludedDocuments": excluded_documents,
            "catalogAssets": len(catalog_value["assets"]),
            "signature": SIGNATURE,
        },
    )
    return {
        "copied": copied,
        "skipped": skipped,
        "excluded_documents": excluded_documents,
    }


def materialize_one(src: Path, dst: Path, mode: str) -> str:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        if dst.stat().st_size == src.stat().st_size and sha256_file(dst) == sha256_file(src):
            return "unchanged"
        dst.unlink()
    if mode == "hardlink":
        try:
            os.link(src, dst)
            return "linked"
        except OSError:
            shutil.copy2(src, dst)
            return "copied-fallback"
    shutil.copy2(src, dst)
    return "copied"


def materialize_runtime(
    repo: Path,
    records: list[AssetRecord],
    mode: str,
    clean_generated: bool,
) -> dict[str, int]:
    if clean_generated:
        for relative in (WEB_RUNTIME_REL, GODOT_RUNTIME_REL):
            shutil.rmtree(repo / relative, ignore_errors=True)

    counts: Counter[str] = Counter()
    runtime_records = [record for record in records if record.runtime_candidate]
    for index, record in enumerate(runtime_records, start=1):
        canonical = repo / Path(record.canonical_path)
        if not canonical.is_file():
            fail(
                f"Fonte canônica ausente para {record.source_path}. "
                "Execute o comando import antes de materializar."
            )
        assert record.web_runtime_path and record.godot_runtime_path
        for target_path in (record.web_runtime_path, record.godot_runtime_path):
            result = materialize_one(canonical, repo / Path(target_path), mode)
            counts[result] += 1
        if index % 250 == 0:
            log(f"  runtime: {index}/{len(runtime_records)}")

    contract_root = repo / CONTRACT_ROOT_REL
    runtime_index = {
        "schemaVersion": 1,
        "packId": PACK_ID,
        "namespace": CANONICAL_NAMESPACE,
        "version": "1.0.1",
        "status": "materialized-local",
        "assetCount": len(runtime_records),
        "assets": [
            {
                "id": record.id,
                "category": record.category,
                "packHint": record.pack_hint,
                "sha256": record.sha256,
                "bytes": record.bytes,
                "web": record.web_runtime_path,
                "godot": record.godot_runtime_path,
            }
            for record in runtime_records
        ],
        "signature": SIGNATURE,
    }
    write_json(contract_root / "runtime-index.json", runtime_index)
    write_json(
        contract_root / "materialization-report.json",
        {
            "mode": mode,
            "runtimeAssetCount": len(runtime_records),
            "targetFileCount": len(runtime_records) * 2,
            "results": dict(counts),
            "signature": SIGNATURE,
        },
    )
    return dict(counts)


def status(repo: Path) -> None:
    paths = {
        "fonte canônica": repo / CATALOG_ROOT_REL,
        "contratos": repo / CONTRACT_ROOT_REL,
        "inventário": repo / CACHE_ROOT_REL / "asset-catalog.json",
        "runtime Web": repo / WEB_RUNTIME_REL,
        "runtime Godot": repo / GODOT_RUNTIME_REL,
    }
    for label, path in paths.items():
        print(f"{label:18}: {'OK' if path.exists() else 'AUSENTE'} — {path}")


def main() -> int:
    args = parse_args()
    source, repo = validate_paths(args.source, args.repo)

    if args.command == "status":
        status(repo)
        return 0

    if args.command in {"import", "all"} and not args.skip_lfs_check and not git_lfs_available(repo):
        fail(
            "Git LFS não está instalado/configurado. Execute `git lfs install` "
            "ou use --skip-lfs-check por sua conta e risco."
        )

    records, summary = build_inventory(source, repo, args.exclude_documents)
    output = write_inventory_outputs(
        repo, records, summary, args.recovery_report, args.sha_file
    )
    log(f"Inventário gravado em: {output}")

    if args.command in {"import", "all"}:
        result = import_canonical(
            source, repo, records, summary, args.exclude_documents
        )
        log(f"Importação canônica concluída: {result}")

    if args.command in {"materialize", "all"}:
        result = materialize_runtime(
            repo, records, args.materialize_mode, args.clean_generated
        )
        log(f"Materialização concluída: {result}")

    log("")
    log("=== PACK 99 MAPPING RESULT ===")
    log(f"FILES={summary['fileCount']}")
    log(f"TOTAL_BYTES={summary['totalBytes']}")
    log(f"RUNTIME_CANDIDATES={summary['runtimeCandidateCount']}")
    log(f"DUPLICATES={summary['duplicateFileCount']}")
    log(f"UNCLASSIFIED={summary['unclassifiedCount']}")
    log(f"COMMAND={args.command}")
    log(f"SIGNATURE={SIGNATURE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
