#!/usr/bin/env python3
"""Install the Hexa Octarina Conquer PACK 99 runtime into local clients.

The generated runtime is intentionally ignored by Git because PACK 99 contains
hundreds of megabytes of binary assets. This installer validates the pack,
normalizes registry paths, and copies either the static gameplay core or the
complete runtime into the Godot and/or web clients.

Tehkné Solutions
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
RUNTIME_REGISTRY_NAME = "assets-runtime.json"
ASSET_PATH_FIELDS = (
    "file",
    "shadow",
    "emissive",
    "factionMask",
    "spritesheet",
    "atlas",
    "preview",
)


class InstallError(RuntimeError):
    """Raised when a runtime pack is invalid or cannot be installed."""


@dataclass(frozen=True)
class RuntimeSource:
    root: Path
    temporary_root: Path | None = None

    def cleanup(self) -> None:
        if self.temporary_root and self.temporary_root.exists():
            shutil.rmtree(self.temporary_root)


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise InstallError(f"Arquivo obrigatório ausente: {path}") from error
    except json.JSONDecodeError as error:
        raise InstallError(f"JSON inválido em {path}: {error}") from error


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def locate_runtime_root(path: Path) -> RuntimeSource:
    path = path.expanduser().resolve()
    if not path.exists():
        raise InstallError(f"PACK 99 não encontrado: {path}")

    if path.is_dir():
        root = normalize_extracted_root(path)
        return RuntimeSource(root=root)

    if not zipfile.is_zipfile(path):
        raise InstallError("A origem deve ser um diretório ou ZIP válido do PACK 99.")

    temporary_root = Path(tempfile.mkdtemp(prefix="hoc-pack99-"))
    try:
        with zipfile.ZipFile(path, "r") as archive:
            archive.extractall(temporary_root)
        root = normalize_extracted_root(temporary_root)
        return RuntimeSource(root=root, temporary_root=temporary_root)
    except Exception:
        shutil.rmtree(temporary_root, ignore_errors=True)
        raise


def normalize_extracted_root(path: Path) -> Path:
    if (path / "pack-manifest.json").is_file():
        return path

    candidates = [
        candidate
        for candidate in path.iterdir()
        if candidate.is_dir() and (candidate / "pack-manifest.json").is_file()
    ]
    if len(candidates) == 1:
        return candidates[0]
    raise InstallError(
        "Não foi possível localizar a raiz do PACK 99. "
        "O diretório precisa conter pack-manifest.json."
    )


def validate_pack(root: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    manifest = read_json(root / "pack-manifest.json")
    validation = read_json(root / "validation" / "validation-report.json")
    registry = read_json(root / "registry" / "assets-global.json")

    if manifest.get("packId") != PACK_ID:
        raise InstallError(
            f"Pack incorreto: esperado {PACK_ID}, recebido {manifest.get('packId')!r}."
        )
    if manifest.get("signature") != SIGNATURE:
        raise InstallError("Assinatura institucional do PACK 99 não confere.")
    if not validation.get("passed"):
        raise InstallError("O relatório de validação do PACK 99 não está aprovado.")
    if registry.get("packId") != PACK_ID:
        raise InstallError("O registro global não pertence ao PACK 99 informado.")
    if not isinstance(registry.get("assets"), list):
        raise InstallError("O registro global não contém uma lista de assets válida.")

    return manifest, validation, registry


def package_files(root: Path) -> dict[str, list[Path]]:
    """Index all package files by basename for path normalization."""
    index: dict[str, list[Path]] = {}
    packages_root = root / "packages"
    if not packages_root.is_dir():
        raise InstallError("Diretório packages/ ausente no PACK 99.")

    for path in packages_root.rglob("*"):
        if path.is_file():
            index.setdefault(path.name, []).append(path)
    return index


def resolve_asset_path(
    root: Path,
    asset: dict[str, Any],
    field: str,
    basename_index: dict[str, list[Path]],
) -> Path | None:
    value = asset.get(field)
    if not isinstance(value, str) or not value:
        return None

    provenance = asset.get("_provenance") or {}
    package_root_value = provenance.get("packageRoot")
    if isinstance(package_root_value, str):
        direct = root / package_root_value / value
        if direct.is_file():
            return direct

        package_root = root / package_root_value
        if package_root.is_dir():
            suffix_matches = [
                candidate
                for candidate in package_root.rglob(Path(value).name)
                if candidate.is_file()
                and candidate.as_posix().endswith(Path(value).as_posix())
            ]
            if len(suffix_matches) == 1:
                return suffix_matches[0]

    basename_matches = basename_index.get(Path(value).name, [])
    if len(basename_matches) == 1:
        return basename_matches[0]

    if isinstance(package_root_value, str):
        scoped = [
            candidate
            for candidate in basename_matches
            if candidate.is_relative_to(root / package_root_value)
        ]
        if len(scoped) == 1:
            return scoped[0]

    return None


def should_install_asset(asset: dict[str, Any], profile: str) -> bool:
    if profile == "full":
        return True

    if isinstance(asset.get("file"), str) and asset.get("file"):
        return True

    category = str(asset.get("category", ""))
    return category in {
        "projectile",
        "impact-vfx",
        "combat-vfx",
        "selection-vfx",
        "map-event-vfx",
        "map-selection-vfx",
        "map-path-vfx",
    }


def copy_file(source: Path, destination: Path, *, dry_run: bool) -> None:
    if dry_run:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def copy_tree(source: Path, destination: Path, *, dry_run: bool) -> None:
    if dry_run:
        return
    shutil.copytree(source, destination, dirs_exist_ok=True)


def install_target(
    source_root: Path,
    destination: Path,
    registry: dict[str, Any],
    manifest: dict[str, Any],
    *,
    profile: str,
    clean: bool,
    dry_run: bool,
) -> dict[str, Any]:
    if clean and destination.exists() and not dry_run:
        shutil.rmtree(destination)

    basename_index = package_files(source_root)
    normalized_assets: list[dict[str, Any]] = []
    copied_sources: set[Path] = set()
    unresolved: list[dict[str, str]] = []

    if profile == "full":
        copy_tree(source_root / "packages", destination / "packages", dry_run=dry_run)

    for original_asset in registry["assets"]:
        if not should_install_asset(original_asset, profile):
            continue

        asset = dict(original_asset)
        for field in ASSET_PATH_FIELDS:
            resolved = resolve_asset_path(
                source_root,
                original_asset,
                field,
                basename_index,
            )
            if resolved is None:
                if original_asset.get(field):
                    unresolved.append(
                        {
                            "assetId": str(original_asset.get("id", "")),
                            "field": field,
                            "value": str(original_asset.get(field)),
                        }
                    )
                continue

            relative_to_pack = resolved.relative_to(source_root)
            asset[f"_runtime{field[0].upper()}{field[1:]}"] = relative_to_pack.as_posix()

            if profile != "full" and resolved not in copied_sources:
                copy_file(
                    resolved,
                    destination / relative_to_pack,
                    dry_run=dry_run,
                )
                copied_sources.add(resolved)

        primary_runtime_file = asset.get("_runtimeFile")
        if primary_runtime_file or profile == "full":
            normalized_assets.append(asset)

    for relative in (
        Path("pack-manifest.json"),
        Path("registry/entities-global.json"),
        Path("registry/packs-global.json"),
        Path("validation/validation-report.json"),
    ):
        source = source_root / relative
        if source.is_file():
            copy_file(source, destination / relative, dry_run=dry_run)

    runtime_registry = {
        "project": registry.get("project"),
        "packId": PACK_ID,
        "version": manifest.get("version", "1.0.0"),
        "profile": profile,
        "assetCount": len(normalized_assets),
        "assets": normalized_assets,
        "unresolved": unresolved,
        "signature": SIGNATURE,
    }
    install_manifest = {
        "packId": PACK_ID,
        "version": manifest.get("version", "1.0.0"),
        "profile": profile,
        "assetCount": len(normalized_assets),
        "copiedFiles": len(copied_sources) if profile != "full" else None,
        "unresolvedReferences": len(unresolved),
        "signature": SIGNATURE,
    }

    if not dry_run:
        write_json(destination / "registry" / RUNTIME_REGISTRY_NAME, runtime_registry)
        write_json(destination / "runtime-install.json", install_manifest)

    return install_manifest


def destination_paths(repo_root: Path, target: str) -> Iterable[tuple[str, Path]]:
    if target in ("godot", "all"):
        yield "godot", repo_root / "client" / "godot" / "assets" / "runtime"
    if target in ("web", "all"):
        yield "web", repo_root / "client" / "web" / "public" / "assets" / "runtime"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Instala o HOC PACK 99 nos clientes locais.",
    )
    parser.add_argument("source", type=Path, help="ZIP ou diretório do PACK 99")
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
        help="Raiz do repositório (padrão: diretório atual)",
    )
    parser.add_argument(
        "--target",
        choices=("godot", "web", "all"),
        default="all",
        help="Cliente que receberá o runtime",
    )
    parser.add_argument(
        "--profile",
        choices=("core", "full"),
        default="core",
        help="core instala assets estáticos; full instala todo o PACK 99",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove o runtime anterior antes da instalação",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida e planeja sem copiar arquivos",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    repo_root = args.repo.expanduser().resolve()

    if not (repo_root / "client").is_dir():
        print(
            f"Erro: {repo_root} não parece ser a raiz do repositório.",
            file=sys.stderr,
        )
        return 2

    runtime_source: RuntimeSource | None = None
    try:
        runtime_source = locate_runtime_root(args.source)
        manifest, _validation, registry = validate_pack(runtime_source.root)

        results = []
        for target_name, destination in destination_paths(repo_root, args.target):
            result = install_target(
                runtime_source.root,
                destination,
                registry,
                manifest,
                profile=args.profile,
                clean=args.clean,
                dry_run=args.dry_run,
            )
            results.append((target_name, destination, result))

        action = "Validado" if args.dry_run else "Instalado"
        print(f"{action}: {PACK_ID} ({args.profile})")
        for target_name, destination, result in results:
            print(
                f"- {target_name}: {destination} | "
                f"assets={result['assetCount']} | "
                f"não resolvidos={result['unresolvedReferences']}"
            )
        print(SIGNATURE)
        return 0
    except InstallError as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 1
    finally:
        if runtime_source:
            runtime_source.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
