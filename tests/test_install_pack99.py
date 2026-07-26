from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "install_pack99.py"
SPEC = importlib.util.spec_from_file_location("install_pack99", MODULE_PATH)
assert SPEC and SPEC.loader
install_pack99 = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = install_pack99
SPEC.loader.exec_module(install_pack99)


class InstallPack99Tests(unittest.TestCase):
    def make_fake_pack(self, root: Path) -> Path:
        pack = root / "HOC_PACK_99_FINAL_RUNTIME"
        asset_path = (
            pack
            / "packages"
            / "PACK_02_BOARD_SYSTEM"
            / "P02_EDGES"
            / "stone"
            / "EDGE_STONE_BUILT_NE_SW_01.png"
        )
        asset_path.parent.mkdir(parents=True)
        asset_path.write_bytes(b"fake-png")

        (pack / "validation").mkdir()
        (pack / "registry").mkdir()
        (pack / "pack-manifest.json").write_text(
            json.dumps(
                {
                    "packId": install_pack99.PACK_ID,
                    "version": "1.0.0",
                    "signature": install_pack99.SIGNATURE,
                }
            ),
            encoding="utf-8",
        )
        (pack / "validation" / "validation-report.json").write_text(
            json.dumps({"passed": True}),
            encoding="utf-8",
        )
        (pack / "registry" / "assets-global.json").write_text(
            json.dumps(
                {
                    "project": "Hexa Octarina Conquer",
                    "packId": install_pack99.PACK_ID,
                    "assets": [
                        {
                            "id": "EDGE_STONE_BUILT_NE_SW_01",
                            "category": "board-edge",
                            "file": "P02_EDGES/stone/EDGE_STONE_BUILT_NE_SW_01.png",
                            "_provenance": {
                                "packageRoot": "packages/HOC_PACK_02_BOARD_SYSTEM_FINAL"
                            },
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        (pack / "registry" / "entities-global.json").write_text(
            json.dumps({"entities": []}),
            encoding="utf-8",
        )
        (pack / "registry" / "packs-global.json").write_text(
            json.dumps({"packs": []}),
            encoding="utf-8",
        )
        return pack

    def test_normalizes_original_package_root_names(self) -> None:
        self.assertEqual(
            "packages/PACK_02_BOARD_SYSTEM",
            install_pack99.normalize_package_root_value(
                "packages/HOC_PACK_02_BOARD_SYSTEM_FINAL"
            ),
        )

    def test_normalizes_nested_asset_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            pack = self.make_fake_pack(root)
            repo = root / "repo"
            (repo / "client" / "godot").mkdir(parents=True)

            manifest, _validation, registry = install_pack99.validate_pack(
                pack,
                require_canonical_count=False,
            )
            destination = repo / "client" / "godot" / "assets" / "runtime"
            result = install_pack99.install_target(
                pack,
                destination,
                registry,
                manifest,
                profile="core",
                clean=True,
                dry_run=False,
                enforce_canonical_counts=False,
            )

            self.assertEqual(1, result["assetCount"])
            self.assertEqual(0, result["unresolvedReferences"])
            runtime_registry = json.loads(
                (
                    destination
                    / "registry"
                    / install_pack99.RUNTIME_REGISTRY_NAME
                ).read_text(encoding="utf-8")
            )
            asset = runtime_registry["assets"][0]
            self.assertEqual(
                "packages/PACK_02_BOARD_SYSTEM/P02_EDGES/stone/"
                "EDGE_STONE_BUILT_NE_SW_01.png",
                asset["_runtimeFile"],
            )
            self.assertTrue((destination / asset["_runtimeFile"]).is_file())

    def test_unresolved_plan_does_not_delete_existing_runtime(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            pack = self.make_fake_pack(root)
            registry_path = pack / "registry" / "assets-global.json"
            registry = json.loads(registry_path.read_text(encoding="utf-8"))
            registry["assets"][0]["file"] = "missing/DOES_NOT_EXIST.png"
            registry_path.write_text(json.dumps(registry), encoding="utf-8")

            manifest, _validation, registry = install_pack99.validate_pack(
                pack,
                require_canonical_count=False,
            )
            destination = root / "repo" / "client" / "web" / "public" / "assets" / "runtime"
            destination.mkdir(parents=True)
            sentinel = destination / "bootstrap-safe.txt"
            sentinel.write_text("preserve", encoding="utf-8")

            with self.assertRaises(install_pack99.InstallError):
                install_pack99.install_target(
                    pack,
                    destination,
                    registry,
                    manifest,
                    profile="core",
                    clean=True,
                    dry_run=False,
                    enforce_canonical_counts=False,
                )

            self.assertEqual("preserve", sentinel.read_text(encoding="utf-8"))

    def test_rejects_failed_validation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            pack = self.make_fake_pack(root)
            (pack / "validation" / "validation-report.json").write_text(
                json.dumps({"passed": False}),
                encoding="utf-8",
            )
            with self.assertRaises(install_pack99.InstallError):
                install_pack99.validate_pack(
                    pack,
                    require_canonical_count=False,
                )


if __name__ == "__main__":
    unittest.main()
