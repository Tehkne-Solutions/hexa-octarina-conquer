from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "rebuild_pack99_local",
    ROOT / "scripts" / "rebuild_pack99_local.py",
)
assert SPEC and SPEC.loader
runner = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = runner
SPEC.loader.exec_module(runner)


class RebuildPack99LocalTests(unittest.TestCase):
    def write_metadata(self, root: Path) -> None:
        files = {
            "pack-manifest.json": {
                "packId": runner.PACK_ID,
                "signature": runner.SIGNATURE,
            },
            "registry/assets-global.json": {"assets": []},
            "registry/entities-global.json": {"entities": []},
            "registry/packs-global.json": {"packs": []},
            "validation/validation-report.json": {"passed": True},
        }
        for relative, payload in files.items():
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(payload), encoding="utf-8")
        checksum = root / "checksums" / "SHA256SUMS.txt"
        checksum.parent.mkdir(parents=True, exist_ok=True)
        checksum.write_text("", encoding="utf-8")

    def test_metadata_root_requires_all_markers(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.assertFalse(runner.is_metadata_root(root))
            self.write_metadata(root)
            self.assertTrue(runner.is_metadata_root(root))
            (root / "registry" / "packs-global.json").unlink()
            self.assertFalse(runner.is_metadata_root(root))

    def test_extracts_global_metadata_without_packages(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            self.write_metadata(source)
            package_file = source / "packages" / "PACK_00_FOUNDATION" / "asset.bin"
            package_file.parent.mkdir(parents=True)
            package_file.write_bytes(b"asset")
            archive = root / "runtime.zip"
            with zipfile.ZipFile(archive, "w") as handle:
                for path in source.rglob("*"):
                    if path.is_file():
                        handle.write(path, Path("HOC_PACK_99_FINAL_RUNTIME") / path.relative_to(source))

            destination = root / "metadata"
            extracted = runner.extract_metadata_from_archive(archive, destination)
            self.assertTrue(runner.is_metadata_root(extracted))
            self.assertFalse((destination / "packages").exists())

    def test_rejects_unsafe_metadata_archive(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / "unsafe.zip"
            with zipfile.ZipFile(archive, "w") as handle:
                handle.writestr("pack-manifest.json", "{}")
                handle.writestr("../escape.txt", "blocked")
            with self.assertRaises(runner.RunnerError):
                runner.extract_metadata_from_archive(archive, root / "metadata")

    def test_source_inventory_requires_all_archives(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for name in (*runner.PACK_ARCHIVES, runner.A01_ARCHIVE):
                with zipfile.ZipFile(root / name, "w") as handle:
                    handle.writestr("marker.txt", name)
            inventory = runner.validate_source_archives(root)
            self.assertEqual(12, len(inventory))
            (root / runner.PACK_ARCHIVES[0]).unlink()
            with self.assertRaises(runner.RunnerError):
                runner.validate_source_archives(root)

    def test_promotion_report_must_be_strictly_green(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "promotion.json"
            payload = {
                "expectedAssetIds": 1037,
                "bootstrapAssetIds": 0,
                "bootstrapAliases": 0,
                "proceduralFallbackMode": False,
                "passed": True,
                "signature": runner.SIGNATURE,
            }
            path.write_text(json.dumps(payload), encoding="utf-8")
            self.assertTrue(runner.validate_promotion(path)["passed"])
            payload["bootstrapAliases"] = 17
            path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaises(runner.RunnerError):
                runner.validate_promotion(path)


if __name__ == "__main__":
    unittest.main()
