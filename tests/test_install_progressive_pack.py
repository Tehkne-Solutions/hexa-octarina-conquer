from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts import install_progressive_pack
from tests.test_audit_progressive_pack import ProgressivePackAuditTests


class ProgressivePackInstallTests(unittest.TestCase):
    def build_archive(self, root: Path, **kwargs: object) -> Path:
        return ProgressivePackAuditTests().build_pack01(root, **kwargs)

    def test_installs_pack01_to_web_and_godot_without_touching_bootstrap(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            repo = root / "repo"
            web_bootstrap = repo / "client/web/public/assets/runtime/registry/assets-runtime.json"
            godot_bootstrap = repo / "client/godot/assets/runtime/registry/assets-runtime.json"
            web_bootstrap.parent.mkdir(parents=True)
            godot_bootstrap.parent.mkdir(parents=True)
            web_bootstrap.write_text("bootstrap-web", encoding="utf-8")
            godot_bootstrap.write_text("bootstrap-godot", encoding="utf-8")

            results = install_progressive_pack.install(self.build_archive(root), repo, ["web", "godot"])

            self.assertEqual({"web", "godot"}, {result.target for result in results})
            for target in ("web", "godot"):
                destination = install_progressive_pack.destination_for(repo, target)
                runtime = json.loads((destination / "registry/terrain-runtime.json").read_text(encoding="utf-8"))
                installed = json.loads((destination / "runtime-install.json").read_text(encoding="utf-8"))
                self.assertEqual(103, runtime["assetCount"])
                self.assertEqual(103, len(runtime["assets"]))
                self.assertEqual([], runtime["unresolved"])
                self.assertEqual([252, 124], runtime["runtime"]["gridStepPx"])
                self.assertEqual(103, installed["assetCount"])
                self.assertTrue((destination / "A01_GRASS_ANCESTRAL/tiles/TILE_GRASS_FLAT_CENTER_A_01.png").is_file())

            self.assertEqual("bootstrap-web", web_bootstrap.read_text(encoding="utf-8"))
            self.assertEqual("bootstrap-godot", godot_bootstrap.read_text(encoding="utf-8"))

    def test_failed_audit_preserves_existing_progressive_runtime(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            repo = root / "repo"
            destination = install_progressive_pack.destination_for(repo, "web")
            destination.mkdir(parents=True)
            sentinel = destination / "sentinel.txt"
            sentinel.write_text("preserve", encoding="utf-8")

            archive = self.build_archive(root, missing_runtime_file=True)
            with self.assertRaisesRegex(Exception, "Referências não resolvidas"):
                install_progressive_pack.install(archive, repo, ["web"])

            self.assertEqual("preserve", sentinel.read_text(encoding="utf-8"))

    def test_rejects_unknown_target(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(install_progressive_pack.InstallError, "Target desconhecido"):
                install_progressive_pack.destination_for(Path(temp), "desktop")


if __name__ == "__main__":
    unittest.main()
