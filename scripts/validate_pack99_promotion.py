#!/usr/bin/env python3
"""Validate that PACK 99 full runtime is identical in Web and Godot.

This gate is intentionally stricter than the regular installer checks. It is the
last step before deleting the 33-ID bootstrap, its 17 alias mappings and the
procedural visual fallbacks.

Tehkné Solutions
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
EXPECTED_ASSET_COUNT = 1037
BOOTSTRAP_DIRECTORIES = {"board", "sprites", "vfx"}
BOOTSTRAP_VERSION_MARKERS = ("runtime02", "bootstrap")
RUNTIME_PATH_KEYS = (
    "_runtimeFile",
    "_runtimeShadow",
    "_runtimeEmissive",
    "_runtimeFactionMask",
    "_runtimeSpritesheet",
    "_runtimeAtlas",
    "_runtimePreview",
)


class PromotionError(RuntimeError):
    """Raised when a runtime cannot be promoted to canonical full mode."""


@dataclass(frozen=True)
class TargetValidation:
    target: str
    profile: str
    asset_count: int
    unique_ids: int
    runtime_paths: int
    manifest: str
    registry: str


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise PromotionError(f"Arquivo obrigatório ausente: {path}") from error
    except json.JSONDecodeError as error:
        raise PromotionError(f"JSON inválido em {path}: {error}") from error


def runtime_paths(asset: dict[str, Any]) -> tuple[str, ...]:
    return tuple(
        value
        for key in RUNTIME_PATH_KEYS
        if isinstance((value := asset.get(key)), str) and value
    )


def validate_install_manifest(path: Path) -> dict[str, Any]:
    manifest = read_json(path)
    if manifest.get("packId") != PACK_ID:
        raise PromotionError(f"Manifesto não pertence ao {PACK_ID}: {path}")
    if manifest.get("signature") != SIGNATURE:
        raise PromotionError(f"Assinatura institucional inválida: {path}")
    if manifest.get("profile") != "full":
        raise PromotionError(f"Perfil não promovível em {path}: esperado full.")
    if int(manifest.get("assetCount", 0)) != EXPECTED_ASSET_COUNT:
        raise PromotionError(
            f"Cobertura divergente em {path}: esperado {EXPECTED_ASSET_COUNT}, "
            f"recebido {manifest.get('assetCount')!r}."
        )
    if int(manifest.get("unresolvedReferences", -1)) != 0:
        raise PromotionError(f"Referências não resolvidas no manifesto: {path}")
    return manifest


def validate_registry(path: Path, target: str) -> tuple[TargetValidation, dict[str, tuple[str, ...]]]:
    registry = read_json(path)
    if registry.get("packId") != PACK_ID:
        raise PromotionError(f"Registro {target} não pertence ao {PACK_ID}.")
    if registry.get("signature") != SIGNATURE:
        raise PromotionError(f"Assinatura do registro {target} é inválida.")
    if registry.get("profile") != "full":
        raise PromotionError(f"Registro {target} ainda não usa o perfil full.")

    version = str(registry.get("version", "")).lower()
    if any(marker in version for marker in BOOTSTRAP_VERSION_MARKERS):
        raise PromotionError(f"Registro {target} ainda anuncia versão de bootstrap: {version!r}.")
    if "deployment" in registry:
        raise PromotionError(f"Registro {target} ainda contém metadados de aliases/fallback do bootstrap.")

    assets = registry.get("assets")
    if not isinstance(assets, list):
        raise PromotionError(f"Registro {target} não contém uma lista de assets.")
    if int(registry.get("assetCount", -1)) != EXPECTED_ASSET_COUNT or len(assets) != EXPECTED_ASSET_COUNT:
        raise PromotionError(
            f"Registro {target} deve conter exatamente {EXPECTED_ASSET_COUNT} assets; "
            f"manifesto={registry.get('assetCount')!r}, lista={len(assets)}."
        )
    if registry.get("unresolved") not in ([], None):
        raise PromotionError(f"Registro {target} possui referências não resolvidas.")

    by_id: dict[str, tuple[str, ...]] = {}
    path_count = 0
    for asset in assets:
        if not isinstance(asset, dict):
            raise PromotionError(f"Registro {target} contém entrada de asset inválida.")
        asset_id = asset.get("id")
        if not isinstance(asset_id, str) or not asset_id:
            raise PromotionError(f"Registro {target} contém asset sem ID canônico.")
        if asset_id in by_id:
            raise PromotionError(f"ID duplicado no registro {target}: {asset_id}")
        paths = runtime_paths(asset)
        for runtime_path in paths:
            normalized = Path(runtime_path).as_posix()
            if normalized.startswith("/") or ".." in Path(normalized).parts:
                raise PromotionError(f"Caminho runtime inseguro em {target}: {runtime_path}")
            if not normalized.startswith("packages/"):
                raise PromotionError(
                    f"Asset {asset_id} em {target} ainda aponta para payload direto de bootstrap: "
                    f"{runtime_path}"
                )
        path_count += len(paths)
        by_id[asset_id] = paths

    if len(by_id) != EXPECTED_ASSET_COUNT:
        raise PromotionError(f"Registro {target} possui {len(by_id)} IDs únicos.")

    return (
        TargetValidation(
            target=target,
            profile="full",
            asset_count=len(assets),
            unique_ids=len(by_id),
            runtime_paths=path_count,
            manifest=(path.parent.parent / "runtime-install.json").as_posix(),
            registry=path.as_posix(),
        ),
        by_id,
    )


def reject_bootstrap_payloads(runtime_root: Path, target: str) -> None:
    remaining = sorted(
        directory.name
        for directory in runtime_root.iterdir()
        if directory.is_dir() and directory.name in BOOTSTRAP_DIRECTORIES
    )
    if remaining:
        raise PromotionError(
            f"Runtime {target} ainda contém diretórios diretos do bootstrap: {', '.join(remaining)}"
        )


def validate_target(runtime_root: Path, target: str) -> tuple[TargetValidation, dict[str, tuple[str, ...]]]:
    validate_install_manifest(runtime_root / "runtime-install.json")
    reject_bootstrap_payloads(runtime_root, target)
    return validate_registry(runtime_root / "registry" / "assets-runtime.json", target)


def compare_targets(
    web_assets: dict[str, tuple[str, ...]],
    godot_assets: dict[str, tuple[str, ...]],
) -> None:
    web_ids = set(web_assets)
    godot_ids = set(godot_assets)
    if web_ids != godot_ids:
        missing_web = sorted(godot_ids - web_ids)[:10]
        missing_godot = sorted(web_ids - godot_ids)[:10]
        raise PromotionError(
            "Web e Godot não possuem o mesmo conjunto canônico. "
            f"Ausentes no Web: {missing_web}; ausentes no Godot: {missing_godot}."
        )

    mismatched = [asset_id for asset_id in sorted(web_ids) if web_assets[asset_id] != godot_assets[asset_id]]
    if mismatched:
        raise PromotionError(
            "Web e Godot resolvem caminhos diferentes para IDs canônicos: "
            + ", ".join(mismatched[:10])
        )


def write_report(path: Path, results: list[TargetValidation]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "project": "Hexa Octarina Conquer",
        "packId": PACK_ID,
        "profile": "full",
        "expectedAssetIds": EXPECTED_ASSET_COUNT,
        "targets": [asdict(result) for result in results],
        "bootstrapAssetIds": 0,
        "bootstrapAliases": 0,
        "proceduralFallbackMode": False,
        "passed": True,
        "signature": SIGNATURE,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Valida a promoção integral do PACK 99 no Web e Godot.")
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--report", type=Path, default=Path(".cache/pack99/promotion-report.json"))
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    repo_root = args.repo.expanduser().resolve()
    web_root = repo_root / "client" / "web" / "public" / "assets" / "runtime"
    godot_root = repo_root / "client" / "godot" / "assets" / "runtime"
    report = args.report if args.report.is_absolute() else repo_root / args.report

    try:
        web_result, web_assets = validate_target(web_root, "web")
        godot_result, godot_assets = validate_target(godot_root, "godot")
        compare_targets(web_assets, godot_assets)
        write_report(report, [web_result, godot_result])
        print(f"Promoção integral aprovada: {EXPECTED_ASSET_COUNT} IDs idênticos no Web e Godot.")
        print(f"Relatório: {report}")
        print(SIGNATURE)
        return 0
    except (PromotionError, OSError, ValueError) as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
