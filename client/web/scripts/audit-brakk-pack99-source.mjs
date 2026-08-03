import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const runtimeRoot = path.join(webRoot, "public", "assets", "runtime");
const registryPath = path.join(runtimeRoot, "registry", "assets-runtime.json");
const aliasPath = path.join(webRoot, "public", "canonical-runtime-aliases.json");
const outputRoot = path.join(webRoot, "visual-qa-pack99", "brakk-source-audit");
const targetAlias = "CHAMP_BERSERKER_01_IDLE_BASE_NW_01";

function serialized(value) {
  return JSON.stringify(value).toLowerCase();
}

function provenanceKey(asset) {
  const provenance = asset?._provenance ?? {};
  return provenance.packageRoot ?? provenance.pack ?? provenance.sourceRoot ?? null;
}

function imagePaths(asset) {
  return Object.entries(asset ?? {})
    .filter(([, value]) => typeof value === "string" && /\.(png|webp|jpg|jpeg)$/i.test(value))
    .map(([field, value]) => ({ field, value: value.replace(/^\/+/, "") }));
}

function targetAssetId(binding) {
  if (binding && typeof binding === "object") return binding.asset_id ?? binding.assetId ?? binding.id ?? null;
  return null;
}

function targetRuntimePath(binding) {
  if (typeof binding === "string") return binding.replace(/^\/+/, "");
  if (binding && typeof binding === "object") {
    return String(binding.runtime_url ?? binding.runtimeUrl ?? binding.file ?? "").replace(/^\/+/, "") || null;
  }
  return null;
}

async function main() {
  const [registry, aliases] = await Promise.all([
    readFile(registryPath, "utf8").then(JSON.parse),
    readFile(aliasPath, "utf8").then(JSON.parse),
  ]);

  const targetBinding = aliases.aliases?.[targetAlias];
  if (!targetBinding) throw new Error(`BRAKK_AUDIT_ALIAS_MISSING:${targetAlias}`);

  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const boundId = targetAssetId(targetBinding);
  const boundPath = targetRuntimePath(targetBinding);
  const boundBasename = boundPath ? path.basename(boundPath) : null;
  const target = assets.find((asset) => {
    if (boundId && asset.id === boundId) return true;
    const values = imagePaths(asset).map((entry) => entry.value);
    if (boundPath && values.some((value) => value === boundPath || value.endsWith(`/${boundPath}`))) return true;
    if (boundBasename && values.some((value) => path.basename(value) === boundBasename)) return true;
    return serialized(asset).includes(targetAlias.toLowerCase());
  });
  if (!target) throw new Error(`BRAKK_AUDIT_TARGET_MISSING:${JSON.stringify(targetBinding)}`);

  const targetProvenance = provenanceKey(target);
  const targetCategory = target.category ?? null;
  const targetPackage = target.packageId ?? target.packId ?? null;
  const targetPathPrefix = boundPath?.split("/directions/")[0] ?? null;

  const semantic = assets.filter((asset) => /berserk|brakk/i.test(serialized(asset)));
  const sameProvenance = targetProvenance ? assets.filter((asset) => provenanceKey(asset) === targetProvenance) : [];
  const samePackage = targetPackage ? assets.filter((asset) => (asset.packageId ?? asset.packId ?? null) === targetPackage) : [];
  const samePathFamily = targetPathPrefix ? assets.filter((asset) => imagePaths(asset).some(({ value }) => value.includes(targetPathPrefix))) : [];
  const related = [...new Map(
    [target, ...semantic, ...sameProvenance, ...samePackage, ...samePathFamily].map((asset) => [asset.id ?? serialized(asset), asset]),
  ).values()];

  const report = {
    targetAlias,
    targetBinding,
    targetResolution: { boundId, boundPath, boundBasename, targetPathPrefix },
    target: {
      id: target.id ?? null,
      category: targetCategory,
      provenance: target._provenance ?? null,
      packageId: targetPackage,
      imagePaths: imagePaths(target),
      raw: target,
    },
    counts: {
      registry: assets.length,
      semantic: semantic.length,
      sameProvenance: sameProvenance.length,
      samePackage: samePackage.length,
      samePathFamily: samePathFamily.length,
      related: related.length,
    },
    related: related.map((asset) => ({
      id: asset.id ?? null,
      category: asset.category ?? null,
      provenance: asset._provenance ?? null,
      packageId: asset.packageId ?? asset.packId ?? null,
      imagePaths: imagePaths(asset),
      semanticMatch: /berserk|brakk/i.test(serialized(asset)),
      raw: asset,
    })),
    signature: "Tehkné Solutions",
  };

  await mkdir(outputRoot, { recursive: true });
  await writeFile(path.join(outputRoot, "brakk-source-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  let copied = 0;
  for (const asset of related) {
    for (const entry of imagePaths(asset)) {
      const candidates = [
        path.join(runtimeRoot, entry.value),
        path.join(runtimeRoot, entry.value.replace(/^packages\//, "packages/")),
      ];
      const extension = path.extname(entry.value) || ".png";
      const safeId = String(asset.id ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
      const destination = path.join(outputRoot, `${String(copied + 1).padStart(3, "0")}__${safeId}__${entry.field}${extension}`);
      let done = false;
      for (const source of candidates) {
        try {
          await copyFile(source, destination);
          copied += 1;
          done = true;
          break;
        } catch {
          // Try the next normalized path; the JSON report remains authoritative.
        }
      }
      if (copied >= 80) break;
      if (done) continue;
    }
    if (copied >= 80) break;
  }

  await writeFile(path.join(outputRoot, "SUMMARY.txt"), [
    `BRAKK_TARGET_ALIAS=${targetAlias}`,
    `BRAKK_TARGET_BINDING=${typeof targetBinding === "string" ? targetBinding : JSON.stringify(targetBinding)}`,
    `BRAKK_TARGET_ASSET=${target.id ?? "unknown"}`,
    `BRAKK_TARGET_PROVENANCE=${targetProvenance ?? "unknown"}`,
    `BRAKK_SEMANTIC_CANDIDATES=${semantic.length}`,
    `BRAKK_PATH_FAMILY=${samePathFamily.length}`,
    `BRAKK_RELATED_ASSETS=${related.length}`,
    `BRAKK_COPIED_IMAGES=${copied}`,
    "Tehkné Solutions",
    "",
  ].join("\n"), "utf8");

  console.log(`BRAKK_SOURCE_AUDIT target=${target.id ?? "unknown"} semantic=${semantic.length} pathFamily=${samePathFamily.length} related=${related.length} copied=${copied}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
