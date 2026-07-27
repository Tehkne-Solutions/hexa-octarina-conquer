from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from scripts import audit_progressive_pack


def fake_png(width: int, height: int, color_type: int = 6) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00\x00\x00\rIHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + bytes([8, color_type, 0, 0, 0])
        + b"test"
    )


class ProgressivePackAuditTests(unittest.TestCase):
    def build_pack00(self, root: Path, *, status: str = "runtime_ready", include_contract: bool = True) -> Path:
        style = fake_png(1536, 1024)
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
        return self._write_archive(root / "pack00.zip", files)

    def build_pack01(self, root: Path, *, overlap: int = 8, missing_runtime_file: bool = False, changed_masks: int = 0) -> Path:
        terrain_suffixes = [
            ("CENTER_A", "center", "A"), ("CENTER_B", "center", "B"), ("CENTER_C", "center", "C"),
            ("EDGE_N", "edge", "A"), ("EDGE_E", "edge", "B"), ("EDGE_S", "edge", "C"), ("EDGE_W", "edge", "A"),
            ("OUTER_NE", "outer-corner", "B"), ("OUTER_NW", "outer-corner", "A"),
            ("OUTER_SE", "outer-corner", "C"), ("OUTER_SW", "outer-corner", "A"),
            ("INNER_NE", "inner-corner", "A"), ("INNER_NW", "inner-corner", "B"),
            ("INNER_SE", "inner-corner", "C"), ("INNER_SW", "inner-corner", "A"),
            ("ISOLATED", "isolated", "A"),
        ]
        files: dict[str, bytes] = {}
        assets: list[dict[str, object]] = []
        terrain_names = audit_progressive_pack.PACK01_TERRAINS

        for subpack, (terrain_id, prefix) in terrain_names.items():
            sub_assets = []
            for suffix, topology, variation in terrain_suffixes:
                asset_id = f"TILE_{prefix}_FLAT_{suffix}_01"
                file_rel = f"tiles/{asset_id}.png"
                mask_rel = f"masks/{asset_id}_MASK.png"
                runtime_file = f"{subpack}/{file_rel}"
                runtime_mask = f"{subpack}/{mask_rel}"
                asset = {
                    "id": asset_id,
                    "file": file_rel,
                    "mask": mask_rel,
                    "terrainId": terrain_id,
                    "topology": topology,
                    "variation": variation,
                    "packageRoot": subpack,
                    "runtimeFile": runtime_file,
                    "runtimeMask": runtime_mask,
                    "_provenance": {
                        "packId": audit_progressive_pack.PACK01_ID,
                        "subpack": subpack,
                        "packageRoot": subpack,
                    },
                }
                assets.append(asset)
                sub_assets.append({"id": asset_id, "file": file_rel, "mask": mask_rel})
                if not (missing_runtime_file and asset_id == "TILE_GRASS_FLAT_CENTER_A_01"):
                    files[runtime_file] = fake_png(1024, 512)
                files[runtime_mask] = fake_png(1024, 1024)
            files[f"{subpack}/README.md"] = b"Tehkne Solutions"
            files[f"{subpack}/manifest.terrain.json"] = json.dumps({
                "packageId": f"HOC_{subpack}",
                "version": "1.1.0" if subpack == "A01_GRASS_ANCESTRAL" else "1.0.0",
                "status": "runtime-ready",
                "technical": {
                    "edgeBleedPx": 8,
                    "overlapPx": overlap,
                    "recommendedRuntimeGridStepPx": [252, 124],
                },
                "assets": sub_assets,
                "signature": audit_progressive_pack.SIGNATURE,
            }).encode()
            files[f"{subpack}/autotile-rules.json"] = b"{}"
            files[f"{subpack}/tileset.ts"] = b"export const Tiles = {}"
            files[f"{subpack}/validation/{prefix}_16_ASSETS_PREVIEW.png"] = fake_png(100, 100)
            files[f"{subpack}/validation/{prefix}_3X3_CONNECTION_TEST.png"] = fake_png(100, 100)

        support_ids = [
            "PATH_DIRT_STRAIGHT_NS_01", "PATH_DIRT_STRAIGHT_EW_01", "PATH_DIRT_BEND_NE_01",
            "PATH_DIRT_BEND_NW_01", "PATH_DIRT_BEND_SE_01", "PATH_DIRT_BEND_SW_01", "PATH_DIRT_CROSS_01",
        ]
        support_assets = []
        for asset_id in support_ids:
            file_rel = f"tiles/{asset_id}.png"
            runtime_file = f"A07_SUPPORT_MODULES/{file_rel}"
            assets.append({
                "id": asset_id,
                "file": file_rel,
                "role": "path",
                "packageRoot": "A07_SUPPORT_MODULES",
                "runtimeFile": runtime_file,
                "_provenance": {
                    "packId": audit_progressive_pack.PACK01_ID,
                    "subpack": "A07_SUPPORT_MODULES",
                    "packageRoot": "A07_SUPPORT_MODULES",
                },
            })
            support_assets.append({"id": asset_id, "file": file_rel})
            files[runtime_file] = fake_png(1024, 512)
        files["A07_SUPPORT_MODULES/manifest.support.json"] = json.dumps({
            "status": "runtime-ready",
            "contains": support_assets,
            "signature": audit_progressive_pack.SIGNATURE,
        }).encode()
        files["A07_SUPPORT_MODULES/validation/A07_SUPPORT_PREVIEW.png"] = fake_png(100, 100)

        registry = {
            "packId": audit_progressive_pack.PACK01_ID,
            "version": "1.1.0",
            "status": "runtime-ready",
            "assetCount": 103,
            "assets": assets,
            "signature": audit_progressive_pack.SIGNATURE,
        }
        files["assets-registry.json"] = json.dumps(registry).encode()
        files["registry/assets-registry.json"] = json.dumps(registry).encode()
        files["registry/pack-registry.json"] = b"{}"
        files["README.md"] = b"Tehkne Solutions"
        files["pack-manifest.json"] = json.dumps({
            "packId": audit_progressive_pack.PACK01_ID,
            "version": "1.1.0",
            "status": "runtime_ready",
            "summary": {"runtimeAssetCount": 103, "edgeBleedPx": 8, "runtimeGridStepPx": [252, 124]},
            "signature": audit_progressive_pack.SIGNATURE,
        }).encode()
        files["specs/terrain-runtime-contract.json"] = json.dumps({
            "requirements": {
                "masterCanvasPx": [1024, 512], "runtimeTilePx": [512, 256],
                "runtimeGridStepPx": [252, 124], "edgeBleedPx": 8,
                "canonicalIdsIdentical": True, "zeroUnresolvedReferences": True, "webGodotPathParity": True,
            },
            "signature": audit_progressive_pack.SIGNATURE,
        }).encode()
        files["specs/autotile-contract.json"] = json.dumps({
            "bitOrder": ["N", "E", "S", "W"],
            "baseTilesPerTerrain": 3,
            "transitionAssetsPerTerrain": 13,
            "signature": audit_progressive_pack.SIGNATURE,
        }).encode()
        files["validation/validation-report.json"] = json.dumps({
            "passed": True,
            "promotionReady": False,
            "checks": {"runtimeAssets": 103, "unresolvedReferences": 0, "overlayA01Applied": True},
            "signature": audit_progressive_pack.SIGNATURE,
        }).encode()
        files["validation/a01-overlay-report.json"] = json.dumps({
            "decision": "applied",
            "sourceArchive": {"sha256": audit_progressive_pack.PACK01_A01_OVERLAY_SHA256},
            "comparison": {"changedTiles": 10, "changedMasks": changed_masks, "idsChanged": False, "geometryChanged": False},
            "signature": audit_progressive_pack.SIGNATURE,
        }).encode()
        files["validation/PACK01_TERRAIN_FAMILIES_PREVIEW.png"] = fake_png(100, 100)
        files["LICENSE-ASSETS.md"] = b"license"
        files["CHANGELOG.md"] = b"changelog"
        return self._write_archive(root / "pack01.zip", files)

    def _write_archive(self, archive: Path, files: dict[str, bytes]) -> Path:
        checksum_lines = [f"{hashlib.sha256(data).hexdigest()}  {name}" for name, data in sorted(files.items())]
        files["SHA256SUMS.txt"] = ("\n".join(checksum_lines) + "\n").encode()
        with zipfile.ZipFile(archive, "w") as target:
            for name, data in files.items():
                target.writestr(name, data)
        return archive

    def test_accepts_complete_pack00(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            report = audit_progressive_pack.audit(self.build_pack00(Path(temp)))
            self.assertTrue(report["passed"])
            self.assertEqual(1, report["pack"]["referenceAssets"])
            self.assertEqual(0, report["pack"]["runtimeAssets"])

    def test_rejects_original_partial_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(audit_progressive_pack.AuditError, "runtime_ready"):
                audit_progressive_pack.audit(self.build_pack00(Path(temp), status="partial"))

    def test_rejects_missing_runtime_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(audit_progressive_pack.AuditError, "incompleto"):
                audit_progressive_pack.audit(self.build_pack00(Path(temp), include_contract=False))

    def test_rejects_unsafe_zip_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "unsafe.zip"
            with zipfile.ZipFile(archive, "w") as target:
                target.writestr("../escape.txt", b"bad")
                target.writestr("pack-manifest.json", b"{}")
            with self.assertRaisesRegex(audit_progressive_pack.AuditError, "inseguro"):
                audit_progressive_pack.audit(archive)

    def test_accepts_complete_pack01(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            report = audit_progressive_pack.audit(self.build_pack01(Path(temp)))
            self.assertTrue(report["passed"])
            self.assertEqual(103, report["pack"]["runtimeAssets"])
            self.assertEqual(96, report["pack"]["masksValidated"])
            self.assertEqual(8, report["pack"]["edgeBleedPx"])

    def test_rejects_pack01_zero_overlap(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(audit_progressive_pack.AuditError, "overlap"):
                audit_progressive_pack.audit(self.build_pack01(Path(temp), overlap=0))

    def test_rejects_pack01_missing_runtime_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(audit_progressive_pack.AuditError, "Referências não resolvidas"):
                audit_progressive_pack.audit(self.build_pack01(Path(temp), missing_runtime_file=True))

    def test_rejects_pack01_overlay_mask_change(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(audit_progressive_pack.AuditError, "preserva máscaras"):
                audit_progressive_pack.audit(self.build_pack01(Path(temp), changed_masks=1))


if __name__ == "__main__":
    unittest.main()
