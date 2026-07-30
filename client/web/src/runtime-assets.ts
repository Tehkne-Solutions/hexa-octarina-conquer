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

const RUNTIME_ROOT = "/assets/runtime";
const REGISTRY_URL = `${RUNTIME_ROOT}/registry/assets-runtime.json`;

let registryPromise: Promise<RuntimeAssetRegistry | null> | null = null;
let assetIndex: Map<string, RuntimeAsset> | null = null;

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

export async function runtimeAssetUrl(
  assetId: string,
  field: "file" | "shadow" | "emissive" | "factionMask" | "spritesheet" = "file",
): Promise<string | null> {
  const asset = await getRuntimeAsset(assetId);
  if (!asset) return null;

  const runtimeKey = `_runtime${field[0].toUpperCase()}${field.slice(1)}`;
  const relativePath = asset[runtimeKey];
  return typeof relativePath === "string"
    ? `${RUNTIME_ROOT}/${relativePath}`
    : null;
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
  assetIndex = null;
}
