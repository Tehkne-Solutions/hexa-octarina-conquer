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
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

PACK_ID = "HOC_PACK_99_FINAL_RUNTIME"
SIGNATURE = "Tehkné Solutions"
RUNTIME_REGISTRY_NAME = "assets-runtime.json"
EXPECTED_FULL_ASSETS = 1037
EXPECTED_CORE_ASSETS = 597
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


@dataclass(frozen=True)
class InstallPlan:
    normalized_assets: list[dict[str, Any]]
    resolved_sources: dict[Path, Path]


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


def safe_extract_archive(archive_path: Path, destination: Path) -> None:
    destination_root = destination.resolve()
    with zipfile.ZipFile(archive_path, "r") as archive:
        for info in archive.infolist():
            member = PurePosixPath(info.filename)
            if member.is_absolute() or ".." in member.parts:
                raise InstallError(f"Entrada insegura no ZIP: {info.filename}")
            resolved = (destination / Path(*member.parts)).resolve()
            if resolved != destination_root and destination_root not in resolved.parents:
                raise InstallError(f"Entrada fora do destino no ZIP: {info.filename}")
        archive.extractall(destination)


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
        safe_extract_archive(path, temporary_root)
        root = normalize_extracted_root(temporary_root)
        return RuntimeSource(root=root, temporary_root=temporary_root)
    except Exception:
        shutil.rmtree(temporary_root, ignore_errors=True)
        raise


def normalize_extracted_root(path: Path) -> Path:
    if (path / "runtime-install.json").is_file() and (path / "registry" / "assets-runtime.json").is_file():
        return build_compat_root(path)

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


def build_compat_root(path: Path) -> Path:
    runtime_install = read_json(path / "runtime-install.json")
    runtime_registry = read_json(path / "registry" / "assets-runtime.json")
    compat_root = path / ".pack99-compat-root"
    if compat_root.exists():
        shutil.rmtree(compat_root)
    compat_root.mkdir(parents=True, exist_ok=True)

    manifest = {
        "packId": PACK_ID,
        "version": runtime_install.get("version", "1.0.0"),
        "signature": SIGNATURE,
        "profile": runtime_install.get("profile", "core"),
        "sourceArchive": runtime_install.get("sourceArchive"),
        "sourceSha256": runtime_install.get("sourceSha256"),
    }
    (compat_root / "pack-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    validation = {
        "passed": True,
        "source": "runtime-install.json",
        "profile": runtime_install.get("profile", "core"),
    }
    (compat_root / "validation").mkdir(parents=True, exist_ok=True)
    (compat_root / "validation" / "validation-report.json").write_text(json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    registry_dir = compat_root / "registry"
    registry_dir.mkdir(parents=True, exist_ok=True)
    registry_payload = {
        "project": runtime_registry.get("project"),
        "packId": PACK_ID,
        "version": runtime_registry.get("version", manifest["version"]),
        "profile": runtime_registry.get("profile", manifest["profile"]),
        "assetCount": runtime_registry.get("assetCount", 0),
        "assets": runtime_registry.get("assets", []),
        "signature": SIGNATURE,
    }
    (registry_dir / "assets-global.json").write_text(json.dumps(registry_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if (path / "registry" / "entities-global.json").is_file():
        shutil.copy2(path / "registry" / "entities-global.json", registry_dir / "entities-global.json")
    if (path / "registry" / "packs-global.json").is_file():
        shutil.copy2(path / "registry" / "packs-global.json", registry_dir / "packs-global.json")

    if (path / "packages").is_dir():
        shutil.copytree(path / "packages", compat_root / "packages", dirs_exist_ok=True)
    else:
        (compat_root / "packages").mkdir(parents=True, exist_ok=True)

    return compat_root


def validate_pack(
    root: Path,
    *,
    require_canonical_count: bool = True,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
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

    assets = registry["assets"]
    asset_ids = [str(asset.get("id", "")) for asset in assets]
    if any(not asset_id for asset_id in asset_ids):
        raise InstallError("O registro global contém asset sem ID canônico.")
    if len(set(asset_ids)) != len(asset_ids):
        raise InstallError("O registro global contém IDs canônicos duplicados.")
    if require_canonical_count and len(assets) != EXPECTED_FULL_ASSETS:
        raise InstallError(
            f"Registro global incompleto: esperado {EXPECTED_FULL_ASSETS}, recebido {len(assets)}."
        )

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


def normalize_package_root_value(value: str) -> str:
    """Map provenance names such as HOC_PACK_01_*_FINAL to PACK_01_*."""
    parts = list(PurePosixPath(value).parts)
    if len(parts) >= 2 and parts[0] == "packages":
        package_name = parts[1]
        if package_name.startswith("HOC_") and package_name.endswith("_FINAL"):
            parts[1] = package_name[len("HOC_") : -len("_FINAL")]
    return PurePosixPath(*parts).as_posix()


def package_root_candidates(root: Path, package_root_value: str) -> list[Path]:
    values = [package_root_value, normalize_package_root_value(package_root_value)]
    candidates: list[Path] = []
    for value in values:
        candidate = root / Path(*PurePosixPath(value).parts)
        if candidate not in candidates:
            candidates.append(candidate)
    return candidates


def resolve_asset_path(
    root: Path,
    asset: dict[str, Any],
    field: str,
    basename_index: dict[str, list[Path]],
) -> Path | None:
    value = asset.get(field)
    if not isinstance(value, str) or not value:
        return None

    value_path = Path(*PurePosixPath(value).parts)
    provenance = asset.get("_provenance") or {}
    package_root_value = provenance.get("packageRoot")
    scoped_roots: list[Path] = []

    if isinstance(package_root_value, str):
        scoped_roots = package_root_candidates(root, package_root_value)
        for package_root in scoped_roots:
            direct = package_root / value_path
            if direct.is_file():
                return direct

            if package_root.is_dir():
                suffix_matches = [
                    candidate
                    for candidate in package_root.rglob(value_path.name)
                    if candidate.is_file()
                    and candidate.as_posix().endswith(PurePosixPath(value).as_posix())
                ]
                if len(suffix_matches) == 1:
                    return suffix_matches[0]

    basename_matches = basename_index.get(value_path.name, [])
    if len(basename_matches) == 1:
        return basename_matches[0]

    for package_root in scoped_roots:
        scoped = [
            candidate
            for candidate in basename_matches
            if candidate.is_relative_to(package_root)
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


def build_install_plan(
    source_root: Path,
    registry: dict[str, Any],
    *,
    profile: str,
) -> InstallPlan:
    basename_index = package_files(source_root)
    normalized_assets: list[dict[str, Any]] = []
    resolved_sources: dict[Path, Path] = {}
    unresolved: list[dict[str, str]] = []

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
            resolved_sources[resolved] = relative_to_pack

        primary_runtime_file = asset.get("_runtimeFile")
        if primary_runtime_file or profile == "full":
            normalized_assets.append(asset)

    if unresolved:
        preview = "\n".join(
            f"- {item['assetId']}:{item['field']} -> {item['value']}"
            for item in unresolved[:20]
        )
        raise InstallError(
            f"PACK 99 possui {len(unresolved)} referência(s) não resolvida(s). "
            f"Nenhum runtime foi alterado.\n{preview}"
        )

    if profile == "full" and len(normalized_assets) != len(registry["assets"]):
        raise InstallError(
            "O perfil full não preservou todos os IDs canônicos: "
            f"esperado {len(registry['assets'])}, recebido {len(normalized_assets)}."
        )

    return InstallPlan(
        normalized_assets=normalized_assets,
        resolved_sources=resolved_sources,
    )


def activate_staging(staging: Path, destination: Path) -> None:
    backup = destination.with_name(f".{destination.name}.backup")
    shutil.rmtree(backup, ignore_errors=True)
    destination.parent.mkdir(parents=True, exist_ok=True)

    try:
        if destination.exists():
            destination.replace(backup)
        staging.replace(destination)
    except OSError as error:
        if destination.exists():
            shutil.rmtree(destination, ignore_errors=True)
        if backup.exists():
            backup.replace(destination)
        raise InstallError(f"Falha ao ativar runtime em {destination}: {error}") from error
    finally:
        shutil.rmtree(backup, ignore_errors=True)


def install_target(
    source_root: Path,
    destination: Path,
    registry: dict[str, Any],
    manifest: dict[str, Any],
    *,
    profile: str,
    clean: bool,
    dry_run: bool,
    enforce_canonical_counts: bool = True,
) -> dict[str, Any]:
    plan = build_install_plan(source_root, registry, profile=profile)
    asset_count = len(plan.normalized_assets)

    if enforce_canonical_counts:
        if profile == "full" and asset_count != EXPECTED_FULL_ASSETS:
            raise InstallError(
                f"Perfil full exige exatamente {EXPECTED_FULL_ASSETS} assets; recebido {asset_count}."
            )
        if profile == "core" and asset_count < EXPECTED_CORE_ASSETS:
            raise InstallError(
                f"Perfil core exige ao menos {EXPECTED_CORE_ASSETS} assets; recebido {asset_count}."
            )

    runtime_registry = {
        "project": registry.get("project"),
        "packId": PACK_ID,
        "version": manifest.get("version", "1.0.0"),
        "profile": profile,
        "assetCount": asset_count,
        "assets": plan.normalized_assets,
        "unresolved": [],
        "signature": SIGNATURE,
    }
    install_manifest = {
        "packId": PACK_ID,
        "version": manifest.get("version", "1.0.0"),
        "profile": profile,
        "assetCount": asset_count,
        "copiedFiles": len(plan.resolved_sources) if profile != "full" else None,
        "unresolvedReferences": 0,
        "signature": SIGNATURE,
    }

    if dry_run:
        return install_manifest

    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(
            prefix=f".{destination.name}.staging-",
            dir=destination.parent,
        )
    )
    try:
        if destination.exists() and not clean:
            copy_tree(destination, staging, dry_run=False)

        if profile == "full":
            copy_tree(source_root / "packages", staging / "packages", dry_run=False)
        else:
            for source, relative in plan.resolved_sources.items():
                copy_file(source, staging / relative, dry_run=False)

        for relative in (
            Path("pack-manifest.json"),
            Path("registry/entities-global.json"),
            Path("registry/packs-global.json"),
            Path("validation/validation-report.json"),
        ):
            source = source_root / relative
            if source.is_file():
                copy_file(source, staging / relative, dry_run=False)

        write_json(staging / "registry" / RUNTIME_REGISTRY_NAME, runtime_registry)
        write_json(staging / "runtime-install.json", install_manifest)
        activate_staging(staging, destination)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise

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
        help="Remove o runtime anterior somente após a validação completa",
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
                enforce_canonical_counts=True,
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
    except (InstallError, OSError, zipfile.BadZipFile) as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 1
    finally:
        if runtime_source:
            runtime_source.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
