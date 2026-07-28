import type { LivingTile, LivingUnit } from "./living-board-data";

export interface Pack99MissionAssetRef {
  id: string;
  canonicalId: string;
  sourceSuffixes: string[];
  required: string[];
  preferred: string[];
  forbidden?: string[];
}

export const ASH_BRIDGE_TERRAIN: Record<LivingTile["terrain"], Pack99MissionAssetRef> = {
  grass: {
    id: "terrain.grass.ancestral",
    canonicalId: "TILE_GRASS_FLAT_CENTER_A_01",
    sourceSuffixes: [
      "PACK_01_TERRAIN_CORE/A01_GRASS_ANCESTRAL/tiles/TILE_GRASS_FLAT_CENTER_A_01.png",
      "TILE_GRASS_FLAT_CENTER_A_01.png",
    ],
    required: ["tile", "grass", "flat", "center"],
    preferred: ["ancestral", "a_01"],
  },
  forest: {
    id: "terrain.forest",
    canonicalId: "TILE_FOREST_FLAT_CENTER_A_01",
    sourceSuffixes: ["TILE_FOREST_FLAT_CENTER_A_01.png"],
    required: ["tile", "forest", "flat", "center"],
    preferred: ["a_01"],
  },
  river: {
    id: "terrain.water",
    canonicalId: "TILE_WATER_FLAT_CENTER_A_01",
    sourceSuffixes: ["TILE_WATER_FLAT_CENTER_A_01.png"],
    required: ["tile", "water", "flat", "center"],
    preferred: ["a_01"],
  },
  bridge: {
    id: "landmark.bridge",
    canonicalId: "PROP_STONE_BRIDGE_BUILT_NW_SE_01",
    sourceSuffixes: ["PROP_STONE_BRIDGE_BUILT_NW_SE_01.png", "PROP_BRIDGE_ACTIVE_01.png", "BRIDGE_ACTIVE_01.png"],
    required: ["stone", "bridge", "built"],
    preferred: ["nw", "se", "base", "01"],
  },
  ruins: {
    id: "landmark.observatory",
    canonicalId: "PROP_RUIN_LARGE_01",
    sourceSuffixes: ["PROP_RUIN_LARGE_01.png", "PROP_RUINS_OBSERVATORY_01.png", "RUINS_OBSERVATORY_01.png"],
    required: ["prop", "ruin", "large"],
    preferred: ["base", "01"],
  },
  mill: {
    id: "landmark.mill",
    canonicalId: "TERR_OUTPOST_NEUTRAL_01",
    sourceSuffixes: ["TERR_OUTPOST_NEUTRAL_01.png", "PROP_MILL_ACTIVE_01.png", "MILL_01.png"],
    required: ["territory", "outpost", "neutral"],
    preferred: ["base", "01"],
  },
  village: {
    id: "landmark.village",
    canonicalId: "TERR_CAMP_NEUTRAL_01",
    sourceSuffixes: ["TERR_CAMP_NEUTRAL_01.png", "PROP_VILLAGE_HOUSE_01.png", "VILLAGE_HOUSE_01.png"],
    required: ["territory", "camp", "neutral"],
    preferred: ["base", "01"],
  },
  mountain: {
    id: "terrain.mountain",
    canonicalId: "PROP_ROCK_C_01",
    sourceSuffixes: ["PROP_ROCK_C_01.png", "PROP_MOUNTAIN_01.png", "MOUNTAIN_01.png"],
    required: ["prop", "rock"],
    preferred: ["c", "base", "01"],
  },
};

export const ASH_BRIDGE_RESOURCES: Record<NonNullable<LivingTile["resource"]>, Pack99MissionAssetRef> = {
  wood: {
    id: "resource.wood",
    canonicalId: "RES_WOOD_ABUNDANT_01",
    sourceSuffixes: ["RES_WOOD_ABUNDANT_01.png", "RES_WOOD_NODE_01.png", "RESOURCE_WOOD_01.png"],
    required: ["res", "wood", "abundant"],
    preferred: ["resource", "node", "base", "01"],
  },
  food: {
    id: "resource.food",
    canonicalId: "RES_FOOD_ABUNDANT_01",
    sourceSuffixes: ["RES_FOOD_ABUNDANT_01.png", "RES_FOOD_NODE_01.png", "RESOURCE_FOOD_01.png"],
    required: ["res", "food", "abundant"],
    preferred: ["resource", "node", "base", "01"],
  },
  crystal: {
    id: "resource.octarine",
    canonicalId: "RES_OCTARINE_CRYSTAL_ABUNDANT_01",
    sourceSuffixes: ["RES_OCTARINE_CRYSTAL_ABUNDANT_01.png"],
    required: ["octarine", "crystal"],
    preferred: ["abundant", "base", "01"],
  },
};

export const ASH_BRIDGE_UNITS: Record<LivingUnit["id"], Pack99MissionAssetRef> = {
  kael: {
    id: "unit.kael",
    canonicalId: "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
    sourceSuffixes: ["HERO_GUARDIAN_01_IDLE_BASE_SW_01.png", "HERO_WARRIOR_01_IDLE_BASE_SW_01.png"],
    required: ["hero", "guardian", "idle", "base"],
    preferred: ["sw", "se", "01"],
  },
  lyra: {
    id: "unit.lyra",
    canonicalId: "HERO_RANGER_01_IDLE_BASE_NE_01",
    sourceSuffixes: ["HERO_RANGER_01_IDLE_BASE_NE_01.png"],
    required: ["hero", "ranger", "idle", "base"],
    preferred: ["ne", "se", "01"],
  },
  "raider-bridge": {
    id: "unit.varg.raider-scout",
    canonicalId: "UNIT_RECRUIT_01_IDLE_BASE_NW_01",
    sourceSuffixes: ["UNIT_RECRUIT_01_IDLE_BASE_NW_01.png", "UNIT_SKELETON_01_IDLE_BASE_NW_01.png"],
    required: ["unit", "recruit", "idle", "base"],
    preferred: ["nw", "se", "scout", "light", "01"],
    forbidden: ["orc", "brute", "berserker", "captain", "heavy"],
  },
  "raider-mill": {
    id: "unit.brakk.raider-captain",
    canonicalId: "CHAMP_BERSERKER_01_IDLE_BASE_NW_01",
    sourceSuffixes: ["CHAMP_BERSERKER_01_IDLE_BASE_NW_01.png"],
    required: ["champ", "berserker", "idle", "base"],
    preferred: ["nw", "se", "orc", "brute", "captain", "heavy", "01"],
    forbidden: ["skeleton", "archer", "scout", "light", "recruit"],
  },
};
