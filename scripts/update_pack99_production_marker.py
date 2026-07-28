#!/usr/bin/env python3
"""Build the versioned production marker from signed PACK 99 reports.

The marker has two safe transitions:
- release-published: the Release exists, but bootstrap is still permitted;
- promoted: production was validated and future Docker builds require full mode.

Signature: Tehkné Solutions
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
EXPECTED_CANONICAL_ASSETS = 1037
EXPECTED_RUNTIME_REFERENCES = 1850
ALLOWED_STATUSES = {"release-published", "promoted"}


class MarkerError(RuntimeError):
    pass


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise MarkerError(f"Arquivo obrigatório ausente: {path}") from error
    except json.JSONDecodeError as error:
        raise MarkerError(f"JSON inválido em {path}: {error}") from error
    if not isinstance(value, dict):
        raise MarkerError(f"O JSON deve ser objeto: {path}")
    return value


def require_signed(document: dict[str, Any], label: str) -> None:
    if document.get("packId") != PACK_ID:
        raise MarkerError(f"{label} não pertence ao PACK 99")
    if document.get("signature") != SIGNATURE:
        raise MarkerError(f"Assinatura institucional inválida em {label}")
    if document.get("passed") is not True:
        raise MarkerError(f"{label} não está aprovado")


def validate_archive_report(document: dict[str, Any], *, target: str) -> None:
    require_signed(document, f"relatório {target}")
    if document.get("target") != target or document.get("profile") != "full":
        raise MarkerError(f"Relatório {target} não representa runtime full")
    if int(document.get("canonicalAssetCount", -1)) != EXPECTED_CANONICAL_ASSETS:
        raise MarkerError(f"Relatório {target} possui cobertura canônica divergente")
    if int(document.get("materializedAssetCount", -1)) < EXPECTED_RUNTIME_REFERENCES:
        raise MarkerError(f"Relatório {target} possui referências materializadas insuficientes")
    checksum = document.get("sha256")
    if not isinstance(checksum, str) or len(checksum) != 64:
        raise MarkerError(f"Relatório {target} sem SHA-256 válido")


def validate_promotion_report(document: dict[str, Any]) -> None:
    require_signed(document, "relatório de promoção")
    if document.get("profile") != "full":
        raise MarkerError("Relatório de promoção não usa full")
    if int(document.get("expectedAssetIds", -1)) != EXPECTED_CANONICAL_ASSETS:
        raise MarkerError("Relatório de promoção possui cobertura divergente")
    if int(document.get("bootstrapAssetIds", -1)) != 0:
        raise MarkerError("Relatório ainda possui bootstrap")
    if int(document.get("bootstrapAliases", -1)) != 0:
        raise MarkerError("Relatório ainda possui aliases")
    if document.get("proceduralFallbackMode") is not False:
        raise MarkerError("Relatório ainda usa fallback procedural")
    targets = document.get("targets")
    if not isinstance(targets, list) or {item.get("target") for item in targets if isinstance(item, dict)} != {"web", "godot"}:
        raise MarkerError("Relatório não contém Web e Godot")


def validate_production_report(document: dict[str, Any]) -> None:
    require_signed(document, "relatório de produção")
    if document.get("runtimeMode") != "full" or document.get("profile") != "full":
        raise MarkerError("Produção ainda não está em runtime full")
    if int(document.get("canonicalAssetCount", -1)) != EXPECTED_CANONICAL_ASSETS:
        raise MarkerError("Produção possui cobertura canônica divergente")
    if int(document.get("materializedAssetCount", -1)) < EXPECTED_RUNTIME_REFERENCES:
        raise MarkerError("Produção possui referências materializadas insuficientes")
    if int(document.get("sampleCount", 0)) <= 0:
        raise MarkerError("Produção não validou payloads físicos")


def build_marker(
    current: dict[str, Any],
    web: dict[str, Any],
    godot: dict[str, Any],
    promotion: dict[str, Any],
    *,
    status: str,
    production: dict[str, Any] | None = None,
    timestamp: str | None = None,
) -> dict[str, Any]:
    if status not in ALLOWED_STATUSES:
        raise MarkerError(f"Status inválido: {status}")
    if current.get("packId") != PACK_ID or current.get("signature") != SIGNATURE:
        raise MarkerError("Marcador base inválido")
    validate_archive_report(web, target="web")
    validate_archive_report(godot, target="godot")
    validate_promotion_report(promotion)
    if status == "promoted":
        if production is None:
            raise MarkerError("Promoção final exige relatório de produção")
        validate_production_report(production)

    now = timestamp or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    marker = dict(current)
    marker.update(
        {
            "status": status,
            "required": status == "promoted",
            "expectedCanonicalAssetIds": EXPECTED_CANONICAL_ASSETS,
            "expectedRuntimeReferences": EXPECTED_RUNTIME_REFERENCES,
            "webArchive": web.get("archive"),
            "godotArchive": godot.get("archive"),
            "webArchiveBytes": web.get("bytes"),
            "godotArchiveBytes": godot.get("bytes"),
            "webArchiveSha256": web.get("sha256"),
            "godotArchiveSha256": godot.get("sha256"),
            "promotionReportPassed": True,
            "releasePublishedAtUtc": current.get("releasePublishedAtUtc") or now,
            "promotedAtUtc": now if status == "promoted" else None,
            "productionVerifiedAtUtc": production.get("verifiedAtUtc") if production else None,
            "productionUrl": production.get("baseUrl") if production else current.get("productionUrl"),
            "productionSampleCount": production.get("sampleCount") if production else None,
            "signature": SIGNATURE,
        }
    )
    return marker


def main() -> int:
    parser = argparse.ArgumentParser(description="Atualiza o marcador versionado de produção do PACK 99.")
    parser.add_argument("--marker", type=Path, required=True)
    parser.add_argument("--web-report", type=Path, required=True)
    parser.add_argument("--godot-report", type=Path, required=True)
    parser.add_argument("--promotion-report", type=Path, required=True)
    parser.add_argument("--production-report", type=Path)
    parser.add_argument("--status", choices=sorted(ALLOWED_STATUSES), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        marker = build_marker(
            read_json(args.marker),
            read_json(args.web_report),
            read_json(args.godot_report),
            read_json(args.promotion_report),
            status=args.status,
            production=read_json(args.production_report) if args.production_report else None,
        )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(marker, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (MarkerError, OSError, ValueError) as error:
        print(f"PACK99_PRODUCTION_MARKER=FAILED\nERROR={error}\nSIGNATURE={SIGNATURE}", file=sys.stderr)
        return 2
    print("PACK99_PRODUCTION_MARKER=PASSED")
    print(f"STATUS={marker['status']}")
    print(f"REQUIRED={str(marker['required']).lower()}")
    print(f"OUTPUT={args.output}")
    print(f"SIGNATURE={SIGNATURE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
