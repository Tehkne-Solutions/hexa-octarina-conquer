from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, relative: str):
    path = ROOT / relative
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


runtime_index = load_module("build_pack99_runtime_index", "scripts/build_pack99_runtime_index.py")
release_package = load_module("package_pack99_runtime_release", "scripts/package_pack99_runtime_release.py")


class Pack99RuntimeReleaseTests(unittest.TestCase):
    def make_runtime(self, root: Path) -> Path:
        runtime = root / "runtime"
        base = runtime / "packages" / "PACK_07_OTHER_HEROES" / "kael" / "HERO_KAEL_IDLE_BASE_SE_01.png"
        shadow = runtime / "packages" / "PACK_07_OTHER_HEROES" / "kael" / "HERO_KAEL_IDLE_SHADOW_SE_01.png"
        lyra = runtime / "packages" / "PACK_07_OTHER_HEROES" / "lyra" / "HERO_LYRA_IDLE_BASE_SE_01.png"
        for path, data in ((base, b"kael-base"), (shadow, b"kael-shadow"), (lyra, b"lyra-base")):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        (runtime / "registry").mkdir(parents=True, exist_ok=True)
        (runtime / "runtime-install.json").write_text(
            json.dumps({
                "packId": runtime_index.PACK_ID,
                "version": "1.0.2",
                "profile": "full",
                "assetCount": 2,
                "unresolvedReferences": 0,
                "signature": runtime_index.SIGNATURE,
            }),
            encoding="utf-8",
        )
        (runtime / "registry" / "assets-runtime.json").write_text(
            json.dumps({
                "packId": runtime_index.PACK_ID,
                "version": "1.0.2",
                "profile": "full",
                "assetCount": 2,
                "unresolved": [],
                "signature": runtime_index.SIGNATURE,
                "assets": [
                    {
                        "id": "HERO_KAEL_IDLE_SE_01",
                        "category": "character-animation",
                        "_runtimeFile": base.relative_to(runtime).as_posix(),
                        "_runtimeShadow": shadow.relative_to(runtime).as_posix(),
                    },
                    {
                        "id": "HERO_LYRA_IDLE_SE_01",
                        "category": "character-animation",
                        "_runtimeFile": lyra.relative_to(runtime).as_posix(),
                    },
                ],
            }),
            encoding="utf-8",
        )
        return runtime

    def test_builds_canonical_and_layer_entries(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            runtime = self.make_runtime(Path(temporary))
            output = runtime_index.write_index(runtime, target="web", expected_count=2)
            index = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(2, index["assetCount"])
            self.assertEqual(2, index["canonicalAssetCount"])
            self.assertEqual(3, index["materializedAssetCount"])
            self.assertEqual("full", index["runtimeMode"])
            self.assertEqual(
                {"HERO_KAEL_IDLE_SE_01", "HERO_KAEL_IDLE_SE_01__SHADOW", "HERO_LYRA_IDLE_SE_01"},
                {entry["id"] for entry in index["assets"]},
            )

    def test_rejects_missing_materialized_payload(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            runtime = self.make_runtime(Path(temporary))
            registry_path = runtime / "registry" / "assets-runtime.json"
            registry = json.loads(registry_path.read_text(encoding="utf-8"))
            registry["assets"][0]["_runtimeFile"] = "packages/missing.png"
            registry_path.write_text(json.dumps(registry), encoding="utf-8")
            with self.assertRaisesRegex(runtime_index.RuntimeIndexError, "Payload ausente"):
                runtime_index.build_index(runtime, target="web", expected_count=2)

    def test_packages_deterministically_and_writes_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            runtime = self.make_runtime(root)
            runtime_index.write_index(runtime, target="web", expected_count=2)
            first = root / "first.zip"
            second = root / "second.zip"
            first_report = release_package.package_runtime(runtime, first, target="web", expected_count=2)
            second_report = release_package.package_runtime(runtime, second, target="web", expected_count=2)
            self.assertEqual(first_report["sha256"], second_report["sha256"])
            self.assertEqual(hashlib.sha256(first.read_bytes()).hexdigest(), first_report["sha256"])
            self.assertTrue(first.with_suffix(".zip.sha256").is_file())
            with ZipFile(first) as archive:
                names = set(archive.namelist())
            self.assertIn("runtime-install.json", names)
            self.assertIn("registry/assets-runtime.json", names)
            self.assertIn("pack99/runtime-index.json", names)

    def test_release_rejects_bootstrap_index(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            runtime = self.make_runtime(Path(temporary))
            runtime_index.write_index(runtime, target="web", expected_count=2)
            index_path = runtime / "pack99" / "runtime-index.json"
            index = json.loads(index_path.read_text(encoding="utf-8"))
            index["runtimeMode"] = "bootstrap"
            index_path.write_text(json.dumps(index), encoding="utf-8")
            with self.assertRaisesRegex(release_package.ReleasePackageError, "runtime full"):
                release_package.package_runtime(runtime, Path(temporary) / "invalid.zip", target="web", expected_count=2)


if __name__ == "__main__":
    unittest.main()
