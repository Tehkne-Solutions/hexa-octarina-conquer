import { runtimeAssetUrl } from "./runtime-assets";
import "./strategic-board-canonical-units.css";

export type StrategicAssetKey =
  | "grass"
  | "forest"
  | "water"
  | "pillar"
  | "pillarBlue"
  | "pillarRed"
  | "pillarEnergized"
  | "pillarSelected"
  | "edgePreviewNeSw"
  | "edgePreviewNwSe"
  | "edgeBuiltNeSw"
  | "edgeBuiltNwSe"
  | "kael"
  | "lyra"
  | "varg"
  | "brakk"
  | "bastion"
  | "watchtower"
  | "sanctuary"
  | "ruins"
  | "rocks"
  | "bridge";

export type Pack99StrategicCatalog = Record<StrategicAssetKey, string | null>;

interface CatalogEntry {
  id: string;
  field?: "file" | "spritesheet";
}

export const PACK99_STRATEGIC_ASSETS: Record<StrategicAssetKey, CatalogEntry> = {
  grass: { id: "TILE_GRASS_FLAT_CENTER_A_01" },
  forest: { id: "TILE_FOREST_FLAT_CENTER_A_01" },
  water: { id: "TILE_WATER_FLAT_CENTER_A_01" },

  pillar: { id: "PILLAR_NEUTRAL_01" },
  pillarBlue: { id: "PILLAR_BLUE_01" },
  pillarRed: { id: "PILLAR_RED_01" },
  pillarEnergized: { id: "PILLAR_ENERGIZED_01" },
  pillarSelected: { id: "PILLAR_SELECTED_01" },

  edgePreviewNeSw: { id: "EDGE_STONE_PREVIEW_NE_SW_01" },
  edgePreviewNwSe: { id: "EDGE_STONE_PREVIEW_NW_SE_01" },
  edgeBuiltNeSw: { id: "EDGE_STONE_BUILT_NE_SW_01" },
  edgeBuiltNwSe: { id: "EDGE_STONE_BUILT_NW_SE_01" },

  // Unit visuals are canonical runtime IDs. The runtime alias registry owns the
  // physical path mapping so the gameplay slice never bypasses PACK 99 resolution.
  kael: { id: "HERO_GUARDIAN_01_IDLE_BASE_SW_01" },
  lyra: { id: "HERO_RANGER_01_IDLE_BASE_NE_01" },
  varg: { id: "UNIT_RECRUIT_01_IDLE_BASE_NW_01" },
  brakk: { id: "CHAMP_BERSERKER_01_IDLE_BASE_NW_01" },

  bastion: { id: "TERR_OUTPOST_NEUTRAL_01" },
  watchtower: { id: "TERR_CAMP_NEUTRAL_01" },
  sanctuary: { id: "RES_OCTARINE_CRYSTAL_ABUNDANT_01" },
  ruins: { id: "PROP_RUIN_LARGE_01" },
  rocks: { id: "PROP_ROCK_C_01" },
  bridge: { id: "PROP_STONE_BRIDGE_BUILT_NW_SE_01" },
};

export async function loadPack99StrategicCatalog(): Promise<Pack99StrategicCatalog> {
  const entries = await Promise.all(
    (Object.entries(PACK99_STRATEGIC_ASSETS) as Array<[StrategicAssetKey, CatalogEntry]>).map(async ([key, entry]) => {
      const url = await runtimeAssetUrl(entry.id, entry.field ?? "file");
      return [key, url] as const;
    }),
  );
  return Object.fromEntries(entries) as Pack99StrategicCatalog;
}

export function emptyPack99StrategicCatalog(): Pack99StrategicCatalog {
  return Object.fromEntries(
    Object.keys(PACK99_STRATEGIC_ASSETS).map((key) => [key, null]),
  ) as Pack99StrategicCatalog;
}
