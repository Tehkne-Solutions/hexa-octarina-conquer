#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import zipfile
from collections import Counter
from pathlib import Path

from androguard.core.apk import APK

EXPECTED_PACKAGE = "com.tehkne.hexaoctarina"
EXPECTED_VERSION_NAME = "0.11.1"
EXPECTED_VERSION_CODE = "12"
REQUIRED_ABIS = {"armeabi-v7a", "arm64-v8a"}
ANDROID_NS = "{http://schemas.android.com/apk/res/android}"


def fail(message: str) -> None:
    raise SystemExit(f"ANDROID_APK_VALIDATION_FAILED: {message}")


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: validate-android-apk.py <apk>")

    apk_path = Path(sys.argv[1])
    if not apk_path.is_file() or apk_path.stat().st_size == 0:
        fail(f"APK not found or empty: {apk_path}")

    with zipfile.ZipFile(apk_path) as archive:
        names = archive.namelist()
        abis = {
            parts[1]
            for name in names
            if name.startswith("lib/") and len(parts := name.split("/")) >= 3
        }
        if not REQUIRED_ABIS.issubset(abis):
            fail(f"required ABIs missing: expected {sorted(REQUIRED_ABIS)}, found {sorted(abis)}")
        if "AndroidManifest.xml" not in names:
            fail("AndroidManifest.xml is missing")
        if not any(name.startswith("classes") and name.endswith(".dex") for name in names):
            fail("classes.dex is missing")

    apk = APK(str(apk_path))
    if apk.get_package() != EXPECTED_PACKAGE:
        fail(f"unexpected package: {apk.get_package()}")
    if apk.get_androidversion_name() != EXPECTED_VERSION_NAME:
        fail(f"unexpected version name: {apk.get_androidversion_name()}")
    if str(apk.get_androidversion_code()) != EXPECTED_VERSION_CODE:
        fail(f"unexpected version code: {apk.get_androidversion_code()}")

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
        "package": apk.get_package(),
        "versionName": apk.get_androidversion_name(),
        "versionCode": str(apk.get_androidversion_code()),
        "minSdk": apk.get_min_sdk_version(),
        "targetSdk": apk.get_target_sdk_version(),
        "abis": sorted(abis),
        "providers": providers,
        "signature": "Tehkné Solutions",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
