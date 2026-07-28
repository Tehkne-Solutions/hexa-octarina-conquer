#!/usr/bin/env python3
"""Validate the local PACK 99 publisher contract without executing a Release.

Signature: Tehkné Solutions
"""

from __future__ import annotations

import sys
from pathlib import Path

SIGNATURE = "Tehkné Solutions"
EXPECTED = (
    "pack99-runtime-v1.0.2",
    "HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip",
    "5efd54e05cd2a01aa764ad652423d4ceaca0030fb9aca3d233ede3144a3b86e0",
    "hoc-pack99-web-full.zip",
    "hoc-pack99-godot-full.zip",
    "pack99-production-gate.yml",
    "build_pack99_runtime_index.py",
    "package_pack99_runtime_release.py",
)
FORBIDDEN = (
    "pack99-runtime-v1.0.1",
    "f72cce299fd28c8bb8520320871d90057884bb0ec19dd449f1c3d07e56a71bbe",
)


def validate(repo_root: Path) -> list[str]:
    problems: list[str] = []
    script_path = repo_root / "scripts" / "publish_pack99_release.ps1"
    entrypoint_path = repo_root / "PUBLICAR-PACK99-RELEASE.cmd"
    if not script_path.is_file():
        return [f"arquivo ausente: {script_path}"]
    if not entrypoint_path.is_file():
        return [f"arquivo ausente: {entrypoint_path}"]

    script = script_path.read_text(encoding="utf-8")
    entrypoint = entrypoint_path.read_text(encoding="utf-8")
    for value in EXPECTED:
        if value not in script:
            problems.append(f"contrato ausente no PowerShell: {value}")
    for value in FORBIDDEN:
        if value in script:
            problems.append(f"contrato obsoleto ainda presente: {value}")
    if "-SourceArchive" not in entrypoint:
        problems.append("entrada Windows não expõe -SourceArchive")
    if "PACK 99 Production Gate" not in entrypoint:
        problems.append("entrada Windows não informa o gate de produção")
    if SIGNATURE not in script or SIGNATURE not in entrypoint:
        problems.append("assinatura institucional ausente")
    return problems


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    problems = validate(root)
    if problems:
        print("PACK99_PUBLISHER_CONTRACT=FAILED", file=sys.stderr)
        for problem in problems:
            print(f"- {problem}", file=sys.stderr)
        print(f"SIGNATURE={SIGNATURE}", file=sys.stderr)
        return 2
    print("PACK99_PUBLISHER_CONTRACT=PASSED")
    print("SOURCE_VERSION=1.0.2")
    print("RELEASE_TAG=pack99-runtime-v1.0.2")
    print("CANONICAL_IDS=1037")
    print(f"SIGNATURE={SIGNATURE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
