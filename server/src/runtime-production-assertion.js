import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const REQUIRED_MISSION_FILES = [
  "packages/PACK_07_HERO_ROSTER/guardian/directions/HERO_GUARDIAN_01_IDLE_BASE_SW_01.png",
  "packages/PACK_07_HERO_ROSTER/ranger/directions/HERO_RANGER_01_IDLE_BASE_NE_01.png",
  "packages/PACK_08_BASIC_UNITS/recruit/directions/UNIT_RECRUIT_01_IDLE_BASE_NW_01.png",
  "packages/PACK_09_CHAMPIONS_ADVANCED/berserker/directions/CHAMP_BERSERKER_01_IDLE_BASE_NW_01.png",
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
    manifest: resolve(runtimeRoot, "pack-manifest.json"),
    registry: resolve(runtimeRoot, "registry/assets-runtime.json"),
  };

  for (const [name, path] of Object.entries(paths)) {
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new Error(`PACK99_PRODUCTION_FILE_MISSING:${name}:${path}`);
  }

  const [install, manifest, registry] = await Promise.all([
    readJson(paths.install),
    readJson(paths.manifest),
    readJson(paths.registry),
  ]);

  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const unresolved = Array.isArray(registry.unresolved) ? registry.unresolved : [];

  if (install.packId !== "HOC_PACK_99_FINAL_RUNTIME" || install.profile !== "full" || install.assetCount !== 1037 || install.unresolvedReferences !== 0) {
    throw new Error("PACK99_PRODUCTION_INSTALL_INVALID");
  }
  if (registry.packId !== install.packId || registry.profile !== "full" || registry.assetCount !== 1037 || assets.length !== 1037) {
    throw new Error(`PACK99_PRODUCTION_REGISTRY_INVALID:${assets.length}`);
  }
  if (unresolved.length !== 0) {
    throw new Error(`PACK99_PRODUCTION_UNRESOLVED:${unresolved.length}`);
  }
  if (!manifest.version) throw new Error("PACK99_PRODUCTION_MANIFEST_INVALID");

  for (const relative of REQUIRED_MISSION_FILES) {
    const info = await stat(resolve(runtimeRoot, ...relative.split("/"))).catch(() => null);
    if (!info?.isFile()) throw new Error(`PACK99_PRODUCTION_MISSION_FILE_MISSING:${relative}`);
  }

  const result = {
    required: true,
    profile: install.profile,
    canonicalAssets: assets.length,
    materializedAssets: assets.length,
    missionFiles: REQUIRED_MISSION_FILES.length,
  };
  logger.info?.("PACK 99 production runtime verified", result);
  return result;
}
