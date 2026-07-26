from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))
MODULE_PATH = SCRIPTS_DIR / "sync_pack99_parts.py"
SPEC = importlib.util.spec_from_file_location("sync_pack99_parts", MODULE_PATH)
assert SPEC and SPEC.loader
sync_parts = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = sync_parts
SPEC.loader.exec_module(sync_parts)


def valid_manifest() -> dict:
    archives = [
        {
            "name": name,
            "url": f"https://assets.example.test/{name}",
            "sha256": "a" * 64,
        }
        for name in sync_parts.PACK_ARCHIVES
    ]
    return {
        "project": "Hexa Octarina Conquer",
        "packId": sync_parts.PACK_ID,
        "signature": sync_parts.SIGNATURE,
        "metadata": {
            "name": "HOC_PACK_99_METADATA.zip",
            "url": "https://assets.example.test/HOC_PACK_99_METADATA.zip",
            "sha256": "b" * 64,
        },
        "archives": archives,
        "recovered": {"sha256": sync_parts.RECOVERED_SHA256},
    }


class SyncPack99PartsTests(unittest.TestCase):
    def test_validate_manifest_accepts_exact_eleven_packs(self) -> None:
        metadata, archives, recovered = sync_parts.validate_manifest(valid_manifest())
        self.assertEqual(metadata.name, "HOC_PACK_99_METADATA.zip")
        self.assertEqual(len(archives), 11)
        self.assertEqual(recovered, sync_parts.RECOVERED_SHA256)

    def test_validate_manifest_rejects_missing_pack(self) -> None:
        manifest = valid_manifest()
        manifest["archives"].pop()
        with self.assertRaises(sync_parts.PartsSyncError):
            sync_parts.validate_manifest(manifest)

    def test_validate_manifest_rejects_duplicate_pack(self) -> None:
        manifest = valid_manifest()
        manifest["archives"].append(dict(manifest["archives"][0]))
        with self.assertRaises(sync_parts.PartsSyncError):
            sync_parts.validate_manifest(manifest)

    def test_validate_manifest_rejects_http_sources(self) -> None:
        manifest = valid_manifest()
        manifest["archives"][0]["url"] = "http://assets.example.test/pack.zip"
        with self.assertRaises(sync_parts.PartsSyncError):
            sync_parts.validate_manifest(manifest)

    def test_validate_manifest_rejects_wrong_signature(self) -> None:
        manifest = valid_manifest()
        manifest["signature"] = "Outra empresa"
        with self.assertRaises(sync_parts.PartsSyncError):
            sync_parts.validate_manifest(manifest)

    def test_sync_command_passes_recovered_checksum(self) -> None:
        command = sync_parts.sync_command(
            Path("/repo"),
            Path("/cache/recovered.zip"),
            sync_parts.RECOVERED_SHA256,
            target="all",
            profile="full",
            clean=True,
            dry_run=True,
        )
        self.assertIn("--expected-sha256", command)
        self.assertIn(sync_parts.RECOVERED_SHA256, command)
        self.assertIn("--target", command)
        self.assertIn("all", command)
        self.assertIn("--profile", command)
        self.assertIn("full", command)
        self.assertIn("--clean", command)
        self.assertIn("--dry-run", command)


if __name__ == "__main__":
    unittest.main()
