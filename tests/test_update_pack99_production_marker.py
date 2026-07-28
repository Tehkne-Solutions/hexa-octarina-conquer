from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "update_pack99_production_marker.py"
SPEC = importlib.util.spec_from_file_location("update_pack99_production_marker", MODULE_PATH)
assert SPEC and SPEC.loader
marker_module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = marker_module
SPEC.loader.exec_module(marker_module)


class UpdatePack99ProductionMarkerTests(unittest.TestCase):
    def current(self):
        return {
            "project": "Hexa Octarina Conquer",
            "packId": marker_module.PACK_ID,
            "sourceVersion": "1.0.2",
            "releaseTag": "pack99-runtime-v1.0.2",
            "status": "awaiting-release",
            "required": False,
            "productionUrl": "https://example.test",
            "signature": marker_module.SIGNATURE,
        }

    def archive(self, target: str):
        return {
            "packId": marker_module.PACK_ID,
            "target": target,
            "profile": "full",
            "canonicalAssetCount": 1037,
            "materializedAssetCount": 1850,
            "archive": f"hoc-pack99-{target}-full.zip",
            "bytes": 583000000,
            "sha256": "a" * 64 if target == "web" else "b" * 64,
            "passed": True,
            "signature": marker_module.SIGNATURE,
        }

    def promotion(self):
        return {
            "packId": marker_module.PACK_ID,
            "profile": "full",
            "expectedAssetIds": 1037,
            "targets": [{"target": "web"}, {"target": "godot"}],
            "bootstrapAssetIds": 0,
            "bootstrapAliases": 0,
            "proceduralFallbackMode": False,
            "passed": True,
            "signature": marker_module.SIGNATURE,
        }

    def production(self):
        return {
            "packId": marker_module.PACK_ID,
            "baseUrl": "https://game.example",
            "profile": "full",
            "runtimeMode": "full",
            "canonicalAssetCount": 1037,
            "materializedAssetCount": 1850,
            "sampleCount": 12,
            "verifiedAtUtc": "2026-07-28T12:00:00Z",
            "passed": True,
            "signature": marker_module.SIGNATURE,
        }

    def test_release_published_keeps_bootstrap_permitted(self):
        marker = marker_module.build_marker(
            self.current(), self.archive("web"), self.archive("godot"), self.promotion(),
            status="release-published", timestamp="2026-07-28T11:00:00Z",
        )
        self.assertEqual("release-published", marker["status"])
        self.assertFalse(marker["required"])
        self.assertTrue(marker["promotionReportPassed"])
        self.assertIsNone(marker["promotedAtUtc"])

    def test_promoted_requires_validated_production(self):
        marker = marker_module.build_marker(
            self.current(), self.archive("web"), self.archive("godot"), self.promotion(),
            status="promoted", production=self.production(), timestamp="2026-07-28T12:05:00Z",
        )
        self.assertEqual("promoted", marker["status"])
        self.assertTrue(marker["required"])
        self.assertEqual("https://game.example", marker["productionUrl"])
        self.assertEqual(12, marker["productionSampleCount"])

    def test_promoted_rejects_missing_production_report(self):
        with self.assertRaisesRegex(marker_module.MarkerError, "exige relatório"):
            marker_module.build_marker(
                self.current(), self.archive("web"), self.archive("godot"), self.promotion(),
                status="promoted",
            )

    def test_rejects_bootstrap_in_promotion_report(self):
        promotion = self.promotion()
        promotion["bootstrapAssetIds"] = 33
        with self.assertRaisesRegex(marker_module.MarkerError, "bootstrap"):
            marker_module.build_marker(
                self.current(), self.archive("web"), self.archive("godot"), promotion,
                status="release-published",
            )

    def test_rejects_incomplete_archive_report(self):
        web = self.archive("web")
        web["canonicalAssetCount"] = 33
        with self.assertRaisesRegex(marker_module.MarkerError, "cobertura"):
            marker_module.build_marker(
                self.current(), web, self.archive("godot"), self.promotion(),
                status="release-published",
            )


if __name__ == "__main__":
    unittest.main()
