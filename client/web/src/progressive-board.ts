export type ProgressiveBoardCategory = "board-node" | "board-edge" | "territory-structure";

export interface ProgressiveBoardAsset {
  id: string;
  category: ProgressiveBoardCategory;
  state: string;
  material?: string;
  orientation?: "NE_SW" | "NW_SE";
  stage?: number;
  anchor: [number, number];
  renderLayer: number;
  _runtimeFile?: string;
  _runtimeShadow?: string;
  _runtimeEmissive?: string;
}

export interface ProgressiveBoardRegistry {
  project: "Hexa Octarina Conquer";
  packId: "HOC_PACK_02_BOARD_SYSTEM_FINAL";
  canonicalPackId: "HOC_PACK_02_BOARD_SYSTEM";
  namespace: "PACK_02_BOARD_SYSTEM";
  version: "1.1.0";
  status: "installed-progressive";
  assetCount: 55;
  assets: ProgressiveBoardAsset[];
  unresolved: [];
  runtime: {
    masterCanvasPx: [1024, 1024];
    colorMode: "RGBA";
    anchors: Record<ProgressiveBoardCategory, [number, number]>;
    renderOrder: Record<string, number>;
  };
  signature: "Tehkné Solutions";
}

const BOARD_ROOT = "/assets/progressive/PACK_02_BOARD_SYSTEM";
const REGISTRY_URL = `${BOARD_ROOT}/registry/board-runtime.json`;
const EXPECTED_ASSETS = 55;

let registryPromise: Promise<ProgressiveBoardRegistry | null> | null = null;
let assetsById: Map<string, ProgressiveBoardAsset> | null = null;

function validateRegistry(value: unknown): ProgressiveBoardRegistry {
  const registry = value as ProgressiveBoardRegistry;
  if (registry?.packId !== "HOC_PACK_02_BOARD_SYSTEM_FINAL") throw new Error("Registro não pertence ao PACK 02.");
  if (registry.canonicalPackId !== "HOC_PACK_02_BOARD_SYSTEM") throw new Error("Identidade canônica do PACK 02 inválida.");
  if (registry.signature !== "Tehkné Solutions") throw new Error("Assinatura do PACK 02 inválida.");
  if (registry.version !== "1.1.0" || registry.status !== "installed-progressive") {
    throw new Error("PACK 02 não está na versão progressiva validada.");
  }
  if (!Array.isArray(registry.assets) || registry.assetCount !== EXPECTED_ASSETS || registry.assets.length !== EXPECTED_ASSETS) {
    throw new Error(`PACK 02 exige exatamente ${EXPECTED_ASSETS} assets.`);
  }
  if (!Array.isArray(registry.unresolved) || registry.unresolved.length !== 0) {
    throw new Error("PACK 02 contém referências não resolvidas.");
  }
  const ids = registry.assets.map((asset) => asset.id);
  if (ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== EXPECTED_ASSETS) {
    throw new Error("PACK 02 contém IDs vazios ou duplicados.");
  }
  const counts = registry.assets.reduce<Record<string, number>>((accumulator, asset) => {
    accumulator[asset.category] = (accumulator[asset.category] ?? 0) + 1;
    return accumulator;
  }, {});
  if (counts["board-node"] !== 6 || counts["board-edge"] !== 24 || counts["territory-structure"] !== 25) {
    throw new Error("Subpacks do PACK 02 possuem contagem inválida.");
  }
  return registry;
}

export async function loadProgressiveBoardRegistry(): Promise<ProgressiveBoardRegistry | null> {
  if (!registryPromise) {
    registryPromise = fetch(REGISTRY_URL, { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) return null;
        const registry = validateRegistry(await response.json());
        assetsById = new Map(registry.assets.map((asset) => [asset.id, asset]));
        return registry;
      })
      .catch(() => null);
  }
  return registryPromise;
}

export function resetProgressiveBoardRegistryForTests(): void {
  registryPromise = null;
  assetsById = null;
}

export function progressiveBoardAsset(assetId: string): ProgressiveBoardAsset | null {
  return assetsById?.get(assetId) ?? null;
}

export function progressiveBoardAssetUrl(assetId: string, field: "file" | "shadow" | "emissive" = "file"): string | null {
  const asset = progressiveBoardAsset(assetId);
  const relative = field === "file"
    ? asset?._runtimeFile
    : field === "shadow"
      ? asset?._runtimeShadow
      : asset?._runtimeEmissive;
  return relative ? `${BOARD_ROOT}/${relative}` : null;
}

export function progressivePillarAssetId(options: {
  selected: boolean;
  valid: boolean;
  recommended: boolean;
  disabled: boolean;
  faction?: "player" | "enemy";
}): string {
  if (options.disabled) return "PILLAR_BLOCKED_01";
  if (options.selected) return "PILLAR_SELECTED_01";
  if (options.recommended || options.valid) return "PILLAR_ENERGIZED_01";
  if (options.faction === "player") return "PILLAR_BLUE_01";
  if (options.faction === "enemy") return "PILLAR_RED_01";
  return "PILLAR_NEUTRAL_01";
}

export function progressiveEdgeAssetId(
  owner: "player" | "enemy" | "contested",
  start: { x: number; y: number },
  end: { x: number; y: number },
): string {
  const material = owner === "player" ? "ARCANE" : owner === "enemy" ? "STONE" : "WOOD";
  const orientation = start.x !== end.x ? "NW_SE" : "NE_SW";
  return `EDGE_${material}_BUILT_${orientation}_01`;
}

const TERRITORY_LINEAGE = ["SIGIL", "CAMP", "OUTPOST", "FORT", "CITADEL"] as const;

export function progressiveTerritoryAssetId(stage: number, owner: "player" | "enemy"): string {
  const normalizedStage = Math.max(1, Math.min(5, Math.trunc(stage)));
  const base = TERRITORY_LINEAGE[normalizedStage - 1];
  const state = owner === "player" ? "BLUE" : "RED";
  return `TERR_${base}_${state}_01`;
}
