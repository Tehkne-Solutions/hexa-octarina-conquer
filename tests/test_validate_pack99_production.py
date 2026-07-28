from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "validate_pack99_production.py"
SPEC = importlib.util.spec_from_file_location("validate_pack99_production", MODULE_PATH)
assert SPEC and SPEC.loader
production = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = production
SPEC.loader.exec_module(production)


class RuntimeHandler(BaseHTTPRequestHandler):
    canonical_count = 4
    mode = "full"
    missing_payload = False
    html_payload = False

    def log_message(self, _format: str, *_args) -> None:
        return

    def _send_json(self, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/health":
            self._send_json({"ok": True, "status": "healthy"})
            return
        if path == "/assets/runtime/runtime-install.json":
            self._send_json(
                {
                    "packId": production.PACK_ID,
                    "profile": "full",
                    "assetCount": self.canonical_count,
                    "unresolvedReferences": 0,
                    "signature": production.SIGNATURE,
                }
            )
            return
        if path == "/assets/runtime/pack99/runtime-index.json":
            assets = [
                {
                    "id": f"ASSET_{index}",
                    "canonicalId": f"ASSET_{index}",
                    "category": "test",
                    "sourcePath": f"packages/PACK_TEST/ASSET_{index}.png",
                    "web": f"client/web/public/assets/runtime/packages/PACK_TEST/ASSET_{index}.png",
                    "bytes": 8,
                }
                for index in range(self.canonical_count)
            ]
            self._send_json(
                {
                    "packId": production.PACK_ID,
                    "profile": "full",
                    "runtimeMode": self.mode,
                    "assetCount": self.canonical_count,
                    "canonicalAssetCount": self.canonical_count,
                    "materializedAssetCount": len(assets),
                    "assets": assets,
                    "fallback": None,
                    "signature": production.SIGNATURE,
                }
            )
            return
        if path.startswith("/assets/runtime/packages/PACK_TEST/"):
            if self.missing_payload:
                self.send_error(404)
                return
            if self.html_payload:
                body = b"<!doctype html><html>fallback</html>"
                content_type = "text/html"
            else:
                body = b"PNGDATA!"
                content_type = "image/png"
            self.send_response(206 if self.headers.get("Range") else 200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            if self.headers.get("Range"):
                self.send_header("Content-Range", "bytes 0-7/8")
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)


class ServerContext:
    def __enter__(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), RuntimeHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.server.server_address
        self.url = f"http://{host}:{port}"
        return self

    def __exit__(self, *_args):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        RuntimeHandler.canonical_count = 4
        RuntimeHandler.mode = "full"
        RuntimeHandler.missing_payload = False
        RuntimeHandler.html_payload = False


class ValidatePack99ProductionTests(unittest.TestCase):
    def test_validates_manifest_index_and_physical_payloads(self) -> None:
        with ServerContext() as server:
            report = production.validate_once(server.url, timeout=2, expected_count=4, sample_count=4)
        self.assertTrue(report["passed"])
        self.assertEqual(4, report["canonicalAssetCount"])
        self.assertEqual(4, report["sampleCount"])
        self.assertTrue(all(item["content_type"] == "image/png" for item in report["payloadChecks"]))

    def test_rejects_bootstrap_declaration(self) -> None:
        RuntimeHandler.mode = "bootstrap"
        with ServerContext() as server:
            with self.assertRaisesRegex(production.ProductionValidationError, "runtime full"):
                production.validate_once(server.url, timeout=2, expected_count=4, sample_count=2)

    def test_rejects_missing_payload(self) -> None:
        RuntimeHandler.missing_payload = True
        with ServerContext() as server:
            with self.assertRaisesRegex(production.ProductionValidationError, "HTTP 404"):
                production.validate_once(server.url, timeout=2, expected_count=4, sample_count=2)

    def test_rejects_spa_html_fallback_for_asset(self) -> None:
        RuntimeHandler.html_payload = True
        with ServerContext() as server:
            with self.assertRaisesRegex(production.ProductionValidationError, "documento de fallback"):
                production.validate_once(server.url, timeout=2, expected_count=4, sample_count=2)

    def test_rejects_unsafe_source_path(self) -> None:
        with self.assertRaisesRegex(production.ProductionValidationError, "inseguro"):
            production.safe_source_path("../secret.png")

    def test_writes_failure_report(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            report_path = Path(temporary) / "report.json"
            payload = {"passed": False, "signature": production.SIGNATURE}
            production.write_report(report_path, payload)
            self.assertEqual(payload, json.loads(report_path.read_text(encoding="utf-8")))


if __name__ == "__main__":
    unittest.main()
