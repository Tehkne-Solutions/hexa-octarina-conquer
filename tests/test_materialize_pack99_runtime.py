from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "materialize_pack99_runtime.py"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


def test_materializer_applies_policy_and_excludes_style_lock(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    (repo / ".git").mkdir(parents=True)

    asset_file = repo / "assets/pack99/source/packages/PACK_01_TERRAIN/tile.png"
    manifest_file = repo / "assets/pack99/source/pack-manifest.json"
    style_lock_file = repo / "assets/pack99/source/packages/PACK_00_FOUNDATION/STYLE_LOCK_01.png"
    asset_file.parent.mkdir(parents=True, exist_ok=True)
    manifest_file.parent.mkdir(parents=True, exist_ok=True)
    style_lock_file.parent.mkdir(parents=True, exist_ok=True)
    asset_file.write_bytes(b"tile")
    manifest_file.write_text("{}", encoding="utf-8")
    style_lock_file.write_bytes(b"reference")

    catalog = {
        "packId": "HOC_PACK_99_FINAL_RUNTIME_RECOVERED",
        "assets": [
            {
                "id": "TILE_A",
                "source_path": "packages/PACK_01_TERRAIN/tile.png",
                "canonical_path": "assets/pack99/source/packages/PACK_01_TERRAIN/tile.png",
                "category": "terrain",
                "pack_hint": "PACK_01",
                "sha256": "1",
                "bytes": 4,
                "duplicate_of": None,
                "runtime_candidate": True,
            },
            {
                "id": "PACK_MANIFEST",
                "source_path": "pack-manifest.json",
                "canonical_path": "assets/pack99/source/pack-manifest.json",
                "category": "unclassified",
                "pack_hint": None,
                "sha256": "2",
                "bytes": 2,
                "duplicate_of": None,
                "runtime_candidate": True,
            },
            {
                "id": "STYLE_LOCK_01",
                "source_path": "packages/PACK_00_FOUNDATION/STYLE_LOCK_01.png",
                "canonical_path": "assets/pack99/source/packages/PACK_00_FOUNDATION/STYLE_LOCK_01.png",
                "category": "unclassified",
                "pack_hint": "PACK_00",
                "sha256": "3",
                "bytes": 9,
                "duplicate_of": None,
                "runtime_candidate": True,
            },
        ],
    }
    policy = {
        "packId": "HOC_PACK_99_FINAL_RUNTIME_RECOVERED",
        "categoryOverrides": {
            "pack-manifest.json": "manifest",
            "packages/PACK_00_FOUNDATION/STYLE_LOCK_01.png": "reference",
        },
        "excludeFromRuntime": [
            "packages/PACK_00_FOUNDATION/STYLE_LOCK_01.png"
        ],
    }
    contract_root = repo / "runtime/packs/PACK_99_RECOVERED"
    write_json(contract_root / "asset-catalog.json", catalog)
    write_json(contract_root / "runtime-policy.json", policy)

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--repo",
            str(repo),
            "--materialize-mode",
            "copy",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr

    runtime_index = json.loads(
        (contract_root / "runtime-index.json").read_text(encoding="utf-8")
    )
    assert runtime_index["assetCount"] == 2
    assert runtime_index["excludedCount"] == 1
    assert {asset["category"] for asset in runtime_index["assets"]} == {
        "terrain",
        "manifest",
    }
    assert not (
        repo
        / "client/web/public/assets/runtime/pack99/reference/packages/PACK_00_FOUNDATION/STYLE_LOCK_01.png"
    ).exists()
    assert (
        repo
        / "client/web/public/assets/runtime/pack99/manifest/pack-manifest.json"
    ).is_file()
