import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const runtimeRoot = path.join(webRoot, "public", "assets", "runtime");
const registryPath = path.join(runtimeRoot, "registry", "assets-runtime.json");
const aliasPath = path.join(webRoot, "public", "canonical-runtime-aliases.json");
const outputRoot = path.join(webRoot, "visual-qa-pack99", "brakk-source-audit");
const targetAlias = "CHAMP_BERSERKER_01_IDLE_BASE_NW_01";
const imagePattern = /\.(png|webp|jpg|jpeg)$/i;

function serialized(value) {
  return JSON.stringify(value).toLowerCase();
}

async function walkImages(root, current = root, output = []) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) await walkImages(root, absolute, output);
    else if (entry.isFile() && imagePattern.test(entry.name)) output.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
  return output;
}

async function fileExists(candidate) {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

async function main() {
  const [registry, aliases, allImages] = await Promise.all([
    readFile(registryPath, "utf8").then(JSON.parse),
    readFile(aliasPath, "utf8").then(JSON.parse),
    walkImages(runtimeRoot),
  ]);

  const targetBinding = aliases.aliases?.[targetAlias];
  if (!targetBinding) throw new Error(`BRAKK_AUDIT_ALIAS_MISSING:${targetAlias}`);

  const logicalPath = typeof targetBinding === "string"
    ? targetBinding.replace(/^\/+/, "")
    : String(targetBinding.runtime_url ?? targetBinding.runtimeUrl ?? targetBinding.file ?? "").replace(/^\/+/, "");
  const logicalBasename = logicalPath ? path.basename(logicalPath) : `${targetAlias}.png`;
  const logicalFamily = logicalPath?.split("/directions/")[0] ?? "packages/PACK_09_CHAMPIONS_ADVANCED/berserker";

  const exactPhysical = allImages.filter((relative) => relative === logicalPath || path.basename(relative) === logicalBasename);
  const semanticPhysical = allImages.filter((relative) => /berserk|brakk/i.test(relative));
  const pack09Physical = allImages.filter((relative) => /PACK_09_CHAMPIONS_ADVANCED/i.test(relative));
  const physicalCandidates = [...new Set([...exactPhysical, ...semanticPhysical, ...pack09Physical])];

  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const semanticRegistry = assets.filter((asset) => /berserk|brakk|PACK_09_CHAMPIONS_ADVANCED/i.test(serialized(asset)));
  const basenameRegistry = assets.filter((asset) => serialized(asset).includes(logicalBasename.toLowerCase()));
  const registryCandidates = [...new Map([...semanticRegistry, ...basenameRegistry].map((asset) => [asset.id ?? serialized(asset), asset])).values()];

  const report = {
    targetAlias,
    targetBinding,
    logicalPath,
    logicalBasename,
    logicalFamily,
    counts: {
      registryAssets: assets.length,
      materializedImages: allImages.length,
      exactPhysical: exactPhysical.length,
      semanticPhysical: semanticPhysical.length,
      pack09Physical: pack09Physical.length,
      physicalCandidates: physicalCandidates.length,
      semanticRegistry: semanticRegistry.length,
      basenameRegistry: basenameRegistry.length,
      registryCandidates: registryCandidates.length,
    },
    exactPhysical,
    semanticPhysical,
    pack09Physical,
    physicalCandidates,
    registryCandidates,
    signature: "Tehkné Solutions",
  };

  await mkdir(outputRoot, { recursive: true });
  await writeFile(path.join(outputRoot, "brakk-source-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  let copied = 0;
  for (const relative of physicalCandidates) {
    if (copied >= 80) break;
    const source = path.join(runtimeRoot, ...relative.split("/"));
    if (!(await fileExists(source))) continue;
    const extension = path.extname(relative) || ".png";
    const safe = relative.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
    const destination = path.join(outputRoot, `${String(copied + 1).padStart(3, "0")}__${safe}${extension === path.extname(safe) ? "" : extension}`);
    await copyFile(source, destination);
    copied += 1;
  }

  await writeFile(path.join(outputRoot, "SUMMARY.txt"), [
    `BRAKK_TARGET_ALIAS=${targetAlias}`,
    `BRAKK_LOGICAL_PATH=${logicalPath || "unknown"}`,
    `BRAKK_EXACT_PHYSICAL=${exactPhysical.length}`,
    `BRAKK_SEMANTIC_PHYSICAL=${semanticPhysical.length}`,
    `BRAKK_PACK09_PHYSICAL=${pack09Physical.length}`,
    `BRAKK_PHYSICAL_CANDIDATES=${physicalCandidates.length}`,
    `BRAKK_REGISTRY_CANDIDATES=${registryCandidates.length}`,
    `BRAKK_COPIED_IMAGES=${copied}`,
    "Tehkné Solutions",
    "",
  ].join("\n"), "utf8");

  console.log(`BRAKK_SOURCE_AUDIT logical=${logicalPath || "unknown"} exact=${exactPhysical.length} semantic=${semanticPhysical.length} pack09=${pack09Physical.length} candidates=${physicalCandidates.length} registry=${registryCandidates.length} copied=${copied}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
