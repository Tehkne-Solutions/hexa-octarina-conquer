export interface RuntimeAsset {
  id: string;
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

export type RuntimePackStatus =
  | { state: "loading"; required: boolean }
  | { state: "ready"; required: boolean; profile: "core" | "full"; assetCount: number }
  | { state: "error"; required: boolean; message: string };

const RUNTIME_ROOT = "/assets/runtime";
const REGISTRY_URL = `${RUNTIME_ROOT}/registry/assets-runtime.json`;
const EXPECTED_FULL_ASSETS = 1037;
const STATUS_EVENT = "hexa:pack99-status";
const ALLOW_PROCEDURAL_FALLBACK = import.meta.env.DEV
  && import.meta.env.VITE_HOC_ALLOW_PROCEDURAL_FALLBACK === "1";

let registryPromise: Promise<RuntimeAssetRegistry | null> | null = null;
let assetIndex: Map<string, RuntimeAsset> | null = null;
let currentStatus: RuntimePackStatus = { state: "loading", required: !ALLOW_PROCEDURAL_FALLBACK };

export function runtimeFallbackAllowed(): boolean {
  return ALLOW_PROCEDURAL_FALLBACK;
}

export function runtimePackRequired(): boolean {
  return !ALLOW_PROCEDURAL_FALLBACK;
}

export function runtimePackStatus(): RuntimePackStatus {
  return currentStatus;
}

function publishStatus(status: RuntimePackStatus): void {
  currentStatus = status;
  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent<RuntimePackStatus>(STATUS_EVENT, { detail: status }));
  }
}

export function runtimePackStatusEvent(): string {
  return STATUS_EVENT;
}

function validateRegistry(registry: RuntimeAssetRegistry): RuntimeAssetRegistry {
  if (registry.packId !== "HOC_PACK_99_FINAL_RUNTIME") {
    throw new Error("O registro não pertence ao PACK 99.");
  }
  if (registry.signature !== "Tehkné Solutions") {
    throw new Error("A assinatura institucional do PACK 99 é inválida.");
  }
  if (!Array.isArray(registry.assets)) {
    throw new Error("O registro do PACK 99 não contém uma lista de assets.");
  }
  const ids = registry.assets.map((asset) => asset.id);
  if (ids.some((id) => typeof id !== "string" || !id)) {
    throw new Error("O PACK 99 contém um ID canônico vazio.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("O PACK 99 contém IDs canônicos duplicados.");
  }
  if (registry.unresolved.length > 0) {
    throw new Error(`O PACK 99 contém ${registry.unresolved.length} referência(s) não resolvida(s).`);
  }
  if (runtimePackRequired()) {
    if (registry.profile !== "full") {
      throw new Error(`Produção exige o perfil full; recebido ${registry.profile}.`);
    }
    if (registry.assetCount !== EXPECTED_FULL_ASSETS || registry.assets.length !== EXPECTED_FULL_ASSETS) {
      throw new Error(
        `Produção exige exatamente ${EXPECTED_FULL_ASSETS} IDs; recebido ${registry.assetCount}.`,
      );
    }
  }
  return registry;
}

export async function loadRuntimeAssetRegistry(): Promise<RuntimeAssetRegistry | null> {
  if (!registryPromise) {
    publishStatus({ state: "loading", required: runtimePackRequired() });
    registryPromise = fetch(REGISTRY_URL, { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Registro runtime indisponível (${response.status}).`);
        const registry = validateRegistry(await response.json() as RuntimeAssetRegistry);
        assetIndex = new Map(registry.assets.map((asset) => [asset.id, asset]));
        publishStatus({
          state: "ready",
          required: runtimePackRequired(),
          profile: registry.profile,
          assetCount: registry.assetCount,
        });
        return registry;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Falha desconhecida ao carregar o PACK 99.";
        assetIndex = null;
        publishStatus({ state: "error", required: runtimePackRequired(), message });
        console.error(`[PACK 99] ${message}`);
        return null;
      });
  }
  return registryPromise;
}

export async function getRuntimeAsset(assetId: string): Promise<RuntimeAsset | null> {
  if (!assetIndex) await loadRuntimeAssetRegistry();
  return assetIndex?.get(assetId) ?? null;
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
  publishStatus({ state: "loading", required: runtimePackRequired() });
}
