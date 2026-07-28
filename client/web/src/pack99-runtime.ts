export type Pack99RuntimeLayer =
  | "base"
  | "shadow"
  | "emissive"
  | "faction-mask"
  | "spritesheet"
  | "atlas"
  | "preview";

export interface Pack99RuntimeAsset {
  id: string;
  canonicalId?: string;
  category: string;
  layer?: Pack99RuntimeLayer;
  sourcePath?: string;
  web: string;
  bytes?: number;
}

export type Pack99RuntimeMode = "bootstrap" | "core" | "full";

export interface Pack99RuntimeIndex {
  assetCount: number;
  canonicalAssetCount?: number;
  materializedAssetCount?: number;
  assets: Pack99RuntimeAsset[];
  profile?: string;
  runtimeMode?: Pack99RuntimeMode;
  fallback?: string | null | false;
  version?: string;
  signature?: string;
}

export interface Pack99RuntimeState {
  mode: Pack99RuntimeMode;
  reportedAssetCount: number;
  canonicalAssetCount: number;
  materializedAssetCount: number;
  isFullRuntime: boolean;
  usesFallbacks: boolean;
}

export interface Pack99MissionAssetReference {
  canonicalId?: string;
  sourceSuffixes: string[];
  required: string[];
  preferred: string[];
}

export const PACK99_CORE_MIN_ASSET_COUNT = 597;
export const PACK99_FULL_CANONICAL_ASSET_COUNT = 1037;
export const PACK99_FULL_MIN_ASSET_COUNT = PACK99_FULL_CANONICAL_ASSET_COUNT;
export const PACK99_FULL_MIN_MATERIALIZED_COUNT = 1850;

const INDEX_URL = "/assets/runtime/pack99/runtime-index.json";
let indexPromise: Promise<Pack99RuntimeIndex> | null = null;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

function searchablePath(asset: Pack99RuntimeAsset): string {
  return asset.sourcePath ?? asset.web ?? asset.id;
}

function canonicalId(asset: Pack99RuntimeAsset): string {
  return asset.canonicalId ?? asset.id.replace(/__(?:SHADOW|EMISSIVE|FACTION_MASK|SPRITESHEET|ATLAS|PREVIEW)$/, "");
}

function scoreAsset(asset: Pack99RuntimeAsset, required: string[], preferred: string[]): number {
  const haystack = normalize(`${asset.id} ${asset.canonicalId ?? ""} ${asset.category} ${searchablePath(asset)}`);
  if (!required.every((token) => haystack.includes(normalize(token)))) return -1;
  return preferred.reduce((score, token) => score + (haystack.includes(normalize(token)) ? 4 : 0), 0)
    + (haystack.endsWith(".png") ? 2 : 0)
    + (haystack.includes("base") ? 2 : 0)
    + (haystack.includes("idle") ? 2 : 0)
    - (haystack.includes("shadow") ? 5 : 0)
    - (haystack.includes("emissive") ? 5 : 0)
    - (haystack.includes("sheet") ? 3 : 0);
}

function declaredCanonicalAssetCount(index: Pack99RuntimeIndex): number {
  if (Number.isFinite(index.canonicalAssetCount)) return Number(index.canonicalAssetCount);
  return new Set(index.assets.map(canonicalId)).size;
}

function hasCanonicalFullShape(index: Pack99RuntimeIndex): boolean {
  if ((index.runtimeMode ?? index.profile) !== "full") return false;
  if (index.fallback !== null) return false;
  if (index.assetCount < PACK99_FULL_CANONICAL_ASSET_COUNT) return false;
  if (declaredCanonicalAssetCount(index) < PACK99_FULL_CANONICAL_ASSET_COUNT) return false;
  if (index.assets.length < PACK99_FULL_MIN_MATERIALIZED_COUNT) return false;

  const canonicalIds = new Set<string>();
  for (const asset of index.assets) {
    if (!asset.canonicalId || !asset.sourcePath || !asset.sourcePath.replace(/\\/g, "/").startsWith("packages/")) {
      return false;
    }
    canonicalIds.add(asset.canonicalId);
  }
  return canonicalIds.size >= PACK99_FULL_CANONICAL_ASSET_COUNT;
}

export function inspectPack99RuntimeIndex(index: Pack99RuntimeIndex): Pack99RuntimeState {
  const reportedAssetCount = Number.isFinite(index.assetCount) ? index.assetCount : index.assets.length;
  const canonicalAssetCount = declaredCanonicalAssetCount(index);
  const materializedAssetCount = index.assets.length;
  const declaredMode = index.runtimeMode ?? index.profile;
  const fullByContract = hasCanonicalFullShape(index);
  const coreByCount = reportedAssetCount >= PACK99_CORE_MIN_ASSET_COUNT
    && materializedAssetCount >= PACK99_CORE_MIN_ASSET_COUNT;
  const mode: Pack99RuntimeMode = fullByContract
    ? "full"
    : declaredMode === "core" || coreByCount
      ? "core"
      : "bootstrap";
  return {
    mode,
    reportedAssetCount,
    canonicalAssetCount,
    materializedAssetCount,
    isFullRuntime: fullByContract,
    usesFallbacks: !fullByContract,
  };
}

export async function loadPack99Index(): Promise<Pack99RuntimeIndex> {
  if (!indexPromise) {
    indexPromise = fetch(INDEX_URL, { cache: "no-cache" }).then(async (response) => {
      if (!response.ok) throw new Error(`PACK99_INDEX_HTTP_${response.status}`);
      const parsed = await response.json() as Pack99RuntimeIndex;
      if (!Array.isArray(parsed.assets) || parsed.assets.length === 0) throw new Error("PACK99_INDEX_INVALID");
      if (parsed.assets.some((asset) => !asset.id || !asset.category || !asset.web)) {
        throw new Error("PACK99_INDEX_ASSET_INVALID");
      }
      return parsed;
    });
  }
  return indexPromise;
}

export async function loadPack99RuntimeState(): Promise<Pack99RuntimeState> {
  return inspectPack99RuntimeIndex(await loadPack99Index());
}

export function findPack99CanonicalAsset(
  index: Pack99RuntimeIndex,
  requestedCanonicalId: string,
  layer: Pack99RuntimeLayer = "base",
): Pack99RuntimeAsset | null {
  const matches = index.assets.filter((asset) => canonicalId(asset) === requestedCanonicalId);
  if (layer === "base") {
    return matches.find((asset) => asset.layer === "base")
      ?? matches.find((asset) => asset.id === requestedCanonicalId)
      ?? matches.find((asset) => !asset.layer)
      ?? null;
  }
  const layerSuffix = layer.toUpperCase().replace(/-/g, "_");
  return matches.find((asset) => asset.layer === layer)
    ?? matches.find((asset) => asset.id === `${requestedCanonicalId}__${layerSuffix}`)
    ?? null;
}

function findPack99AssetBySuffix(index: Pack99RuntimeIndex, sourceSuffixes: string[]): Pack99RuntimeAsset | null {
  const suffixes = sourceSuffixes.map(normalize);
  return index.assets.find((asset) => {
    const path = normalize(searchablePath(asset));
    return suffixes.some((suffix) => path.endsWith(suffix));
  }) ?? null;
}

function findPack99Asset(index: Pack99RuntimeIndex, required: string[], preferred: string[]): Pack99RuntimeAsset | null {
  return index.assets
    .map((asset) => ({ asset, score: scoreAsset(asset, required, preferred) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || searchablePath(left.asset).localeCompare(searchablePath(right.asset)))[0]?.asset ?? null;
}

export async function resolvePack99Asset(required: string[], preferred: string[] = []): Promise<Pack99RuntimeAsset | null> {
  return findPack99Asset(await loadPack99Index(), required, preferred);
}

export async function resolvePack99AssetBySuffix(sourceSuffixes: string[]): Promise<Pack99RuntimeAsset | null> {
  return findPack99AssetBySuffix(await loadPack99Index(), sourceSuffixes);
}

export async function resolvePack99MissionAsset(reference: Pack99MissionAssetReference): Promise<Pack99RuntimeAsset | null> {
  const index = await loadPack99Index();
  const state = inspectPack99RuntimeIndex(index);
  if (state.isFullRuntime) {
    return reference.canonicalId ? findPack99CanonicalAsset(index, reference.canonicalId, "base") : null;
  }
  return findPack99AssetBySuffix(index, reference.sourceSuffixes)
    ?? findPack99Asset(index, reference.required, reference.preferred);
}

export async function resolvePack99SiblingLayer(
  baseAsset: Pack99RuntimeAsset | null,
  layer: "shadow" | "emissive",
): Promise<Pack99RuntimeAsset | null> {
  if (!baseAsset) return null;
  const index = await loadPack99Index();
  if (inspectPack99RuntimeIndex(index).isFullRuntime) {
    return findPack99CanonicalAsset(index, canonicalId(baseAsset), layer);
  }
  const source = normalize(searchablePath(baseAsset));
  const extensionIndex = source.lastIndexOf(".");
  const stem = extensionIndex >= 0 ? source.slice(0, extensionIndex) : source;
  const extension = extensionIndex >= 0 ? source.slice(extensionIndex) : ".png";
  const candidates = [
    `${stem}_${layer}${extension}`,
    `${stem.replace(/_base$/, "")}_${layer}${extension}`,
    `${stem.replace(/_base_/, `_${layer}_`)}${extension}`,
  ];
  return index.assets.find((asset) => candidates.includes(normalize(searchablePath(asset)))) ?? null;
}

export function pack99PublicUrl(asset: Pack99RuntimeAsset | null): string | null {
  if (!asset) return null;
  const marker = "client/web/public";
  const normalized = asset.web.replace(/\\/g, "/");
  const markerIndex = normalized.indexOf(marker);
  return markerIndex >= 0 ? normalized.slice(markerIndex + marker.length) : `/${normalized.replace(/^\/+/, "")}`;
}

export async function resolvePack99Layer(
  required: string[],
  layer: "base" | "shadow" | "emissive",
  preferred: string[] = [],
): Promise<string | null> {
  const layerRequired = layer === "base" ? required : [...required, layer];
  const asset = await resolvePack99Asset(layerRequired, layer === "base" ? [...preferred, "base"] : preferred);
  return pack99PublicUrl(asset);
}
