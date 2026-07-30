import { runtimeAssetUrl } from "./runtime-assets";

export type StrategicAssetKey =
  | "grass"
  | "forest"
  | "water"
  | "edgeNeSw"
  | "edgeNwSe"
  | "pillar"
  | "pillarSelected"
  | "kael"
  | "lyra"
  | "varg"
  | "brakk"
  | "bastion"
  | "watchtower"
  | "sanctuary"
  | "ruins"
  | "cellValid"
  | "cellSelected"
  | "combatSlash";

export type Pack99StrategicCatalog = Record<StrategicAssetKey, string | null>;

interface CatalogEntry {
  id: string;
  field?: "file" | "spritesheet";
}

export const PACK99_STRATEGIC_ASSETS: Record<StrategicAssetKey, CatalogEntry> = {
  grass: { id: "TILE_GRASS_FLAT_CENTER_A_01" },
  forest: { id: "TILE_FOREST_FLAT_CENTER_A_01" },
  water: { id: "TILE_WATER_FLAT_CENTER_A_01" },
  edgeNeSw: { id: "EDGE_ARCANE_BUILT_NE_SW_01" },
  edgeNwSe: { id: "EDGE_ARCANE_BUILT_NW_SE_01" },
  pillar: { id: "PILLAR_NEUTRAL_01" },
  pillarSelected: { id: "PILLAR_SELECTED_01" },
  kael: { id: "HERO_GUARDIAN_01_IDLE_SE_01", field: "spritesheet" },
  lyra: { id: "HERO_RANGER_01_IDLE_SE_01", field: "spritesheet" },
  varg: { id: "UNIT_RECRUIT_01_IDLE_SE_01", field: "spritesheet" },
  brakk: { id: "CHAMP_BERSERKER_01_IDLE_SE_01", field: "spritesheet" },
  bastion: { id: "TERR_OUTPOST_NEUTRAL_01" },
  watchtower: { id: "TERR_CAMP_NEUTRAL_01" },
  sanctuary: { id: "RES_OCTARINE_CRYSTAL_ABUNDANT_01" },
  ruins: { id: "PROP_RUIN_LARGE_01" },
  cellValid: { id: "VFX_CELL_VALID_01" },
  cellSelected: { id: "VFX_CELL_SELECTED_01" },
  combatSlash: { id: "VFX_COMBAT_SLASH_01" },
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
  return Object.fromEntries(Object.keys(PACK99_STRATEGIC_ASSETS).map((key) => [key, null])) as Pack99StrategicCatalog;
}
