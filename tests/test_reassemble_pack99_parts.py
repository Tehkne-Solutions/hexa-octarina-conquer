from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from reassemble_pack99_parts import ReassemblyError, load_manifest, reassemble


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_archive(path: Path) -> None:
    with ZipFile(path, "w") as archive:
        archive.writestr("pack-manifest.json", "{}")
        archive.writestr("registry/assets-global.json", "[]")
        archive.writestr("registry/entities-global.json", "[]")
        archive.writestr("registry/packs-global.json", "[]")
        archive.writestr("packages/PACK_00_FOUNDATION/README.md", "foundation")


def split_archive(tmp_path: Path, chunk_size: int = 32) -> tuple[Path, Path, list[Path]]:
    archive = tmp_path / "HOC_PACK_99_TEST.zip"
    make_archive(archive)
    parts: list[Path] = []
    data = archive.read_bytes()
    for index, offset in enumerate(range(0, len(data), chunk_size), start=1):
        part = tmp_path / f"{archive.name}.part{index:03d}"
        part.write_bytes(data[offset : offset + chunk_size])
        parts.append(part)
    manifest = {
        "project": "Hexa Octarina Conquer",
        "artifact": archive.name,
        "bytes": archive.stat().st_size,
        "sha256": sha256(archive),
        "parts": [
            {
                "name": part.name,
                "order": index,
                "bytes": part.stat().st_size,
                "sha256": sha256(part),
            }
            for index, part in enumerate(parts, start=1)
        ],
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    archive.unlink()
    return manifest_path, tmp_path / manifest["artifact"], parts


class ReassemblePack99PartsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_reassembles_and_audits_archive(self) -> None:
        manifest, output, _parts = split_archive(self.tmp_path)

        report = reassemble(manifest, self.tmp_path)

        self.assertTrue(output.is_file())
        self.assertTrue(report["passed"])
        self.assertGreater(report["partCount"], 1)
        self.assertTrue(report["zipAudit"]["passed"])
        self.assertEqual(report["zipAudit"]["entryCount"], 5)
        self.assertEqual(sha256(output), report["sha256"])

    def test_rejects_missing_part_without_touching_existing_output(self) -> None:
        manifest, output, parts = split_archive(self.tmp_path)
        output.write_bytes(b"previous-runtime")
        parts[-1].unlink()

        with self.assertRaisesRegex(ReassemblyError, "Parte ausente"):
            reassemble(manifest, self.tmp_path)

        self.assertEqual(output.read_bytes(), b"previous-runtime")

    def test_rejects_part_hash_mismatch(self) -> None:
        manifest, _output, parts = split_archive(self.tmp_path)
        parts[0].write_bytes(parts[0].read_bytes() + b"tampered")

        with self.assertRaisesRegex(ReassemblyError, "Tamanho incorreto|SHA-256 incorreto"):
            reassemble(manifest, self.tmp_path)

    def test_rejects_unsafe_part_name(self) -> None:
        manifest, _output, _parts = split_archive(self.tmp_path)
        data = json.loads(manifest.read_text(encoding="utf-8"))
        data["parts"][0]["name"] = "../outside.part"
        manifest.write_text(json.dumps(data), encoding="utf-8")

        with self.assertRaisesRegex(ReassemblyError, "Nome de parte inseguro"):
            load_manifest(manifest)

    def test_rejects_false_final_hash(self) -> None:
        manifest, output, _parts = split_archive(self.tmp_path)
        data = json.loads(manifest.read_text(encoding="utf-8"))
        data["sha256"] = "0" * 64
        manifest.write_text(json.dumps(data), encoding="utf-8")

        with self.assertRaisesRegex(ReassemblyError, "SHA-256 final incorreto"):
            reassemble(manifest, self.tmp_path)

        self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
