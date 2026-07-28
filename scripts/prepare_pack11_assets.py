#!/usr/bin/env python3
"""Prepare the PACK 11 portrait directory tree and expected-file checklist."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_DIR = ROOT / "runtime" / "packs" / "PACK_11_NARRATIVE_PORTRAITS"
STATUS_FILE = PACK_DIR / "production-status.json"
ASSETS_DIR = PACK_DIR / "assets"
CHECKLIST_FILE = PACK_DIR / "expected-assets.json"


def main() -> int:
    if not STATUS_FILE.exists():
        raise SystemExit(f"Missing production status: {STATUS_FILE}")

    status = json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    expected: list[dict[str, str]] = []

    for character in status["characters"]:
        character_id = character["id"]
        character_dir = ASSETS_DIR / character_id
        character_dir.mkdir(parents=True, exist_ok=True)

        for state in character["states"]:
            filename = f"{character_id}__{state}.png"
            relative_path = Path("assets") / character_id / filename
            expected.append(
                {
                    "id": f"{character_id}__{state}",
                    "characterId": character_id,
                    "state": state,
                    "path": relative_path.as_posix(),
                    "status": "present" if (PACK_DIR / relative_path).exists() else "missing",
                }
            )

    payload = {
        "packId": status["packId"],
        "expectedAssets": status["expectedAssets"],
        "presentAssets": sum(item["status"] == "present" for item in expected),
        "missingAssets": sum(item["status"] == "missing" for item in expected),
        "assets": expected,
    }
    CHECKLIST_FILE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    print(
        f"PACK 11 structure ready: {payload['presentAssets']} present, "
        f"{payload['missingAssets']} missing."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
