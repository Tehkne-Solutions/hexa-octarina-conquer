from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "sync_pack99.py"
SPEC = importlib.util.spec_from_file_location("sync_pack99", MODULE_PATH)
assert SPEC and SPEC.loader
sync_pack99 = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = sync_pack99
SPEC.loader.exec_module(sync_pack99)


class SyncPack99Tests(unittest.TestCase):
    def test_normalize_sha256_rejects_invalid_values(self) -> None:
        with self.assertRaises(sync_pack99.SyncError):
            sync_pack99.normalize_sha256("not-a-checksum")

    def test_verify_archive_accepts_matching_file(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            archive = Path(temporary_directory) / "pack.zip"
            archive.write_bytes(b"pack-99-test")
            expected = hashlib.sha256(b"pack-99-test").hexdigest()
            self.assertEqual(sync_pack99.verify_archive(archive, expected), expected)

    def test_verify_archive_rejects_checksum_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            archive = Path(temporary_directory) / "pack.zip"
            archive.write_bytes(b"tampered")
            with self.assertRaises(sync_pack99.SyncError):
                sync_pack99.verify_archive(archive, "0" * 64)

    def test_installer_command_preserves_profile_and_target(self) -> None:
        command = sync_pack99.installer_command(
            Path("/repo"),
            Path("/cache/pack.zip"),
            target="all",
            profile="full",
            clean=True,
            dry_run=True,
        )
        self.assertIn("--target", command)
        self.assertIn("all", command)
        self.assertIn("--profile", command)
        self.assertIn("full", command)
        self.assertIn("--clean", command)
        self.assertIn("--dry-run", command)

    def test_validate_install_manifest_accepts_complete_core(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            manifest = Path(temporary_directory) / "client" / "godot" / "runtime-install.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(
                json.dumps(
                    {
                        "packId": sync_pack99.PACK_ID,
                        "signature": sync_pack99.SIGNATURE,
                        "profile": "core",
                        "assetCount": 597,
                        "unresolvedReferences": 0,
                    }
                ),
                encoding="utf-8",
            )
            result = sync_pack99.validate_install_manifest(manifest, "core")
            self.assertEqual(result.target, "godot")
            self.assertEqual(result.asset_count, 597)

    def test_validate_install_manifest_rejects_incomplete_full_profile(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            manifest = Path(temporary_directory) / "runtime-install.json"
            manifest.write_text(
                json.dumps(
                    {
                        "packId": sync_pack99.PACK_ID,
                        "signature": sync_pack99.SIGNATURE,
                        "profile": "full",
                        "assetCount": 1036,
                        "unresolvedReferences": 0,
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaises(sync_pack99.SyncError):
                sync_pack99.validate_install_manifest(manifest, "full")


if __name__ == "__main__":
    unittest.main()
