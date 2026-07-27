from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "import_pack99_canonical.py"
SPEC = importlib.util.spec_from_file_location("import_pack99_canonical", MODULE_PATH)
assert SPEC and SPEC.loader
importer = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = importer
SPEC.loader.exec_module(importer)
mapper = importer.mapper


def test_import_preserves_duplicate_paths_with_hardlinks(tmp_path: Path) -> None:
    source = tmp_path / "source"
    repo = tmp_path / "repo"
    (repo / ".git").mkdir(parents=True)
    (source / "PACK_01_TERRAIN").mkdir(parents=True)

    payload = b"same-png-content"
    first = source / "PACK_01_TERRAIN" / "TILE_GRASS_A.png"
    second = source / "PACK_01_TERRAIN" / "TILE_GRASS_COPY.png"
    first.write_bytes(payload)
    second.write_bytes(payload)

    records, summary = mapper.build_inventory(source, repo, exclude_documents=False)
    result = importer.import_deduplicated(
        source,
        repo,
        records,
        summary,
        exclude_documents=False,
    )

    imported_first = repo / "assets/pack99/source/PACK_01_TERRAIN/TILE_GRASS_A.png"
    imported_second = repo / "assets/pack99/source/PACK_01_TERRAIN/TILE_GRASS_COPY.png"

    assert result["uniqueContent"] == 1
    assert result["uniqueCopied"] == 1
    assert result["duplicateLinked"] == 1
    assert result["duplicateCopiedFallback"] == 0
    assert result["duplicateBytesSaved"] == len(payload)
    assert imported_first.read_bytes() == payload
    assert imported_second.read_bytes() == payload
    assert os.path.samefile(imported_first, imported_second)
    assert (repo / "runtime/packs/PACK_99_RECOVERED/import-report.json").is_file()


def test_reimport_is_idempotent(tmp_path: Path) -> None:
    source = tmp_path / "source"
    repo = tmp_path / "repo"
    (repo / ".git").mkdir(parents=True)
    (source / "PACK_06_HEROES").mkdir(parents=True)
    (source / "PACK_06_HEROES" / "KAEL_IDLE.png").write_bytes(b"hero")

    records, summary = mapper.build_inventory(source, repo, exclude_documents=False)
    first = importer.import_deduplicated(source, repo, records, summary, False)
    second = importer.import_deduplicated(source, repo, records, summary, False)

    assert first["uniqueCopied"] == 1
    assert second["uniqueCopied"] == 0
    assert second["uniqueUnchanged"] == 1
