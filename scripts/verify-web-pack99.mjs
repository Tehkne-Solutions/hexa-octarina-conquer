#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const webRoot = path.join(root, "client", "web");
const runtimeRoot = path.join(webRoot, "public", "assets", "runtime");
const installPath = path.join(runtimeRoot, "runtime-install.json");
const manifestPath = path.join(runtimeRoot, "pack-manifest.json");
const registryPath = path.join(runtimeRoot, "registry", "assets-runtime.json");
const validationPath = path.join(runtimeRoot, "validation", "validation-report.json");
const reportPath = path.join(root, "reports", "pack99-web-verification.json");

const REQUIRED_CANONICAL_IDS = [
  "TILE_GRASS_FLAT_CENTER_A_01",
  "TILE_FOREST_FLAT_CENTER_A_01",
  "TILE_WATER_FLAT_CENTER_A_01",
  "PROP_STONE_BRIDGE_BUILT_NW_SE_01",
  "PROP_RUIN_LARGE_01",
  "TERR_OUTPOST_NEUTRAL_01",
  "TERR_CAMP_NEUTRAL_01",
  "PROP_ROCK_C_01",
  "RES_WOOD_ABUNDANT_01",
  "RES_FOOD_ABUNDANT_01",
  "RES_OCTARINE_CRYSTAL_ABUNDANT_01",
  "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
  "HERO_RANGER_01_IDLE_BASE_NE_01",
  "UNIT_RECRUIT_01_IDLE_BASE_NW_01",
  "CHAMP_BERSERKER_01_IDLE_BASE_NW_01",
];

function fail(message) {
  console.error(`\nPACK 99 verification failed: ${message}\n`);
  process.exitCode = 1;
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} not found: ${path.relative(root, filePath)}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizedAssetText(asset) {
  return [asset.id, asset.canonicalId, asset.file, asset._runtimeFile]
    .filter((value) => typeof value === "string")
    .join("|")
    .replaceAll("\\", "/")
    .toUpperCase();
}

try {
  const install = readJson(installPath, "runtime install manifest");
  const manifest = readJson(manifestPath, "pack manifest");
  const registry = readJson(registryPath, "runtime asset registry");
  const validation = fs.existsSync(validationPath) ? readJson(validationPath, "validation report") : null;
  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const missingCanonicalIds = REQUIRED_CANONICAL_IDS.filter(
    (requiredId) => !assets.some((asset) => normalizedAssetText(asset).includes(requiredId)),
  );
  const missingFiles = [];

  for (const asset of assets) {
    if (typeof asset._runtimeFile !== "string") continue;
    const relative = asset._runtimeFile.replaceAll("\\", "/").replace(/^\/+/, "");
    const filePath = path.join(runtimeRoot, ...relative.split("/"));
    if (!fs.existsSync(filePath)) missingFiles.push({ id: asset.id, file: relative });
  }

  const unresolved = Array.isArray(registry.unresolved) ? registry.unresolved.length : Number(install.unresolvedReferences ?? 0);
  const identityValid = install.packId === "HOC_PACK_99_FINAL_RUNTIME" && registry.packId === install.packId;
  const countValid = Number(install.assetCount) === assets.length && Number(registry.assetCount) === assets.length;
  const profileValid = install.profile === "full" && registry.profile === install.profile;

  const summary = {
    checkedAt: new Date().toISOString(),
    packId: install.packId,
    version: install.version,
    runtimeMode: install.profile,
    manifestVersion: manifest.version ?? null,
    reportedAssetCount: install.assetCount,
    materializedAssetCount: assets.length,
    requiredMissionAssets: REQUIRED_CANONICAL_IDS.length,
    missingCanonicalIds,
    missingFileCount: missingFiles.length,
    missingFiles: missingFiles.slice(0, 200),
    unresolvedReferences: unresolved,
    identityValid,
    countValid,
    profileValid,
    validationReportPresent: validation !== null,
    passed:
      identityValid &&
      countValid &&
      profileValid &&
      unresolved === 0 &&
      missingCanonicalIds.length === 0 &&
      missingFiles.length === 0,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log("\nPACK 99 Web Verification");
  console.log(`Pack: ${summary.packId} ${summary.version}`);
  console.log(`Mode: ${summary.runtimeMode}`);
  console.log(`Materialized entries: ${summary.materializedAssetCount}`);
  console.log(`Mission assets missing: ${summary.missingCanonicalIds.length}`);
  console.log(`Physical files missing: ${summary.missingFileCount}`);
  console.log(`Unresolved references: ${summary.unresolvedReferences}`);
  console.log(`Report: ${path.relative(root, reportPath)}`);

  if (!summary.passed) fail("runtime assets are incomplete or inconsistent; inspect the generated report");
  else console.log("Status: PASS\n");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
