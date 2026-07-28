from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PublishPack99ReleaseContractTests(unittest.TestCase):
    def test_publisher_uses_current_source_and_release_contract(self) -> None:
        script = (ROOT / "scripts" / "publish_pack99_release.ps1").read_text(encoding="utf-8")
        self.assertIn('pack99-runtime-v1.0.2', script)
        self.assertIn('HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip', script)
        self.assertIn('5efd54e05cd2a01aa764ad652423d4ceaca0030fb9aca3d233ede3144a3b86e0', script)
        self.assertIn('hoc-pack99-web-full.zip', script)
        self.assertIn('hoc-pack99-godot-full.zip', script)
        self.assertIn('pack99-production-gate.yml', script)
        self.assertIn('build_pack99_runtime_index.py', script)
        self.assertIn('package_pack99_runtime_release.py', script)
        self.assertNotIn('pack99-runtime-v1.0.1', script)
        self.assertNotIn('f72cce299fd28c8bb8520320871d90057884bb0ec19dd449f1c3d07e56a71bbe', script)

    def test_windows_entrypoint_exposes_explicit_source_archive(self) -> None:
        entrypoint = (ROOT / "PUBLICAR-PACK99-RELEASE.cmd").read_text(encoding="utf-8")
        self.assertIn('PUBLICACAO INTEGRAL 1.0.2', entrypoint)
        self.assertIn('-SourceArchive', entrypoint)
        self.assertIn('PACK 99 Production Gate', entrypoint)
        self.assertIn('Tehkné Solutions', entrypoint)


if __name__ == "__main__":
    unittest.main()
