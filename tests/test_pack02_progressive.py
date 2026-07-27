from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from scripts import audit_pack02, install_pack02


def fake_png(width: int = 1024, height: int = 1024) -> bytes:
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 8 + width.to_bytes(4, "big") + height.to_bytes(4, "big") + b"\x08\x06"


def write_json_bytes(payload: object) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


class Pack02Fixture:
    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}
        self.assets: list[dict[str, object]] = []
        self.sub_assets: dict[str, list[dict[str, object]]] = {
            "P01_PILLARS": [],
            "P02_EDGES": [],
            "P03_TERRITORY_EVOLUTION": [],
        }
        self._build_assets()
        self._build_metadata()

    def _asset(self, package: str, asset: dict[str, object], emissive: bool = False) -> None:
        asset_id = str(asset["id"])
        file_rel = str(asset["file"])
        shadow_rel = str(asset["shadow"])
        self.files[f"{package}/{file_rel}"] = fake_png()
        self.files[f"{package}/{shadow_rel}"] = fake_png()
        asset["packageRoot"] = package
        asset["runtimeFile"] = f"{package}/{file_rel}"
        asset["runtimeShadow"] = f"{package}/{shadow_rel}"
        if emissive:
            emissive_rel = str(asset["emissive"])
            self.files[f"{package}/{emissive_rel}"] = fake_png()
            asset["runtimeEmissive"] = f"{package}/{emissive_rel}"
        asset["renderLayer"] = 600 if package == "P01_PILLARS" else 200 if package == "P02_EDGES" else 500
        asset["_provenance"] = {
            "packId": audit_pack02.PACK_ID,
            "canonicalPackId": audit_pack02.CANONICAL_PACK_ID,
            "packageRoot": package,
            "manifest": audit_pack02.PACKAGE_ROOTS[package][0],
            "version": audit_pack02.VERSION,
        }
        self.assets.append(dict(asset))
        relative = dict(asset)
        for key in ("packageRoot", "runtimeFile", "runtimeShadow", "runtimeEmissive", "renderLayer", "_provenance"):
            relative.pop(key, None)
        self.sub_assets[package].append(relative)

    def _build_assets(self) -> None:
        pillar_emissive = {"neutral", "blue", "red", "energized", "selected"}
        for state in sorted(audit_pack02.PILLAR_STATES):
            asset_id = f"PILLAR_{state.upper()}_01"
            self._asset("P01_PILLARS", {
                "id": asset_id,
                "name": asset_id,
                "state": state,
                "file": f"assets/{asset_id}.png",
                "shadow": f"assets/{asset_id}_SHADOW.png",
                "emissive": f"assets/{asset_id}_EMISSIVE.png" if state in pillar_emissive else None,
                "category": "board-node",
                "footprint": [0, 0],
                "gridRole": "intersection",
                "anchor": [0.5, 0.92],
                "collision": "none",
                "selectable": True,
                "canvasPx": [1024, 1024],
            }, emissive=state in pillar_emissive)

        for material in sorted(audit_pack02.EDGE_MATERIALS):
            for state in sorted(audit_pack02.EDGE_STATES):
                for orientation in sorted(audit_pack02.EDGE_ORIENTATIONS):
                    asset_id = f"EDGE_{material.upper()}_{state.upper()}_{orientation}_01"
                    self._asset("P02_EDGES", {
                        "id": asset_id,
                        "material": material,
                        "state": state,
                        "orientation": orientation,
                        "file": f"{material}/{asset_id}.png",
                        "shadow": f"{material}/{asset_id}_SHADOW.png",
                        "emissive": f"{material}/{asset_id}_EMISSIVE.png" if material == "arcane" else None,
                        "category": "board-edge",
                        "connects": "two-intersections",
                        "logicalLength": 1,
                        "anchor": [0.5, 0.78],
                        "collision": "none" if state in {"preview", "destroyed"} else "blocking-edge",
                        "destructible": state != "preview",
                        "canvasPx": [1024, 1024],
                    }, emissive=material == "arcane")

        bases = ["SIGIL", "CAMP", "OUTPOST", "FORT", "CITADEL"]
        for stage, base in enumerate(bases, start=1):
            for state in sorted(audit_pack02.TERRITORY_STATES):
                asset_id = f"TERR_{base}_{state.upper()}_01"
                has_emissive = state in {"blue", "red", "damaged"}
                self._asset("P03_TERRITORY_EVOLUTION", {
                    "id": asset_id,
                    "baseId": f"TERR_{base}_01",
                    "name": base.title(),
                    "stage": stage,
                    "state": state,
                    "file": f"stage_{stage}/{asset_id}.png",
                    "shadow": f"stage_{stage}/{asset_id}_SHADOW.png",
                    "emissive": f"stage_{stage}/{asset_id}_EMISSIVE.png" if has_emissive else None,
                    "category": "territory-structure",
                    "footprint": [3, 3] if stage == 5 else [2, 2],
                    "anchor": [0.5, 0.91],
                    "collision": "structure",
                    "capturable": True,
                    "destructible": True,
                    "canvasPx": [1024, 1024],
                }, emissive=has_emissive)

    def _sub_manifest(self, package: str) -> dict[str, object]:
        manifest_path, _count = audit_pack02.PACKAGE_ROOTS[package]
        manifest: dict[str, object] = {
            "project": "Hexa Octarina Conquer",
            "pack": audit_pack02.PACK_ID,
            "subpack": package,
            "version": audit_pack02.VERSION,
            "status": "runtime-ready",
            "packageRoot": package,
            "technical": {
                "masterCanvasPx": [1024, 1024],
                "colorMode": "RGBA",
                "renderLayer": 600 if package == "P01_PILLARS" else 200 if package == "P02_EDGES" else 500,
                "anchorPolicy": "normalized-bottom-center",
            },
            "assets": self.sub_assets[package],
            "signature": audit_pack02.SIGNATURE,
        }
        if package == "P02_EDGES":
            manifest["orientationConvention"] = {
                "NE_SW": "connects northeast and southwest grid points",
                "NW_SE": "connects northwest and southeast grid points",
            }
        if package == "P03_TERRITORY_EVOLUTION":
            manifest["lineage"] = audit_pack02.TERRITORY_LINEAGE
        self.files[manifest_path] = write_json_bytes(manifest)
        self.files[f"{package}/README.md"] = b"Tehkne Solutions"
        return manifest

    def _build_metadata(self) -> None:
        for package in audit_pack02.PACKAGE_ROOTS:
            self._sub_manifest(package)
        registry = {
            "project": "Hexa Octarina Conquer",
            "packId": audit_pack02.PACK_ID,
            "canonicalPackId": audit_pack02.CANONICAL_PACK_ID,
            "version": audit_pack02.VERSION,
            "status": "validated-local-pending-release",
            "assetCount": audit_pack02.ASSET_COUNT,
            "assets": self.assets,
            "signature": audit_pack02.SIGNATURE,
        }
        self.files["assets-registry.json"] = write_json_bytes(registry)
        self.files["registry/assets-registry.json"] = write_json_bytes(registry)
        self.files["registry/pack-registry.json"] = write_json_bytes({
            "project": "Hexa Octarina Conquer",
            "packId": audit_pack02.PACK_ID,
            "canonicalPackId": audit_pack02.CANONICAL_PACK_ID,
            "version": audit_pack02.VERSION,
            "status": "validated-local-pending-release",
            "assetCount": 55,
            "signature": audit_pack02.SIGNATURE,
        })
        self.files["pack-manifest.json"] = write_json_bytes({
            "project": "Hexa Octarina Conquer",
            "packId": audit_pack02.PACK_ID,
            "canonicalPackId": audit_pack02.CANONICAL_PACK_ID,
            "version": audit_pack02.VERSION,
            "status": "runtime_ready",
            "summary": {"pillars": 6, "edges": 24, "territoryStructures": 25, "runtimeAssets": 55},
            "signature": audit_pack02.SIGNATURE,
        })
        self.files["specs/board-runtime-contract.json"] = write_json_bytes({
            "project": "Hexa Octarina Conquer",
            "requirements": {
                "masterCanvasPx": [1024, 1024],
                "colorMode": "RGBA",
                "canonicalIdsIdentical": True,
                "zeroUnresolvedReferences": True,
                "webGodotPathParity": True,
                "referenceAssetsExcludedFromRuntime": True,
                "anchorMode": "normalized",
                "anchorPolicy": "bottom-center",
            },
            "anchors": {"board-node": [0.5, 0.92], "board-edge": [0.5, 0.78], "territory-structure": [0.5, 0.91]},
            "signature": audit_pack02.SIGNATURE,
        })
        self.files["specs/board-state-contract.json"] = write_json_bytes({
            "project": "Hexa Octarina Conquer",
            "pillars": {"states": sorted(audit_pack02.PILLAR_STATES)},
            "edges": {
                "materials": sorted(audit_pack02.EDGE_MATERIALS),
                "states": sorted(audit_pack02.EDGE_STATES),
                "orientations": sorted(audit_pack02.EDGE_ORIENTATIONS),
            },
            "territory": {"lineage": audit_pack02.TERRITORY_LINEAGE, "states": sorted(audit_pack02.TERRITORY_STATES)},
            "signature": audit_pack02.SIGNATURE,
        })
        self.files["validation/validation-report.json"] = write_json_bytes({
            "passed": True,
            "promotionReady": False,
            "checks": {"runtimeAssets": 55, "unresolvedReferences": 0},
            "signature": audit_pack02.SIGNATURE,
        })
        self.files["validation/canvas-boundary-report.json"] = write_json_bytes({
            "passed": True,
            "checks": {"topBoundaryContacts": 0, "leftBoundaryContacts": 0, "rightBoundaryContacts": 0},
            "signature": audit_pack02.SIGNATURE,
        })
        for preview in (
            "PILLARS_PREVIEW.png",
            "EDGES_PREVIEW.png",
            "TERRITORY_PREVIEW.png",
            "PACK02_BOARD_SYSTEM_PREVIEW.png",
            "PACK02_CONNECTION_TEST.png",
        ):
            self.files[f"validation/{preview}"] = fake_png()
        self.files["README.md"] = b"Tehkne Solutions"
        self.files["LICENSE-ASSETS.md"] = b"Tehkne Solutions"
        self.files["CHANGELOG.md"] = b"Tehkne Solutions"
        self.files["board-system.ts"] = b"// Tehkne Solutions"

    def archive(self, root: Path, *, remove: str | None = None, duplicate_first_id: bool = False) -> Path:
        files = dict(self.files)
        if remove:
            files.pop(remove, None)
        if duplicate_first_id:
            registry = json.loads(files["registry/assets-registry.json"])
            registry["assets"][1]["id"] = registry["assets"][0]["id"]
            files["registry/assets-registry.json"] = write_json_bytes(registry)
            files["assets-registry.json"] = write_json_bytes(registry)
        checksum_lines = [
            f"{hashlib.sha256(data).hexdigest()}  {name}"
            for name, data in sorted(files.items())
        ]
        files["SHA256SUMS.txt"] = ("\n".join(checksum_lines) + "\n").encode("utf-8")
        archive = root / "pack02.zip"
        with zipfile.ZipFile(archive, "w") as target:
            for name, payload in files.items():
                target.writestr(name, payload)
        return archive


class Pack02ProgressiveTests(unittest.TestCase):
    def test_accepts_complete_pack02(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            report = audit_pack02.audit(Pack02Fixture().archive(Path(temp)))
            self.assertTrue(report["passed"])
            self.assertEqual(55, report["pack"]["runtimeAssets"])
            self.assertEqual(55, report["pack"]["uniqueIds"])
            self.assertEqual(0, report["pack"]["unresolvedReferences"])

    def test_rejects_duplicate_id(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            archive = Pack02Fixture().archive(Path(temp), duplicate_first_id=True)
            with self.assertRaisesRegex(audit_pack02.AuditError, "duplicados"):
                audit_pack02.audit(archive)

    def test_rejects_missing_runtime_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            fixture = Pack02Fixture()
            missing = str(fixture.assets[0]["runtimeFile"])
            archive = fixture.archive(Path(temp), remove=missing)
            with self.assertRaisesRegex(audit_pack02.AuditError, "não resolvidas"):
                audit_pack02.audit(archive)

    def test_installs_atomically_and_preserves_bootstrap(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = Pack02Fixture().archive(root)
            repo = root / "repo"
            web_bootstrap = repo / "client/web/public/assets/runtime/sentinel.txt"
            godot_bootstrap = repo / "client/godot/assets/runtime/sentinel.txt"
            web_bootstrap.parent.mkdir(parents=True)
            godot_bootstrap.parent.mkdir(parents=True)
            web_bootstrap.write_text("web-bootstrap", encoding="utf-8")
            godot_bootstrap.write_text("godot-bootstrap", encoding="utf-8")
            results = install_pack02.install(archive, repo, ["web", "godot"])
            self.assertEqual(2, len(results))
            self.assertEqual("web-bootstrap", web_bootstrap.read_text(encoding="utf-8"))
            self.assertEqual("godot-bootstrap", godot_bootstrap.read_text(encoding="utf-8"))
            for result in results:
                registry = json.loads((result.destination / "registry/board-runtime.json").read_text(encoding="utf-8"))
                self.assertEqual(55, registry["assetCount"])
                self.assertEqual([], registry["unresolved"])

    def test_failed_install_preserves_previous_progressive_runtime(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            fixture = Pack02Fixture()
            missing = str(fixture.assets[0]["runtimeFile"])
            archive = fixture.archive(root, remove=missing)
            repo = root / "repo"
            destination = install_pack02.destination_for(repo, "web")
            destination.mkdir(parents=True)
            sentinel = destination / "sentinel.txt"
            sentinel.write_text("previous", encoding="utf-8")
            with self.assertRaises(audit_pack02.AuditError):
                install_pack02.install(archive, repo, ["web"])
            self.assertEqual("previous", sentinel.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
