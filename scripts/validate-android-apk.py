#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

from androguard.core.apk import APK

ANDROID_NS = "{http://schemas.android.com/apk/res/android}"


def fail(message: str) -> None:
    raise SystemExit(f"ANDROID_APK_VALIDATION_FAILED: {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate a physical-device Android APK.")
    parser.add_argument("apk", type=Path)
    parser.add_argument("--package", required=True)
    parser.add_argument("--version-name", required=True)
    parser.add_argument("--version-code", required=True)
    parser.add_argument("--required-abi", action="append", required=True)
    parser.add_argument("--max-size-mb", type=float, default=120.0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    apk_path: Path = args.apk
    if not apk_path.is_file() or apk_path.stat().st_size == 0:
        fail(f"APK not found or empty: {apk_path}")

    size_mb = apk_path.stat().st_size / (1024 * 1024)
    if size_mb > args.max_size_mb:
        fail(f"APK is too large for the physical-device profile: {size_mb:.2f} MB > {args.max_size_mb:.2f} MB")

    native_sizes: dict[str, int] = defaultdict(int)
    with zipfile.ZipFile(apk_path) as archive:
        names = archive.namelist()
        abis = set()
        for info in archive.infolist():
            if info.filename.startswith("lib/"):
                parts = info.filename.split("/")
                if len(parts) >= 3:
                    abis.add(parts[1])
                    native_sizes[parts[1]] += info.file_size
        expected_abis = set(args.required_abi)
        if abis != expected_abis:
            fail(f"unexpected ABIs: expected exactly {sorted(expected_abis)}, found {sorted(abis)}")
        if "AndroidManifest.xml" not in names:
            fail("AndroidManifest.xml is missing")
        if not any(name.startswith("classes") and name.endswith(".dex") for name in names):
            fail("classes.dex is missing")

    apk = APK(str(apk_path))
    if apk.get_package() != args.package:
        fail(f"unexpected package: {apk.get_package()}")
    if apk.get_androidversion_name() != args.version_name:
        fail(f"unexpected version name: {apk.get_androidversion_name()}")
    if str(apk.get_androidversion_code()) != str(args.version_code):
        fail(f"unexpected version code: {apk.get_androidversion_code()}")

    min_sdk = int(apk.get_min_sdk_version() or 0)
    if min_sdk > 26:
        fail(f"minSdk {min_sdk} excludes Android 8/API 26")

    manifest = apk.get_android_manifest_axml().get_xml_obj()
    providers = []
    for provider in manifest.findall(".//provider"):
        providers.append(
            {
                "name": provider.get(ANDROID_NS + "name", ""),
                "authority": provider.get(ANDROID_NS + "authorities", ""),
                "exported": provider.get(ANDROID_NS + "exported", ""),
            }
        )

    counts = Counter(item["authority"] for item in providers if item["authority"])
    duplicates = sorted(authority for authority, count in counts.items() if count > 1)
    if duplicates:
        fail(f"duplicate provider authorities: {duplicates}; providers={providers}")

    file_providers = [item for item in providers if item["name"] == "androidx.core.content.FileProvider"]
    if len(file_providers) != 1:
        fail(f"expected exactly one FileProvider, found {len(file_providers)}")

    report = {
        "apk": str(apk_path),
        "apkSizeMb": round(size_mb, 2),
        "package": apk.get_package(),
        "versionName": apk.get_androidversion_name(),
        "versionCode": str(apk.get_androidversion_code()),
        "minSdk": min_sdk,
        "targetSdk": apk.get_target_sdk_version(),
        "abis": sorted(abis),
        "nativeSizeMb": {abi: round(size / (1024 * 1024), 2) for abi, size in sorted(native_sizes.items())},
        "providers": providers,
        "signatureBrand": "Tehkné Solutions",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
