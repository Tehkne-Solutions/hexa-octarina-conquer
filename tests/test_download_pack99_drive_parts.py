from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from download_pack99_drive_parts import (
    DriveSourceError,
    download_part,
    load_source,
    reassembly_manifest,
)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class FakeResponse:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.offset = 0

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self, size: int) -> bytes:
        if self.offset >= len(self.data):
            return b""
        chunk = self.data[self.offset : self.offset + size]
        self.offset += len(chunk)
        return chunk


class DownloadPack99DrivePartsTests(unittest.TestCase):
    def make_source(self, directory: Path) -> tuple[Path, list[bytes]]:
        payloads = [b"pack99-part-one", b"pack99-part-two"]
        source = {
            "provider": "google-drive",
            "project": "Hexa Octarina Conquer",
            "artifact": "HOC_PACK_99_TEST.zip",
            "bytes": sum(map(len, payloads)),
            "sha256": digest(b"".join(payloads)),
            "parts": [
                {
                    "order": index,
                    "name": f"HOC_PACK_99_TEST.zip.part{index:03d}",
                    "fileId": f"drive_file_id_{index:03d}",
                    "bytes": len(data),
                    "sha256": digest(data),
                }
                for index, data in enumerate(payloads, start=1)
            ],
            "signature": "Tehkné Solutions",
        }
        path = directory / "source.json"
        path.write_text(json.dumps(source), encoding="utf-8")
        return path, payloads

    def test_loads_verified_source_and_strips_file_ids_from_reassembly_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path, _payloads = self.make_source(Path(temporary))
            source = load_source(path)
            manifest = reassembly_manifest(source)
            self.assertEqual([1, 2], [part["order"] for part in source["parts"]])
            self.assertEqual(source["sha256"], manifest["sha256"])
            self.assertTrue(all("fileId" not in part for part in manifest["parts"]))

    def test_rejects_duplicate_drive_file_id(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path, _payloads = self.make_source(Path(temporary))
            source = json.loads(path.read_text(encoding="utf-8"))
            source["parts"][1]["fileId"] = source["parts"][0]["fileId"]
            path.write_text(json.dumps(source), encoding="utf-8")
            with self.assertRaisesRegex(DriveSourceError, "duplicada"):
                load_source(path)

    def test_downloads_and_atomically_validates_part(self) -> None:
        data = b"verified-private-drive-part"
        part = {
            "name": "runtime.part001",
            "fileId": "drive_file_id_001",
            "bytes": len(data),
            "sha256": digest(data),
        }
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / part["name"]
            with patch("download_pack99_drive_parts.urllib.request.urlopen", return_value=FakeResponse(data)):
                status = download_part(part, destination, "temporary-token", force=False)
            self.assertEqual("downloaded", status)
            self.assertEqual(data, destination.read_bytes())
            self.assertFalse((destination.parent / f".{destination.name}.download").exists())

    def test_rejects_tampered_part_without_activating_it(self) -> None:
        expected = b"expected"
        received = b"tampered"
        part = {
            "name": "runtime.part001",
            "fileId": "drive_file_id_001",
            "bytes": len(received),
            "sha256": digest(expected),
        }
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / part["name"]
            with patch("download_pack99_drive_parts.urllib.request.urlopen", return_value=FakeResponse(received)):
                with self.assertRaisesRegex(DriveSourceError, "SHA-256 incorreto"):
                    download_part(part, destination, "temporary-token", force=False)
            self.assertFalse(destination.exists())


if __name__ == "__main__":
    unittest.main()
