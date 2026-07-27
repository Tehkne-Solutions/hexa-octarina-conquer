export interface Pack99RuntimeAsset {
  id: string;
  category: string;
  sourcePath: string;
  web: string;
  bytes?: number;
}

interface Pack99RuntimeIndex {
  assetCount: number;
  assets: Pack99RuntimeAsset[];
}

const INDEX_URL = "/assets/runtime/pack99/runtime-index.json";
let indexPromise: Promise<Pack99RuntimeIndex> | null = null;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

function scoreAsset(asset: Pack99RuntimeAsset, required: string[], preferred: string[]): number {
  const haystack = normalize(`${asset.id} ${asset.category} ${asset.sourcePath}`);
  if (!required.every((token) => haystack.includes(normalize(token)))) return -1;
  return preferred.reduce((score, token) => score + (haystack.includes(normalize(token)) ? 4 : 0), 0)
    + (haystack.endsWith(".png") ? 2 : 0)
    + (haystack.includes("base") ? 2 : 0)
    + (haystack.includes("idle") ? 2 : 0)
    - (haystack.includes("shadow") ? 5 : 0)
    - (haystack.includes("emissive") ? 5 : 0)
    - (haystack.includes("sheet") ? 3 : 0);
}

export async function loadPack99Index(): Promise<Pack99RuntimeIndex> {
  if (!indexPromise) {
    indexPromise = fetch(INDEX_URL, { cache: "no-cache" }).then(async (response) => {
      if (!response.ok) throw new Error(`PACK99_INDEX_HTTP_${response.status}`);
      const parsed = await response.json() as Pack99RuntimeIndex;
      if (!Array.isArray(parsed.assets)) throw new Error("PACK99_INDEX_INVALID");
      return parsed;
    });
  }
  return indexPromise;
}

export async function resolvePack99Asset(required: string[], preferred: string[] = []): Promise<Pack99RuntimeAsset | null> {
  const index = await loadPack99Index();
  return index.assets
    .map((asset) => ({ asset, score: scoreAsset(asset, required, preferred) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.asset.sourcePath.localeCompare(right.asset.sourcePath))[0]?.asset ?? null;
}

export async function resolvePack99AssetBySuffix(sourceSuffixes: string[]): Promise<Pack99RuntimeAsset | null> {
  const index = await loadPack99Index();
  const suffixes = sourceSuffixes.map(normalize);
  return index.assets.find((asset) => {
    const path = normalize(asset.sourcePath);
    return suffixes.some((suffix) => path.endsWith(suffix));
  }) ?? null;
}

export async function resolvePack99MissionAsset(reference: {
  sourceSuffixes: string[];
  required: string[];
  preferred: string[];
}): Promise<Pack99RuntimeAsset | null> {
  return await resolvePack99AssetBySuffix(reference.sourceSuffixes)
    ?? await resolvePack99Asset(reference.required, reference.preferred);
}

export async function resolvePack99SiblingLayer(
  baseAsset: Pack99RuntimeAsset | null,
  layer: "shadow" | "emissive",
): Promise<Pack99RuntimeAsset | null> {
  if (!baseAsset) return null;
  const index = await loadPack99Index();
  const source = normalize(baseAsset.sourcePath);
  const extensionIndex = source.lastIndexOf(".");
  const stem = extensionIndex >= 0 ? source.slice(0, extensionIndex) : source;
  const extension = extensionIndex >= 0 ? source.slice(extensionIndex) : ".png";
  const candidates = [
    `${stem}_${layer}${extension}`,
    `${stem.replace(/_base$/, "")}_${layer}${extension}`,
    `${stem.replace(/_base_/, `_${layer}_`)}${extension}`,
  ];
  return index.assets.find((asset) => candidates.includes(normalize(asset.sourcePath))) ?? null;
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
