#!/usr/bin/env python3
"""Validate PACK 11 Narrative Portraits manifest and runtime files."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = {
    "id",
    "packId",
    "characterId",
    "group",
    "state",
    "variant",
    "sourcePath",
    "runtimePath",
    "width",
    "height",
    "sha256",
    "transparentBackground",
    "approved",
}
REQUIRED_STATES = {"neutral", "speaking", "alert", "combat", "victory", "defeat"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate(manifest_path: Path, root: Path) -> list[str]:
    errors: list[str] = []
    data: dict[str, Any] = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = data.get("assets")
    if not isinstance(assets, list):
        return ["manifest.assets deve ser uma lista"]

    seen_ids: set[str] = set()
    character_states: dict[str, set[str]] = {}

    for index, asset in enumerate(assets):
        label = f"assets[{index}]"
        if not isinstance(asset, dict):
            errors.append(f"{label} deve ser um objeto")
            continue

        missing = sorted(REQUIRED_FIELDS - set(asset))
        if missing:
            errors.append(f"{label} sem campos: {', '.join(missing)}")
            continue

        asset_id = str(asset["id"])
        if asset_id in seen_ids:
            errors.append(f"ID duplicado: {asset_id}")
        seen_ids.add(asset_id)

        if asset["packId"] != "PACK_11_NARRATIVE_PORTRAITS":
            errors.append(f"{asset_id}: packId inválido")

        state = str(asset["state"])
        if state not in REQUIRED_STATES:
            errors.append(f"{asset_id}: estado inválido {state}")
        character_states.setdefault(str(asset["characterId"]), set()).add(state)

        if asset["width"] not in (256, 1024) or asset["height"] not in (256, 1024):
            errors.append(f"{asset_id}: dimensões inválidas")
        if asset["transparentBackground"] is not True:
            errors.append(f"{asset_id}: transparência não confirmada")
        if asset["approved"] is not True:
            errors.append(f"{asset_id}: asset ainda não aprovado")

        runtime_path = root / str(asset["runtimePath"])
        if not runtime_path.is_file():
            errors.append(f"{asset_id}: arquivo ausente em {runtime_path}")
            continue

        expected_hash = str(asset["sha256"]).lower()
        actual_hash = sha256(runtime_path)
        if expected_hash != actual_hash:
            errors.append(f"{asset_id}: SHA-256 divergente")

    for character_id, states in sorted(character_states.items()):
        missing_states = sorted(REQUIRED_STATES - states)
        if missing_states:
            errors.append(
                f"{character_id}: estados faltantes: {', '.join(missing_states)}"
            )

    expected = int(data.get("expectedInitialAssets", 24))
    status = str(data.get("status", ""))
    if status != "scaffold" and len(assets) < expected:
        errors.append(f"lote inicial incompleto: {len(assets)}/{expected}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("runtime/packs/PACK_11_NARRATIVE_PORTRAITS/manifest.json"),
    )
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()

    errors = validate(args.manifest, args.root)
    if errors:
        print("PACK11_VALIDATION=FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PACK11_VALIDATION=PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
