#!/usr/bin/env python3
"""Validate that an exported Android APK is installable and update-safe.

Tehkné Solutions — development APK validation only.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path

ANDROID_NS = "http://schemas.android.com/apk/res/android"
ANDROID = f"{{{ANDROID_NS}}}"


def run(*args: str) -> str:
    completed = subprocess.run(args, check=False, text=True, capture_output=True)
    output = (completed.stdout or "") + (completed.stderr or "")
    if completed.returncode != 0:
        raise RuntimeError(f"command failed ({completed.returncode}): {' '.join(args)}\n{output}")
    return output


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def normalized_digest(value: str) -> str:
    return re.sub(r"[^0-9a-f]", "", value.lower())


def parse_manifest(manifest_xml: str) -> tuple[int | None, list[tuple[str, str]]]:
    root = ET.fromstring(manifest_xml)
    uses_sdk = root.find("uses-sdk")
    min_sdk_raw = uses_sdk.get(f"{ANDROID}minSdkVersion") if uses_sdk is not None else None
    min_sdk = int(min_sdk_raw) if min_sdk_raw and min_sdk_raw.isdigit() else None

    application = root.find("application")
    providers: list[tuple[str, str]] = []
    if application is not None:
        for provider in application.findall("provider"):
            providers.append(
                (
                    provider.get(f"{ANDROID}name", "<unknown>"),
                    provider.get(f"{ANDROID}authorities", ""),
                )
            )
    return min_sdk, providers


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("apk", type=Path)
    parser.add_argument("--aapt2", required=True)
    parser.add_argument("--apkanalyzer", required=True)
    parser.add_argument("--apksigner", required=True)
    parser.add_argument("--zipalign", required=True)
    parser.add_argument("--keystore", type=Path, required=True)
    parser.add_argument("--key-alias", default="tehkne-debug")
    parser.add_argument("--key-password", default="android")
    parser.add_argument("--package", default="com.tehkne.hexaoctarina")
    parser.add_argument("--version-code", default="12")
    parser.add_argument("--version-name", default="0.11.1")
    parser.add_argument("--abis", required=True, help="Comma-separated required native ABIs")
    args = parser.parse_args()

    require(args.apk.is_file() and args.apk.stat().st_size > 0, f"APK not found: {args.apk}")
    required_abis = [item.strip() for item in args.abis.split(",") if item.strip()]

    badging = run(args.aapt2, "dump", "badging", str(args.apk))
    manifest_xml = run(args.apkanalyzer, "manifest", "print", str(args.apk))
    min_sdk, providers = parse_manifest(manifest_xml)

    package_match = re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'", badging)
    require(package_match is not None, "aapt2 did not return package metadata")
    package_name, version_code, version_name = package_match.groups()
    require(package_name == args.package, f"unexpected package: {package_name}")
    require(version_code == args.version_code, f"unexpected versionCode: {version_code}")
    require(version_name == args.version_name, f"unexpected versionName: {version_name}")

    require(min_sdk is not None, "minimum Android SDK was not declared")
    require(min_sdk <= 24, f"minimum Android SDK unexpectedly increased to {min_sdk}")

    with zipfile.ZipFile(args.apk) as archive:
        names = set(archive.namelist())
        packaged_abis = sorted({name.split("/")[1] for name in names if name.startswith("lib/") and name.count("/") >= 2})
        for abi in required_abis:
            require(f"lib/{abi}/libgodot_android.so" in names, f"missing Godot native library for {abi}")
    require(set(packaged_abis) == set(required_abis), f"unexpected native ABI set: {packaged_abis}")

    run(args.zipalign, "-c", "-P", "16", "4", str(args.apk))
    signer_output = run(args.apksigner, "verify", "--verbose", "--print-certs", str(args.apk))
    signer_match = re.search(r"Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]+)", signer_output)
    require(signer_match is not None, "APK signer SHA-256 digest not found")

    key_output = run(
        "keytool",
        "-list",
        "-v",
        "-keystore",
        str(args.keystore),
        "-storepass",
        args.key_password,
        "-alias",
        args.key_alias,
    )
    key_match = re.search(r"SHA256:\s*([0-9A-Fa-f:]+)", key_output)
    require(key_match is not None, "keystore SHA-256 digest not found")
    require(
        normalized_digest(signer_match.group(1)) == normalized_digest(key_match.group(1)),
        "APK was not signed by the stable Tehkné development key",
    )

    authorities = [authority for _, authority in providers if authority]
    duplicates = sorted(authority for authority, count in Counter(authorities).items() if count > 1)
    require(not duplicates, f"duplicate Android provider authorities: {duplicates}; providers={providers}")
    file_providers = [(name, authority) for name, authority in providers if name.endswith("FileProvider")]
    require(len(file_providers) == 1, f"expected exactly one FileProvider, found: {file_providers}; providers={providers}")

    print(
        "APK_VALIDATED",
        {
            "package": package_name,
            "versionCode": version_code,
            "versionName": version_name,
            "minSdk": min_sdk,
            "abis": packaged_abis,
            "providers": providers,
            "signerSha256": normalized_digest(signer_match.group(1)),
            "sizeBytes": args.apk.stat().st_size,
            "signature": "Tehkné Solutions",
        },
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"APK_VALIDATION_FAILED: {exc}", file=sys.stderr)
        raise
