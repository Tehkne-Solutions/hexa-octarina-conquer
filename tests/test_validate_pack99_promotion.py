from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "validate_pack99_promotion.py"
SPEC = importlib.util.spec_from_file_location("validate_pack99_promotion", MODULE_PATH)
assert SPEC and SPEC.loader
promotion = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = promotion
SPEC.loader.exec_module(promotion)


def full_assets() -> list[dict[str, object]]:
    return [
        {
            "id": f"ASSET_{index:04d}",
            "category": "test",
            "_runtimeFile": f"packages/PACK_TEST/assets/ASSET_{index:04d}.png",
        }
        for index in range(promotion.EXPECTED_ASSET_COUNT)
    ]


def write_runtime(root: Path, *, target: str, assets: list[dict[str, object]] | None = None) -> Path:
    runtime = root / "client" / target / ("public/assets/runtime" if target == "web" else "assets/runtime")
    (runtime / "registry").mkdir(parents=True)
    selected_assets = assets if assets is not None else full_assets()
    (runtime / "runtime-install.json").write_text(
        json.dumps(
            {
                "packId": promotion.PACK_ID,
                "version": "1.0.1",
                "profile": "full",
                "assetCount": promotion.EXPECTED_ASSET_COUNT,
                "unresolvedReferences": 0,
                "signature": promotion.SIGNATURE,
            }
        ),
        encoding="utf-8",
    )
    (runtime / "registry" / "assets-runtime.json").write_text(
        json.dumps(
            {
                "project": "Hexa Octarina Conquer",
                "packId": promotion.PACK_ID,
                "version": "1.0.1",
                "profile": "full",
                "assetCount": len(selected_assets),
                "assets": selected_assets,
                "unresolved": [],
                "signature": promotion.SIGNATURE,
            }
        ),
        encoding="utf-8",
    )
    return runtime


class Pack99PromotionTests(unittest.TestCase):
    def test_accepts_identical_full_web_and_godot_runtimes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            web = write_runtime(root, target="web")
            godot = write_runtime(root, target="godot")
            web_result, web_assets = promotion.validate_target(web, "web")
            godot_result, godot_assets = promotion.validate_target(godot, "godot")
            promotion.compare_targets(web_assets, godot_assets)
            self.assertEqual(web_result.unique_ids, 1037)
            self.assertEqual(godot_result.unique_ids, 1037)

    def test_rejects_bootstrap_registry_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            runtime = write_runtime(root, target="web")
            registry_path = runtime / "registry" / "assets-runtime.json"
            registry = json.loads(registry_path.read_text(encoding="utf-8"))
            registry["deployment"] = {"fallback": "procedural", "canonicalAssetCount": 33}
            registry_path.write_text(json.dumps(registry), encoding="utf-8")
            with self.assertRaises(promotion.PromotionError):
                promotion.validate_target(runtime, "web")

    def test_rejects_direct_bootstrap_payload_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            assets = full_assets()
            assets[0]["_runtimeFile"] = "sprites/HERO_GUARDIAN_01_IDLE_SE_01.webp"
            runtime = write_runtime(root, target="godot", assets=assets)
            with self.assertRaises(promotion.PromotionError):
                promotion.validate_target(runtime, "godot")

    def test_rejects_bootstrap_directories_after_clean_install(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            runtime = write_runtime(root, target="web")
            (runtime / "sprites").mkdir()
            with self.assertRaises(promotion.PromotionError):
                promotion.validate_target(runtime, "web")

    def test_rejects_different_canonical_sets_between_targets(self) -> None:
        web_assets = {"ASSET_A": ("packages/a.png",), "ASSET_B": ("packages/b.png",)}
        godot_assets = {"ASSET_A": ("packages/a.png",), "ASSET_C": ("packages/c.png",)}
        with self.assertRaises(promotion.PromotionError):
            promotion.compare_targets(web_assets, godot_assets)

    def test_rejects_different_paths_for_same_id(self) -> None:
        web_assets = {"ASSET_A": ("packages/web.png",)}
        godot_assets = {"ASSET_A": ("packages/godot.png",)}
        with self.assertRaises(promotion.PromotionError):
            promotion.compare_targets(web_assets, godot_assets)


if __name__ == "__main__":
    unittest.main()
