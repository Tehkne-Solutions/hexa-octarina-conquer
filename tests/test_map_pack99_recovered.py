from __future__ import annotations

import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "map_pack99_recovered.py"
SPEC = importlib.util.spec_from_file_location("map_pack99_recovered", MODULE_PATH)
assert SPEC and SPEC.loader
mapper = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mapper)


def test_infers_pack_and_categories() -> None:
    assert mapper.infer_pack_hint("PACK_01_TERRAIN/tiles/a.png") == "PACK_01"
    assert mapper.infer_pack_hint("pack-10-ui/cards/a.webp") == "PACK_10"
    assert mapper.infer_category("PACK_01_TERRAIN/grass/tile_a.png", ".png") == "terrain"
    assert mapper.infer_category("heroes/KAEL_IDLE.png", ".png") == "heroes"
    assert mapper.infer_category("audio/battle_theme.ogg", ".ogg") == "audio"


def test_inventory_detects_duplicates_and_preserves_docs(tmp_path: Path) -> None:
    source = tmp_path / "source"
    repo = tmp_path / "repo"
    (repo / ".git").mkdir(parents=True)
    (source / "PACK_01_TERRAIN").mkdir(parents=True)
    (source / "docs").mkdir(parents=True)

    payload = b"same-content"
    (source / "PACK_01_TERRAIN" / "TILE_GRASS_A.png").write_bytes(payload)
    (source / "PACK_01_TERRAIN" / "TILE_GRASS_COPY.png").write_bytes(payload)
    (source / "docs" / "README.md").write_text("pack", encoding="utf-8")

    records, summary = mapper.build_inventory(source, repo, exclude_documents=False)

    assert summary["fileCount"] == 3
    assert summary["duplicateFileCount"] == 1
    assert summary["runtimeCandidateCount"] == 2
    assert any(record.document for record in records)


def test_import_and_materialize(tmp_path: Path) -> None:
    source = tmp_path / "source"
    repo = tmp_path / "repo"
    (repo / ".git").mkdir(parents=True)
    (source / "PACK_06_HEROES").mkdir(parents=True)
    asset = source / "PACK_06_HEROES" / "KAEL_IDLE.png"
    asset.write_bytes(b"fake-png")

    records, summary = mapper.build_inventory(source, repo, exclude_documents=False)
    result = mapper.import_canonical(
        source,
        repo,
        records,
        summary,
        exclude_documents=False,
    )
    assert result["copied"] == 1
    assert (repo / "assets/pack99/source/PACK_06_HEROES/KAEL_IDLE.png").is_file()

    materialized = mapper.materialize_runtime(
        repo,
        records,
        mode="copy",
        clean_generated=False,
    )
    assert materialized["copied"] == 2
    assert (
        repo
        / "client/web/public/assets/runtime/pack99/heroes/PACK_06_HEROES/KAEL_IDLE.png"
    ).is_file()
    assert (
        repo
        / "client/godot/assets/runtime/pack99/heroes/PACK_06_HEROES/KAEL_IDLE.png"
    ).is_file()
