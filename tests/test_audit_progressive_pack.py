from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from scripts import audit_progressive_pack


class ProgressivePackAuditTests(unittest.TestCase):
    def build_pack(self, root: Path, *, status: str = "runtime_ready", include_contract: bool = True) -> Path:
        style = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8 + (1536).to_bytes(4, "big") + (1024).to_bytes(4, "big") + b"data"
        files: dict[str, bytes] = {
            "README.md": b"Tehkne Solutions",
            "STYLE_LOCK_01.png": style,
            "pack-manifest.json": json.dumps({
                "packId": audit_progressive_pack.PACK00_ID,
                "version": "1.1.0",
                "status": status,
                "runtimeAssetCount": 0,
                "signature": audit_progressive_pack.SIGNATURE,
            }).encode(),
            "registry/assets-registry.json": json.dumps({
                "signature": audit_progressive_pack.SIGNATURE,
                "assets": [{
                    "id": "REF_STYLE_LOCK_01",
                    "runtime": False,
                    "file": "STYLE_LOCK_01.png",
                    "width": 1536,
                    "height": 1024,
                    "sha256": hashlib.sha256(style).hexdigest(),
                }],
            }).encode(),
            "registry/pack-registry.json": b"{}",
            "specs/art-bible.json": b"{}",
            "specs/naming-conventions.json": b"{}",
            "validation/validation-report.json": json.dumps({
                "passed": True,
                "signature": audit_progressive_pack.SIGNATURE,
            }).encode(),
            "LICENSE-ASSETS.md": b"license",
            "CHANGELOG.md": b"changelog",
        }
        if include_contract:
            files["specs/runtime-contract.json"] = json.dumps({
                "signature": audit_progressive_pack.SIGNATURE,
                "requirements": {
                    "canonicalIdsIdentical": True,
                    "zeroUnresolvedReferences": True,
                    "referenceOnlyAssetsExcludedFromRuntime": True,
                },
            }).encode()
        checksum_lines = [
            f"{hashlib.sha256(data).hexdigest()}  {name}"
            for name, data in sorted(files.items())
        ]
        files["SHA256SUMS.txt"] = ("\n".join(checksum_lines) + "\n").encode()
        archive = root / "pack00.zip"
        with zipfile.ZipFile(archive, "w") as target:
            for name, data in files.items():
                target.writestr(name, data)
        return archive

    def test_accepts_complete_pack00(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            report = audit_progressive_pack.audit(self.build_pack(Path(temp)))
            self.assertTrue(report["passed"])
            self.assertEqual(1, report["pack"]["referenceAssets"])
            self.assertEqual(0, report["pack"]["runtimeAssets"])

    def test_rejects_original_partial_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            archive = self.build_pack(Path(temp), status="partial")
            with self.assertRaisesRegex(audit_progressive_pack.AuditError, "runtime_ready"):
                audit_progressive_pack.audit(archive)

    def test_rejects_missing_runtime_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            archive = self.build_pack(Path(temp), include_contract=False)
            with self.assertRaisesRegex(audit_progressive_pack.AuditError, "incompleto"):
                audit_progressive_pack.audit(archive)

    def test_rejects_unsafe_zip_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "unsafe.zip"
            with zipfile.ZipFile(archive, "w") as target:
                target.writestr("../escape.txt", b"bad")
                target.writestr("pack-manifest.json", b"{}")
            with self.assertRaisesRegex(audit_progressive_pack.AuditError, "inseguro"):
                audit_progressive_pack.audit(archive)


if __name__ == "__main__":
    unittest.main()
