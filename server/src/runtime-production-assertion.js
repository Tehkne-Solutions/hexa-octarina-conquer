import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const REQUIRED_ALIASES = [
  "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
  "HERO_RANGER_01_IDLE_BASE_NE_01",
  "UNIT_RECRUIT_01_IDLE_BASE_NW_01",
  "CHAMP_BERSERKER_01_IDLE_BASE_NW_01",
];

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function assertProductionPack99Runtime({
  root = process.env.HEXA_WEB_ROOT,
  environment = process.env.NODE_ENV,
  logger = console,
} = {}) {
  if (environment !== "production" || !root) return { required: false };

  const runtimeRoot = resolve(root, "assets/runtime");
  const paths = {
    install: resolve(runtimeRoot, "runtime-install.json"),
    index: resolve(runtimeRoot, "pack99/runtime-index.json"),
    registry: resolve(runtimeRoot, "registry/assets-runtime.json"),
    aliases: resolve(runtimeRoot, "registry/canonical-runtime-aliases.json"),
  };

  for (const [name, path] of Object.entries(paths)) {
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new Error(`PACK99_PRODUCTION_FILE_MISSING:${name}:${path}`);
  }

  const [install, index, registry, aliases] = await Promise.all([
    readJson(paths.install),
    readJson(paths.index),
    readJson(paths.registry),
    readJson(paths.aliases),
  ]);

  if (install.profile !== "full" || install.assetCount !== 1037 || install.unresolvedReferences !== 0) {
    throw new Error("PACK99_PRODUCTION_INSTALL_INVALID");
  }
  if (index.runtimeMode !== "full" || index.canonicalAssetCount !== 1037 || index.fallback !== null) {
    throw new Error("PACK99_PRODUCTION_INDEX_INVALID");
  }
  if (!Array.isArray(index.assets) || index.assets.length < 1850) {
    throw new Error(`PACK99_PRODUCTION_REFERENCES_INVALID:${index.assets?.length ?? 0}`);
  }
  if (!Array.isArray(registry.assets) || registry.assets.length < 1037) {
    throw new Error(`PACK99_PRODUCTION_REGISTRY_INVALID:${registry.assets?.length ?? 0}`);
  }
  for (const id of REQUIRED_ALIASES) {
    if (!aliases.aliases?.[id]) throw new Error(`PACK99_PRODUCTION_ALIAS_MISSING:${id}`);
  }

  const result = {
    required: true,
    profile: install.profile,
    canonicalAssets: index.canonicalAssetCount,
    materializedReferences: index.assets.length,
    aliases: REQUIRED_ALIASES.length,
  };
  logger.info?.("PACK 99 production runtime verified", result);
  return result;
}
