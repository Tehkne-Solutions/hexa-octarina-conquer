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

function text(value) {
  return JSON.stringify(value).toLowerCase();
}

function provenanceKey(asset) {
  const provenance = asset?._provenance ?? {};
  return provenance.packageRoot ?? provenance.pack ?? provenance.sourceRoot ?? null;
}

function runtimePaths(asset) {
  return Object.entries(asset ?? {})
    .filter(([key, value]) => key.startsWith("_runtime") && typeof value === "string" && /\.(png|webp|jpg|jpeg)$/i.test(value))
    .map(([field, value]) => ({ field, value }));
}

async function main() {
  const [registry, aliases] = await Promise.all([
    readFile(registryPath, "utf8").then(JSON.parse),
    readFile(aliasPath, "utf8").then(JSON.parse),
  ]);

  const targetBinding = aliases.aliases?.[targetAlias];
  if (!targetBinding?.asset_id) throw new Error(`BRAKK_AUDIT_ALIAS_MISSING:${targetAlias}`);

  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const target = assets.find((asset) => asset.id === targetBinding.asset_id);
  if (!target) throw new Error(`BRAKK_AUDIT_TARGET_MISSING:${targetBinding.asset_id}`);

  const targetProvenance = provenanceKey(target);
  const targetCategory = target.category ?? null;
  const targetPackage = target.packageId ?? target.packId ?? null;

  const semantic = assets.filter((asset) => /berserk|brakk/i.test(text(asset)));
  const sameProvenance = targetProvenance
    ? assets.filter((asset) => provenanceKey(asset) === targetProvenance)
    : [];
  const samePackage = targetPackage
    ? assets.filter((asset) => (asset.packageId ?? asset.packId ?? null) === targetPackage)
    : [];
  const related = [...new Map(
    [target, ...semantic, ...sameProvenance, ...samePackage].map((asset) => [asset.id, asset]),
  ).values()];

  const report = {
    targetAlias,
    targetBinding,
    target: {
      id: target.id,
      category: targetCategory,
      provenance: target._provenance ?? null,
      packageId: targetPackage,
      runtimePaths: runtimePaths(target),
      raw: target,
    },
    counts: {
      registry: assets.length,
      semantic: semantic.length,
      sameProvenance: sameProvenance.length,
      samePackage: samePackage.length,
      related: related.length,
    },
    related: related.map((asset) => ({
      id: asset.id,
      category: asset.category ?? null,
      provenance: asset._provenance ?? null,
      packageId: asset.packageId ?? asset.packId ?? null,
      runtimePaths: runtimePaths(asset),
      semanticMatch: /berserk|brakk/i.test(text(asset)),
      raw: asset,
    })),
    signature: "Tehkné Solutions",
  };

  await mkdir(outputRoot, { recursive: true });
  await writeFile(path.join(outputRoot, "brakk-source-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  let copied = 0;
  for (const asset of related) {
    for (const entry of runtimePaths(asset)) {
      const source = path.join(runtimeRoot, entry.value);
      const extension = path.extname(entry.value) || ".png";
      const destination = path.join(outputRoot, `${String(copied + 1).padStart(3, "0")}__${asset.id}__${entry.field}${extension}`);
      try {
        await copyFile(source, destination);
        copied += 1;
      } catch {
        // The JSON report remains authoritative when an optional runtime image field is absent.
      }
      if (copied >= 80) break;
    }
    if (copied >= 80) break;
  }

  await writeFile(path.join(outputRoot, "SUMMARY.txt"), [
    `BRAKK_TARGET_ALIAS=${targetAlias}`,
    `BRAKK_TARGET_ASSET=${target.id}`,
    `BRAKK_TARGET_PROVENANCE=${targetProvenance ?? "unknown"}`,
    `BRAKK_SEMANTIC_CANDIDATES=${semantic.length}`,
    `BRAKK_RELATED_ASSETS=${related.length}`,
    `BRAKK_COPIED_IMAGES=${copied}`,
    "Tehkné Solutions",
    "",
  ].join("\n"), "utf8");

  console.log(`BRAKK_SOURCE_AUDIT target=${target.id} semantic=${semantic.length} related=${related.length} copied=${copied}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
