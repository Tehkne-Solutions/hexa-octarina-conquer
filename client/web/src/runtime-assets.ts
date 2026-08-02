export interface RuntimeAsset {
  id: string;
  canonicalId?: string;
  category?: string;
  file?: string;
  _runtimeFile?: string;
  _runtimeShadow?: string;
  _runtimeEmissive?: string;
  _runtimeFactionMask?: string;
  _runtimeSpritesheet?: string;
  _runtimeAtlas?: string;
  [key: string]: unknown;
}

export interface RuntimeAssetRegistry {
  project: string;
  packId: "HOC_PACK_99_FINAL_RUNTIME";
  version: string;
  profile: "core" | "full";
  assetCount: number;
  assets: RuntimeAsset[];
  unresolved: Array<{ assetId: string; field: string; value: string }>;
  signature: "Tehkné Solutions";
}

interface RuntimeAliasRegistry {
  packId: "HOC_PACK_99_FINAL_RUNTIME";
  version: string;
  aliases: Record<string, string>;
}

const RUNTIME_ROOT = "/assets/runtime";
const REGISTRY_URL = `${RUNTIME_ROOT}/registry/assets-runtime.json`;
const ALIAS_REGISTRY_URL = `${RUNTIME_ROOT}/registry/canonical-runtime-aliases.json`;
const BOOTSTRAP_ALIAS_REGISTRY_URL = "/canonical-runtime-aliases.json";

let registryPromise: Promise<RuntimeAssetRegistry | null> | null = null;
let aliasPromise: Promise<RuntimeAliasRegistry | null> | null = null;
let assetIndex: Map<string, RuntimeAsset> | null = null;
let aliasIndex: Map<string, string> | null = null;

function normalizeAssetKey(value: string): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)!
    .replace(/\.[^.]+$/, "")
    .toUpperCase();
}

function indexAsset(index: Map<string, RuntimeAsset>, key: unknown, asset: RuntimeAsset): void {
  if (typeof key !== "string" || key.length === 0) return;
  index.set(key, asset);
  index.set(key.toUpperCase(), asset);
  index.set(normalizeAssetKey(key), asset);
}

async function fetchRuntimeAliasRegistry(url: string): Promise<RuntimeAliasRegistry | null> {
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) return null;
    const registry = await response.json() as RuntimeAliasRegistry;
    return registry.packId === "HOC_PACK_99_FINAL_RUNTIME" ? registry : null;
  } catch {
    return null;
  }
}

function indexRuntimeAliases(registry: RuntimeAliasRegistry): void {
  aliasIndex = new Map<string, string>();
  for (const [assetId, relativePath] of Object.entries(registry.aliases ?? {})) {
    if (typeof relativePath !== "string" || relativePath.length === 0) continue;
    aliasIndex.set(assetId, relativePath);
    aliasIndex.set(assetId.toUpperCase(), relativePath);
    aliasIndex.set(normalizeAssetKey(assetId), relativePath);
  }
}

async function loadRuntimeAliasRegistry(): Promise<RuntimeAliasRegistry | null> {
  if (!aliasPromise) {
    aliasPromise = (async () => {
      const registry = await fetchRuntimeAliasRegistry(ALIAS_REGISTRY_URL)
        ?? await fetchRuntimeAliasRegistry(BOOTSTRAP_ALIAS_REGISTRY_URL);
      if (!registry) return null;
      indexRuntimeAliases(registry);
      return registry;
    })();
  }
  return aliasPromise;
}

export async function loadRuntimeAssetRegistry(): Promise<RuntimeAssetRegistry | null> {
  if (!registryPromise) {
    registryPromise = fetch(REGISTRY_URL, { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) return null;
        const registry = await response.json() as RuntimeAssetRegistry;
        if (registry.packId !== "HOC_PACK_99_FINAL_RUNTIME") return null;
        const index = new Map<string, RuntimeAsset>();
        for (const asset of registry.assets) {
          indexAsset(index, asset.id, asset);
          indexAsset(index, asset.canonicalId, asset);
          indexAsset(index, asset.file, asset);
          indexAsset(index, asset._runtimeFile, asset);
        }
        assetIndex = index;
        await loadRuntimeAliasRegistry();
        return registry;
      })
      .catch(() => null);
  }
  return registryPromise;
}

export async function getRuntimeAsset(assetId: string): Promise<RuntimeAsset | null> {
  if (!assetIndex) await loadRuntimeAssetRegistry();
  return assetIndex?.get(assetId) ?? assetIndex?.get(assetId.toUpperCase()) ?? assetIndex?.get(normalizeAssetKey(assetId)) ?? null;
}

function getRuntimeAlias(assetId: string): string | null {
  return aliasIndex?.get(assetId) ?? aliasIndex?.get(assetId.toUpperCase()) ?? aliasIndex?.get(normalizeAssetKey(assetId)) ?? null;
}

export async function runtimeAssetUrl(
  assetId: string,
  field: "file" | "shadow" | "emissive" | "factionMask" | "spritesheet" = "file",
): Promise<string | null> {
  const asset = await getRuntimeAsset(assetId);
  if (asset) {
    const runtimeKey = `_runtime${field[0].toUpperCase()}${field.slice(1)}`;
    const relativePath = asset[runtimeKey];
    if (typeof relativePath === "string") return `${RUNTIME_ROOT}/${relativePath}`;
  }

  if (!aliasIndex) await loadRuntimeAliasRegistry();
  const aliasPath = field === "file" ? getRuntimeAlias(assetId) : null;
  return aliasPath ? `${RUNTIME_ROOT}/${aliasPath}` : null;
}

export async function preloadRuntimeAssets(assetIds: readonly string[]): Promise<void> {
  const urls = await Promise.all(assetIds.map((assetId) => runtimeAssetUrl(assetId)));
  await Promise.all(urls.filter((url): url is string => Boolean(url)).map((url) => new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  })));
}

export function resetRuntimeAssetCache(): void {
  registryPromise = null;
  aliasPromise = null;
  assetIndex = null;
  aliasIndex = null;
}
