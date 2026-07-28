#!/usr/bin/env python3
"""Validate that the deployed Web client serves the promoted PACK 99 runtime.

The gate checks the public install manifest, premium index and a deterministic
sample of physical payloads. A declaration alone is not enough: every sampled
asset must return binary content from the production origin.

Signature: Tehkné Solutions
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path, PurePosixPath
from typing import Any

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
EXPECTED_CANONICAL_ASSETS = 1037
DEFAULT_SAMPLE_COUNT = 12
USER_AGENT = "Tehkne-HOC-Pack99-Production-Gate/1.0"


class ProductionValidationError(RuntimeError):
    pass


@dataclass(frozen=True)
class PayloadCheck:
    asset_id: str
    path: str
    status: int
    content_type: str
    bytes_received: int


def normalize_base_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ProductionValidationError("URL de produção inválida")
    path = parsed.path.rstrip("/")
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def endpoint(base_url: str, path: str) -> str:
    return f"{base_url}/{path.lstrip('/')}"


def request_bytes(url: str, *, timeout: float, range_request: bool = False) -> tuple[int, dict[str, str], bytes]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, application/octet-stream;q=0.9, */*;q=0.8",
        "Cache-Control": "no-cache",
    }
    if range_request:
        headers["Range"] = "bytes=0-63"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = int(getattr(response, "status", response.getcode()))
            data = response.read() if not range_request else response.read(64)
            response_headers = {key.lower(): value for key, value in response.headers.items()}
            return status, response_headers, data
    except urllib.error.HTTPError as error:
        body = error.read(512)
        raise ProductionValidationError(f"HTTP {error.code} em {url}: {body[:160]!r}") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise ProductionValidationError(f"Falha de rede em {url}: {error}") from error


def request_json(url: str, *, timeout: float) -> dict[str, Any]:
    status, headers, data = request_bytes(url, timeout=timeout)
    if status != 200:
        raise ProductionValidationError(f"Status inesperado em {url}: {status}")
    content_type = headers.get("content-type", "").lower()
    if "html" in content_type or data.lstrip().startswith(b"<"):
        raise ProductionValidationError(f"Endpoint JSON retornou HTML: {url}")
    try:
        value = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ProductionValidationError(f"JSON inválido em {url}: {error}") from error
    if not isinstance(value, dict):
        raise ProductionValidationError(f"JSON deve ser objeto em {url}")
    return value


def safe_source_path(value: Any) -> str:
    if not isinstance(value, str) or not value:
        raise ProductionValidationError("Entrada premium sem sourcePath")
    path = PurePosixPath(value.replace("\\", "/"))
    if path.is_absolute() or ".." in path.parts:
        raise ProductionValidationError(f"Caminho premium inseguro: {value}")
    normalized = path.as_posix()
    if not normalized.startswith("packages/"):
        raise ProductionValidationError(f"Payload fora de packages/: {value}")
    return normalized


def validate_install_manifest(manifest: dict[str, Any], expected_count: int) -> None:
    if manifest.get("packId") != PACK_ID:
        raise ProductionValidationError("Manifesto de produção não pertence ao PACK 99")
    if manifest.get("signature") != SIGNATURE:
        raise ProductionValidationError("Assinatura institucional inválida no manifesto")
    if manifest.get("profile") != "full":
        raise ProductionValidationError("Produção ainda não usa profile full")
    if int(manifest.get("assetCount", -1)) != expected_count:
        raise ProductionValidationError(
            f"Manifesto declara {manifest.get('assetCount')!r} assets; esperado {expected_count}"
        )
    if int(manifest.get("unresolvedReferences", -1)) != 0:
        raise ProductionValidationError("Manifesto possui referências não resolvidas")


def validate_index(index: dict[str, Any], expected_count: int) -> list[dict[str, Any]]:
    if index.get("packId") != PACK_ID:
        raise ProductionValidationError("Índice de produção não pertence ao PACK 99")
    if index.get("signature") != SIGNATURE:
        raise ProductionValidationError("Assinatura institucional inválida no índice")
    if index.get("runtimeMode") != "full" or index.get("profile") != "full":
        raise ProductionValidationError("Índice de produção ainda não está em runtime full")
    if int(index.get("assetCount", -1)) != expected_count:
        raise ProductionValidationError("assetCount divergente no índice")
    if int(index.get("canonicalAssetCount", -1)) != expected_count:
        raise ProductionValidationError("canonicalAssetCount divergente no índice")
    if index.get("fallback") not in (None, False):
        raise ProductionValidationError("Índice full ainda anuncia fallback")
    assets = index.get("assets")
    if not isinstance(assets, list) or len(assets) < expected_count:
        raise ProductionValidationError("Índice não materializou todos os IDs")

    canonical_ids: set[str] = set()
    materialized_paths: set[str] = set()
    for asset in assets:
        if not isinstance(asset, dict):
            raise ProductionValidationError("Entrada inválida no índice")
        canonical_id = asset.get("canonicalId") or asset.get("id")
        if not isinstance(canonical_id, str) or not canonical_id:
            raise ProductionValidationError("Entrada sem canonicalId")
        canonical_ids.add(canonical_id)
        materialized_paths.add(safe_source_path(asset.get("sourcePath")))
    if len(canonical_ids) != expected_count:
        raise ProductionValidationError(
            f"Índice contém {len(canonical_ids)} IDs canônicos; esperado {expected_count}"
        )
    if len(materialized_paths) < expected_count:
        raise ProductionValidationError("Índice possui menos payloads únicos que IDs canônicos")
    return assets


def deterministic_sample(assets: list[dict[str, Any]], count: int) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for asset in assets:
        path = safe_source_path(asset.get("sourcePath"))
        unique.setdefault(path, asset)
    ordered = [unique[path] for path in sorted(unique)]
    if not ordered:
        raise ProductionValidationError("Nenhum payload disponível para amostragem")
    count = max(1, min(count, len(ordered)))
    if count == 1:
        return [ordered[0]]
    indexes = sorted({round(position * (len(ordered) - 1) / (count - 1)) for position in range(count)})
    return [ordered[index] for index in indexes]


def validate_payload(base_url: str, asset: dict[str, Any], *, timeout: float) -> PayloadCheck:
    source_path = safe_source_path(asset.get("sourcePath"))
    url = endpoint(base_url, f"assets/runtime/{source_path}")
    status, headers, data = request_bytes(url, timeout=timeout, range_request=True)
    if status not in {200, 206}:
        raise ProductionValidationError(f"Payload retornou HTTP {status}: {source_path}")
    if not data:
        raise ProductionValidationError(f"Payload vazio: {source_path}")
    content_type = headers.get("content-type", "").split(";", 1)[0].strip().lower()
    lowered = data.lstrip().lower()
    if content_type in {"text/html", "application/json"} or lowered.startswith(b"<!doctype html") or lowered.startswith(b"<html"):
        raise ProductionValidationError(f"Payload resolveu para documento de fallback: {source_path}")
    expected_bytes = asset.get("bytes")
    content_range = headers.get("content-range", "")
    if isinstance(expected_bytes, int) and expected_bytes > 0 and content_range:
        total = content_range.rsplit("/", 1)[-1]
        if total.isdigit() and int(total) != expected_bytes:
            raise ProductionValidationError(
                f"Tamanho remoto divergente para {source_path}: {total} != {expected_bytes}"
            )
    return PayloadCheck(
        asset_id=str(asset.get("canonicalId") or asset.get("id")),
        path=source_path,
        status=status,
        content_type=content_type,
        bytes_received=len(data),
    )


def validate_once(base_url: str, *, timeout: float, expected_count: int, sample_count: int) -> dict[str, Any]:
    health_url = endpoint(base_url, "health")
    health = request_json(health_url, timeout=timeout)
    if health.get("ok") is False or str(health.get("status", "")).lower() in {"error", "failed", "unhealthy"}:
        raise ProductionValidationError("Health check da produção não está saudável")

    manifest_url = endpoint(base_url, "assets/runtime/runtime-install.json")
    index_url = endpoint(base_url, "assets/runtime/pack99/runtime-index.json")
    manifest = request_json(manifest_url, timeout=timeout)
    index = request_json(index_url, timeout=timeout)
    validate_install_manifest(manifest, expected_count)
    assets = validate_index(index, expected_count)

    checks = [validate_payload(base_url, asset, timeout=timeout) for asset in deterministic_sample(assets, sample_count)]
    return {
        "project": "Hexa Octarina Conquer",
        "packId": PACK_ID,
        "baseUrl": base_url,
        "profile": "full",
        "runtimeMode": "full",
        "canonicalAssetCount": expected_count,
        "materializedAssetCount": len(assets),
        "sampleCount": len(checks),
        "payloadChecks": [asdict(check) for check in checks],
        "manifestUrl": manifest_url,
        "indexUrl": index_url,
        "passed": True,
        "signature": SIGNATURE,
    }


def write_report(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Valida a promoção integral do PACK 99 no deploy Web.")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--expected-count", type=int, default=EXPECTED_CANONICAL_ASSETS)
    parser.add_argument("--sample-count", type=int, default=DEFAULT_SAMPLE_COUNT)
    parser.add_argument("--attempts", type=int, default=1)
    parser.add_argument("--delay-seconds", type=float, default=20.0)
    parser.add_argument("--timeout-seconds", type=float, default=30.0)
    parser.add_argument("--report", type=Path, default=Path(".cache/pack99/production-report.json"))
    args = parser.parse_args()

    try:
        base_url = normalize_base_url(args.base_url)
    except ProductionValidationError as error:
        print(f"PACK99_PRODUCTION_GATE=FAILED\nERROR={error}\nSIGNATURE={SIGNATURE}", file=sys.stderr)
        return 2

    last_error = ""
    attempts = max(1, args.attempts)
    for attempt in range(1, attempts + 1):
        try:
            report = validate_once(
                base_url,
                timeout=max(1.0, args.timeout_seconds),
                expected_count=args.expected_count,
                sample_count=args.sample_count,
            )
            report["attempt"] = attempt
            report["attemptsConfigured"] = attempts
            report["verifiedAtUtc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            write_report(args.report, report)
            print("PACK99_PRODUCTION_GATE=PASSED")
            print(f"BASE_URL={base_url}")
            print(f"CANONICAL_IDS={report['canonicalAssetCount']}")
            print(f"MATERIALIZED_ENTRIES={report['materializedAssetCount']}")
            print(f"SAMPLED_PAYLOADS={report['sampleCount']}")
            print(f"REPORT={args.report}")
            print(f"SIGNATURE={SIGNATURE}")
            return 0
        except (ProductionValidationError, OSError, ValueError) as error:
            last_error = str(error)
            print(f"Tentativa {attempt}/{attempts}: {last_error}", file=sys.stderr)
            if attempt < attempts:
                time.sleep(max(0.0, args.delay_seconds))

    failure = {
        "project": "Hexa Octarina Conquer",
        "packId": PACK_ID,
        "baseUrl": base_url,
        "attempts": attempts,
        "error": last_error,
        "passed": False,
        "signature": SIGNATURE,
    }
    write_report(args.report, failure)
    print(f"PACK99_PRODUCTION_GATE=FAILED\nERROR={last_error}\nREPORT={args.report}\nSIGNATURE={SIGNATURE}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
