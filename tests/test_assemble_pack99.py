from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("assemble_pack99", ROOT / "scripts" / "assemble_pack99.py")
assert SPEC and SPEC.loader
assemble_pack99 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(assemble_pack99)


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


class AssemblePack99Tests(unittest.TestCase):
    def test_safe_extract_rejects_directory_traversal(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / "unsafe.zip"
            with zipfile.ZipFile(archive, "w") as handle:
                handle.writestr("../escape.txt", "blocked")
            with self.assertRaises(assemble_pack99.AssemblyError):
                assemble_pack99.safe_extract(archive, root / "output")

    def test_license_checksum_is_restored_and_validated(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "checksums").mkdir()
            (root / "checksums" / "SHA256SUMS.txt").write_text(
                f"{'0' * 64}  ./license/LICENSE-ASSETS.md\n",
                encoding="utf-8",
            )
            license_hash = assemble_pack99.restore_license(root, None)
            assemble_pack99.update_license_checksum(root, license_hash)
            self.assertEqual(assemble_pack99.validate_checksums(root), 1)
            self.assertEqual(license_hash, assemble_pack99.file_sha256(root / "license" / "LICENSE-ASSETS.md"))

    def test_validate_contracts_requires_canonical_counts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "validation").mkdir()
            (root / "registry").mkdir()
            (root / "pack-manifest.json").write_text(
                json.dumps({"packId": assemble_pack99.PACK_ID, "signature": assemble_pack99.SIGNATURE}),
                encoding="utf-8",
            )
            (root / "validation" / "validation-report.json").write_text(
                json.dumps({"passed": True}), encoding="utf-8"
            )
            (root / "registry" / "assets-global.json").write_text(
                json.dumps({"assets": [{} for _ in range(1037)]}), encoding="utf-8"
            )
            (root / "registry" / "entities-global.json").write_text(
                json.dumps({"entities": [{} for _ in range(46)]}), encoding="utf-8"
            )
            (root / "registry" / "packs-global.json").write_text(
                json.dumps({"packs": [{} for _ in range(11)]}), encoding="utf-8"
            )
            self.assertEqual(
                assemble_pack99.validate_contracts(root),
                {"assets": 1037, "entities": 46, "packs": 11},
            )

    def test_apply_a01_overlay_merges_into_canonical_terrain_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source_dir = root / "sources"
            source_dir.mkdir()
            overlay_archive = source_dir / assemble_pack99.A01_ARCHIVE
            with zipfile.ZipFile(overlay_archive, "w") as archive:
                archive.writestr(
                    "premium/manifest.grass-flat-premium.json",
                    '{"terrain": {"id": "TERRAIN_GRASS_ANCESTRAL"}, "assets": []}',
                )
                archive.writestr("premium/README.md", "A01")
                archive.writestr("premium/autotile-rules.json", "{}")
                archive.writestr("premium/manifest.terrain.json", "{}")
                archive.writestr("premium/tiles/TILE_GRASS_FLAT_CENTER_A_01.png", b"png")
                archive.writestr("premium/masks/TILE_GRASS_FLAT_CENTER_A_01_MASK.png", b"mask")
            package_root = root / "packages" / "PACK_01_TERRAIN_CORE"
            package_root.mkdir(parents=True)

            overlay_report = assemble_pack99.apply_a01_overlay(source_dir, package_root)
            target = package_root / assemble_pack99.A01_DIRECTORY

            self.assertTrue(overlay_report["applied"])
            self.assertEqual(assemble_pack99.A01_DIRECTORY, overlay_report["targetDirectory"])
            self.assertTrue((target / "README.md").is_file())
            self.assertTrue((target / "autotile-rules.json").is_file())
            self.assertTrue((target / "manifest.terrain.json").is_file())
            self.assertTrue((target / "tiles" / "TILE_GRASS_FLAT_CENTER_A_01.png").is_file())
            self.assertTrue((target / "masks" / "TILE_GRASS_FLAT_CENTER_A_01_MASK.png").is_file())
            self.assertFalse((package_root / "tiles").exists())

    def test_apply_a01_overlay_rejects_missing_runtime_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source_dir = root / "sources"
            source_dir.mkdir()
            with zipfile.ZipFile(source_dir / assemble_pack99.A01_ARCHIVE, "w") as archive:
                archive.writestr(
                    "manifest.grass-flat-premium.json",
                    '{"terrain": {"id": "TERRAIN_GRASS_ANCESTRAL"}}',
                )
                archive.writestr("tiles/TILE_GRASS_FLAT_CENTER_A_01.png", b"png")
            package_root = root / "packages" / "PACK_01_TERRAIN_CORE"
            package_root.mkdir(parents=True)
            with self.assertRaises(assemble_pack99.AssemblyError):
                assemble_pack99.apply_a01_overlay(source_dir, package_root)

    def test_end_to_end_assembly_from_eleven_archives(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            sources = root / "sources"
            metadata = root / "metadata"
            sources.mkdir()
            (metadata / "checksums").mkdir(parents=True)
            (metadata / "validation").mkdir()
            (metadata / "registry").mkdir()

            checksum_lines: list[str] = []
            for index, (archive_name, package_name) in enumerate(assemble_pack99.PACK_ARCHIVES.items()):
                relative = f"asset-{index}.txt"
                content = f"{package_name}\n".encode()
                with zipfile.ZipFile(sources / archive_name, "w") as archive:
                    archive.writestr(relative, content)
                checksum_lines.append(
                    f"{sha256_bytes(content)}  ./packages/{package_name}/{relative}"
                )

            metadata_files = {
                "pack-manifest.json": json.dumps(
                    {"packId": assemble_pack99.PACK_ID, "signature": assemble_pack99.SIGNATURE, "version": "1.0.0"}
                ).encode(),
                "validation/validation-report.json": json.dumps({"passed": True}).encode(),
                "registry/assets-global.json": json.dumps({"assets": [{} for _ in range(1037)]}).encode(),
                "registry/entities-global.json": json.dumps({"entities": [{} for _ in range(46)]}).encode(),
                "registry/packs-global.json": json.dumps({"packs": [{} for _ in range(11)]}).encode(),
            }
            for relative, content in metadata_files.items():
                destination = metadata / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(content)
                checksum_lines.append(f"{sha256_bytes(content)}  ./{relative}")

            checksum_lines.append(f"{'0' * 64}  ./license/LICENSE-ASSETS.md")
            (metadata / "checksums" / "SHA256SUMS.txt").write_text(
                "\n".join(checksum_lines) + "\n", encoding="utf-8"
            )

            output = root / "HOC_PACK_99_FINAL_RUNTIME_RECOVERED.zip"
            report = assemble_pack99.assemble(sources, metadata, output)

            self.assertTrue(output.is_file())
            self.assertTrue(output.with_suffix(output.suffix + ".sha256").is_file())
            self.assertTrue(output.with_suffix(output.suffix + ".report.json").is_file())
            self.assertEqual(report["assets"], 1037)
            self.assertEqual(report["entities"], 46)
            self.assertEqual(report["packs"], 11)
            self.assertEqual(report["checksumEntries"], 17)
            self.assertTrue(report["passed"])
            with zipfile.ZipFile(output) as archive:
                self.assertIsNone(archive.testzip())
                self.assertIn("license/LICENSE-ASSETS.md", archive.namelist())


if __name__ == "__main__":
    unittest.main()
