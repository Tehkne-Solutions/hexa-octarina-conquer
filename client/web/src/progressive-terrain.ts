import type { Terrain } from "./living-board-data";
import type { BoardThemeId } from "./board-theme";

export interface ProgressiveTerrainAsset {
  id: string;
  terrainId?: string;
  topology?: string;
  variation?: string;
  _runtimeFile?: string;
  _runtimeMask?: string;
}

export interface ProgressiveTerrainRegistry {
  project: "Hexa Octarina Conquer";
  packId: "HOC_PACK_01_TERRAIN_CORE_FINAL";
  canonicalPackId: "HOC_PACK_01_TERRAIN_CORE";
  namespace: "PACK_01_TERRAIN_CORE";
  version: "1.1.0";
  status: "installed-progressive";
  assetCount: 103;
  assets: ProgressiveTerrainAsset[];
  unresolved: [];
  runtime: {
    masterCanvasPx: [1024, 512];
    displayTilePx: [512, 256];
    gridStepPx: [252, 124];
    edgeBleedPx: 8;
  };
  signature: "Tehkné Solutions";
}

const TERRAIN_ROOT = "/assets/progressive/PACK_01_TERRAIN_CORE";
const REGISTRY_URL = `${TERRAIN_ROOT}/registry/terrain-runtime.json`;
const EXPECTED_ASSETS = 103;

let registryPromise: Promise<ProgressiveTerrainRegistry | null> | null = null;
let assetsById: Map<string, ProgressiveTerrainAsset> | null = null;

function validateRegistry(value: unknown): ProgressiveTerrainRegistry {
  const registry = value as ProgressiveTerrainRegistry;
  if (registry?.packId !== "HOC_PACK_01_TERRAIN_CORE_FINAL") throw new Error("Registro não pertence ao PACK 01.");
  if (registry.signature !== "Tehkné Solutions") throw new Error("Assinatura do PACK 01 inválida.");
  if (registry.version !== "1.1.0" || registry.status !== "installed-progressive") throw new Error("Versão do PACK 01 não promovida para staging.");
  if (!Array.isArray(registry.assets) || registry.assetCount !== EXPECTED_ASSETS || registry.assets.length !== EXPECTED_ASSETS) {
    throw new Error(`PACK 01 exige exatamente ${EXPECTED_ASSETS} assets.`);
  }
  if (!Array.isArray(registry.unresolved) || registry.unresolved.length !== 0) throw new Error("PACK 01 contém referências não resolvidas.");
  const ids = registry.assets.map((asset) => asset.id);
  if (ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== EXPECTED_ASSETS) {
    throw new Error("PACK 01 contém IDs vazios ou duplicados.");
  }
  if (registry.runtime.edgeBleedPx !== 8 || registry.runtime.gridStepPx[0] !== 252 || registry.runtime.gridStepPx[1] !== 124) {
    throw new Error("Contrato de montagem do PACK 01 diverge do gate validado.");
  }
  return registry;
}

export async function loadProgressiveTerrainRegistry(): Promise<ProgressiveTerrainRegistry | null> {
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

export function resetProgressiveTerrainRegistryForTests(): void {
  registryPromise = null;
  assetsById = null;
}

export function progressiveTerrainAssetUrl(assetId: string): string | null {
  const relative = assetsById?.get(assetId)?._runtimeFile;
  return relative ? `${TERRAIN_ROOT}/${relative}` : null;
}

function terrainPrefix(theme: BoardThemeId, terrain: Terrain): string {
  if (terrain === "river") return "WATER";
  if (terrain === "forest") return "FOREST";
  if (terrain === "ruins") return "RUNIC";
  if (terrain === "mountain") return theme === "ash-fortress" ? "LAVA" : "CORRUPTED";
  if (theme === "prismatic-ruins") return "RUNIC";
  if (theme === "ash-fortress") return terrain === "bridge" ? "CORRUPTED" : "LAVA";
  return "GRASS";
}

export function progressiveTerrainCenterAssetId(
  theme: BoardThemeId,
  terrain: Terrain,
  x: number,
  y: number,
): string {
  const variation = ["A", "B", "C"][Math.abs(x * 3 + y * 5) % 3];
  return `TILE_${terrainPrefix(theme, terrain)}_FLAT_CENTER_${variation}_01`;
}
