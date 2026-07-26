from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "audit_pack99_archive",
    ROOT / "scripts" / "audit_pack99_archive.py",
)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class AuditPack99ArchiveTests(unittest.TestCase):
    def build_archive(self, path: Path, *, unsafe: bool = False) -> None:
        assets = []
        for index in range(module.EXPECTED_ASSETS):
            asset_id = f"ASSET_{index:04d}"
            assets.append(
                {
                    "id": asset_id,
                    "file": f"files/{asset_id}.bin",
                    "_provenance": {"packageRoot": "packages/PACK_00_FOUNDATION"},
                }
            )
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr(
                "pack-manifest.json",
                json.dumps({"packId": module.PACK_ID, "signature": module.SIGNATURE}),
            )
            archive.writestr(
                "registry/assets-global.json",
                json.dumps({"packId": module.PACK_ID, "assets": assets}),
            )
            archive.writestr(
                "registry/entities-global.json",
                json.dumps({"entities": [{} for _ in range(module.EXPECTED_ENTITIES)]}),
            )
            archive.writestr(
                "registry/packs-global.json",
                json.dumps({"packs": [{} for _ in range(module.EXPECTED_PACKS)]}),
            )
            archive.writestr("validation/validation-report.json", json.dumps({"passed": True}))
            for asset in assets:
                archive.writestr(
                    f"packages/PACK_00_FOUNDATION/{asset['file']}",
                    asset["id"].encode("utf-8"),
                )
            if unsafe:
                archive.writestr("../escape.txt", "blocked")

    def test_audits_all_files_and_references(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "pack99.zip"
            report = Path(temporary) / "report.json"
            self.build_archive(archive)
            result = module.audit_archive(archive, report)
            self.assertTrue(result["passed"])
            self.assertEqual(module.EXPECTED_ASSETS, result["assets"])
            self.assertEqual(module.EXPECTED_ASSETS, result["resolvedRuntimeReferences"])
            self.assertEqual(0, result["unresolvedRuntimeReferences"])
            self.assertEqual(result["fileCount"], result["hashedFiles"])
            self.assertTrue(report.is_file())

    def test_rejects_unsafe_members(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "unsafe.zip"
            self.build_archive(archive, unsafe=True)
            with self.assertRaises(module.AuditError):
                module.audit_archive(archive)

    def test_rejects_missing_runtime_reference(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "missing.zip"
            self.build_archive(archive)
            rewritten = Path(temporary) / "rewritten.zip"
            with zipfile.ZipFile(archive) as source, zipfile.ZipFile(rewritten, "w") as destination:
                skipped = "packages/PACK_00_FOUNDATION/files/ASSET_0000.bin"
                for info in source.infolist():
                    if info.filename != skipped:
                        destination.writestr(info, source.read(info.filename))
            with self.assertRaises(module.AuditError):
                module.audit_archive(rewritten)


if __name__ == "__main__":
    unittest.main()
