#!/usr/bin/env python3
"""
Importa o PACK 99 recuperado preservando todos os caminhos, mas mantendo uma
única ocupação física por conteúdo repetido quando o volume suporta hardlinks.

Signature: Tehkné Solutions
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import shutil
import sys
from collections import defaultdict
from dataclasses import asdict
from pathlib import Path
from typing import Any

SCRIPT_PATH = Path(__file__).with_name("map_pack99_recovered.py")
SPEC = importlib.util.spec_from_file_location("pack99_mapper_runtime", SCRIPT_PATH)
if not SPEC or not SPEC.loader:
    raise RuntimeError(f"Não foi possível carregar {SCRIPT_PATH}")
mapper = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mapper
SPEC.loader.exec_module(mapper)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Importa a fonte canônica do PACK 99 com deduplicação física."
    )
    parser.add_argument("--source", type=Path, default=mapper.DEFAULT_SOURCE)
    parser.add_argument("--repo", type=Path, default=mapper.DEFAULT_REPO)
    parser.add_argument("--sha-file", type=Path, default=mapper.DEFAULT_SHA_FILE)
    parser.add_argument("--recovery-report", type=Path, default=mapper.DEFAULT_REPORT)
    parser.add_argument("--exclude-documents", action="store_true")
    parser.add_argument("--skip-lfs-check", action="store_true")
    # Compatibilidade com os argumentos aceitos pelo comando `all`.
    parser.add_argument("--materialize-mode", choices=("hardlink", "copy"), default="hardlink")
    parser.add_argument("--clean-generated", action="store_true")
    return parser.parse_args()


def paths_share_storage(first: Path, second: Path) -> bool:
    try:
        return os.path.samefile(first, second)
    except (OSError, ValueError):
        return False


def replace_with_hardlink(primary: Path, destination: Path) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if paths_share_storage(primary, destination):
            return "linked-unchanged"
        if destination.is_dir():
            shutil.rmtree(destination)
        else:
            destination.unlink()
    try:
        os.link(primary, destination)
        return "linked"
    except OSError:
        shutil.copy2(primary, destination)
        return "copied-fallback"


def import_deduplicated(
    source: Path,
    repo: Path,
    records: list[Any],
    summary: dict[str, Any],
    exclude_documents: bool,
) -> dict[str, int]:
    mapper.configure_repo(repo)
    included = [
        record
        for record in records
        if not (exclude_documents and record.document)
    ]
    groups: defaultdict[str, list[Any]] = defaultdict(list)
    for record in included:
        groups[record.sha256].append(record)

    unique_copied = 0
    unique_unchanged = 0
    duplicate_linked = 0
    duplicate_linked_unchanged = 0
    duplicate_copied_fallback = 0
    duplicate_bytes_saved = 0
    processed = 0

    # Primeira passagem: materializa exatamente uma fonte física por SHA-256.
    primary_by_sha: dict[str, Path] = {}
    for sha256, group in groups.items():
        primary = group[0]
        src = source / Path(primary.source_path)
        dst = repo / Path(primary.canonical_path)
        if mapper.copy_if_needed(src, dst):
            unique_copied += 1
        else:
            unique_unchanged += 1
        primary_by_sha[sha256] = dst
        processed += 1
        if processed % 250 == 0:
            mapper.log(f"  conteúdo único: {processed}/{len(groups)}")

    # Segunda passagem: recria caminhos repetidos como hardlinks NTFS.
    duplicate_total = sum(max(0, len(group) - 1) for group in groups.values())
    duplicate_index = 0
    for sha256, group in groups.items():
        primary_dst = primary_by_sha[sha256]
        for record in group[1:]:
            duplicate_index += 1
            dst = repo / Path(record.canonical_path)
            result = replace_with_hardlink(primary_dst, dst)
            if result == "linked":
                duplicate_linked += 1
                duplicate_bytes_saved += record.bytes
            elif result == "linked-unchanged":
                duplicate_linked_unchanged += 1
                duplicate_bytes_saved += record.bytes
            else:
                duplicate_copied_fallback += 1
            if duplicate_index % 250 == 0:
                mapper.log(f"  duplicados: {duplicate_index}/{duplicate_total}")

    contract_root = repo / mapper.CONTRACT_ROOT_REL
    contract_root.mkdir(parents=True, exist_ok=True)
    catalog_value = {
        **summary,
        "status": "imported-canonical-deduplicated",
        "canonicalRoot": mapper.normalize_relative(mapper.CATALOG_ROOT_REL),
        "webRuntimeRoot": mapper.normalize_relative(mapper.WEB_RUNTIME_REL),
        "godotRuntimeRoot": mapper.normalize_relative(mapper.GODOT_RUNTIME_REL),
        "assets": [asdict(record) for record in included],
        "signature": mapper.SIGNATURE,
    }
    mapper.write_json(contract_root / "asset-catalog.json", catalog_value)
    mapper.write_json(
        contract_root / "runtime-contract.json",
        {
            "schemaVersion": 1,
            "packId": mapper.PACK_ID,
            "namespace": mapper.CANONICAL_NAMESPACE,
            "version": "1.0.1",
            "status": "mapped-ready-for-runtime-integration",
            "canonicalRoot": mapper.normalize_relative(mapper.CATALOG_ROOT_REL),
            "generatedTargets": {
                "web": mapper.normalize_relative(mapper.WEB_RUNTIME_REL),
                "godot": mapper.normalize_relative(mapper.GODOT_RUNTIME_REL),
            },
            "rules": {
                "singleCanonicalCopy": True,
                "generatedTargetsAreIgnored": True,
                "preserveRelativePaths": True,
                "deduplicateBySha256": "hardlink-preserving-paths",
                "hardlinkFallback": "copy",
                "requireManifestLookup": True,
                "fallbackRequired": True,
            },
            "signature": mapper.SIGNATURE,
        },
    )
    result = {
        "catalogAssets": len(included),
        "uniqueContent": len(groups),
        "uniqueCopied": unique_copied,
        "uniqueUnchanged": unique_unchanged,
        "duplicateLinked": duplicate_linked,
        "duplicateLinkedUnchanged": duplicate_linked_unchanged,
        "duplicateCopiedFallback": duplicate_copied_fallback,
        "duplicateBytesSaved": duplicate_bytes_saved,
        "excludedDocuments": len(records) - len(included),
    }
    mapper.write_json(
        contract_root / "import-report.json",
        {**result, "signature": mapper.SIGNATURE},
    )
    return result


def main() -> int:
    args = parse_args()
    source, repo = mapper.validate_paths(args.source, args.repo)
    if not args.skip_lfs_check and not mapper.git_lfs_available(repo):
        mapper.fail(
            "Git LFS não está instalado/configurado. Execute `git lfs install` "
            "ou use --skip-lfs-check por sua conta e risco."
        )

    records, summary = mapper.build_inventory(source, repo, args.exclude_documents)
    mapper.write_inventory_outputs(
        repo, records, summary, args.recovery_report, args.sha_file
    )
    result = import_deduplicated(
        source, repo, records, summary, args.exclude_documents
    )

    mapper.log("")
    mapper.log("=== PACK 99 CANONICAL IMPORT RESULT ===")
    for key, value in result.items():
        mapper.log(f"{key.upper()}={value}")
    mapper.log(f"SIGNATURE={mapper.SIGNATURE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
