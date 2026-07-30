#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const webRoot = path.join(root, "client", "web");
const indexPath = path.join(webRoot, "public", "assets", "runtime", "pack99", "runtime-index.json");
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

if (!fs.existsSync(indexPath)) {
  fail(`runtime index not found: ${path.relative(root, indexPath)}`);
} else {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const assets = Array.isArray(index.assets) ? index.assets : [];
  const canonicalIds = new Set(assets.map((asset) => asset.canonicalId ?? asset.id));
  const missingCanonicalIds = REQUIRED_CANONICAL_IDS.filter((id) => !canonicalIds.has(id));
  const missingFiles = [];

  for (const asset of assets) {
    if (typeof asset.web !== "string") continue;
    const normalized = asset.web.replaceAll("\\", "/");
    const marker = "client/web/public/";
    const relative = normalized.includes(marker) ? normalized.slice(normalized.indexOf(marker) + marker.length) : normalized.replace(/^\/+/, "");
    const filePath = path.join(webRoot, "public", relative);
    if (!fs.existsSync(filePath)) missingFiles.push({ id: asset.id, file: relative });
  }

  const summary = {
    checkedAt: new Date().toISOString(),
    runtimeMode: index.runtimeMode ?? index.profile ?? "unknown",
    reportedAssetCount: index.assetCount ?? assets.length,
    materializedAssetCount: assets.length,
    canonicalAssetCount: canonicalIds.size,
    requiredMissionAssets: REQUIRED_CANONICAL_IDS.length,
    missingCanonicalIds,
    missingFileCount: missingFiles.length,
    missingFiles: missingFiles.slice(0, 200),
    passed: missingCanonicalIds.length === 0 && missingFiles.length === 0,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log("\nPACK 99 Web Verification");
  console.log(`Mode: ${summary.runtimeMode}`);
  console.log(`Canonical IDs: ${summary.canonicalAssetCount}`);
  console.log(`Materialized entries: ${summary.materializedAssetCount}`);
  console.log(`Mission assets missing: ${missingCanonicalIds.length}`);
  console.log(`Physical files missing: ${missingFiles.length}`);
  console.log(`Report: ${path.relative(root, reportPath)}`);

  if (!summary.passed) fail("runtime assets are incomplete; inspect the generated report");
  else console.log("Status: PASS\n");
}
