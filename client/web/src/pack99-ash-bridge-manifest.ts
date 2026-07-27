import type { LivingTile, LivingUnit } from "./living-board-data";

export interface Pack99MissionAssetRef {
  id: string;
  sourceSuffixes: string[];
  required: string[];
  preferred: string[];
}

export const ASH_BRIDGE_TERRAIN: Record<LivingTile["terrain"], Pack99MissionAssetRef> = {
  grass: {
    id: "terrain.grass.ancestral",
    sourceSuffixes: [
      "PACK_01_TERRAIN_CORE/A01_GRASS_ANCESTRAL/tiles/TILE_GRASS_FLAT_CENTER_A_01.png",
      "TILE_GRASS_FLAT_CENTER_A_01.png",
    ],
    required: ["tile", "grass", "flat", "center"],
    preferred: ["ancestral", "a_01"],
  },
  forest: {
    id: "terrain.forest",
    sourceSuffixes: ["TILE_FOREST_FLAT_CENTER_A_01.png"],
    required: ["tile", "forest", "flat", "center"],
    preferred: ["a_01"],
  },
  river: {
    id: "terrain.water",
    sourceSuffixes: ["TILE_WATER_FLAT_CENTER_A_01.png"],
    required: ["tile", "water", "flat", "center"],
    preferred: ["a_01"],
  },
  bridge: {
    id: "landmark.bridge",
    sourceSuffixes: ["PROP_BRIDGE_ACTIVE_01.png", "BRIDGE_ACTIVE_01.png"],
    required: ["bridge"],
    preferred: ["active", "base", "01"],
  },
  ruins: {
    id: "landmark.observatory",
    sourceSuffixes: ["PROP_RUINS_OBSERVATORY_01.png", "RUINS_OBSERVATORY_01.png"],
    required: ["ruin"],
    preferred: ["observatory", "base", "01"],
  },
  mill: {
    id: "landmark.mill",
    sourceSuffixes: ["PROP_MILL_ACTIVE_01.png", "MILL_01.png"],
    required: ["mill"],
    preferred: ["active", "base", "01"],
  },
  village: {
    id: "landmark.village",
    sourceSuffixes: ["PROP_VILLAGE_HOUSE_01.png", "VILLAGE_HOUSE_01.png"],
    required: ["village"],
    preferred: ["house", "base", "01"],
  },
  mountain: {
    id: "terrain.mountain",
    sourceSuffixes: ["PROP_MOUNTAIN_01.png", "MOUNTAIN_01.png"],
    required: ["mountain"],
    preferred: ["base", "01"],
  },
};

export const ASH_BRIDGE_RESOURCES: Record<NonNullable<LivingTile["resource"]>, Pack99MissionAssetRef> = {
  wood: {
    id: "resource.wood",
    sourceSuffixes: ["RES_WOOD_NODE_01.png", "RESOURCE_WOOD_01.png"],
    required: ["wood"],
    preferred: ["resource", "node", "base", "01"],
  },
  food: {
    id: "resource.food",
    sourceSuffixes: ["RES_FOOD_NODE_01.png", "RESOURCE_FOOD_01.png"],
    required: ["food"],
    preferred: ["resource", "node", "base", "01"],
  },
  crystal: {
    id: "resource.octarine",
    sourceSuffixes: ["RES_OCTARINE_CRYSTAL_ABUNDANT_01.png"],
    required: ["octarine", "crystal"],
    preferred: ["abundant", "base", "01"],
  },
};

export const ASH_BRIDGE_UNITS: Record<LivingUnit["id"], Pack99MissionAssetRef> = {
  kael: {
    id: "unit.kael",
    sourceSuffixes: ["HERO_WARRIOR_01_IDLE_BASE_SW_01.png"],
    required: ["hero", "warrior", "idle"],
    preferred: ["base", "sw", "01"],
  },
  lyra: {
    id: "unit.lyra",
    sourceSuffixes: ["HERO_RANGER_01_IDLE_BASE_NE_01.png"],
    required: ["hero", "ranger", "idle"],
    preferred: ["base", "ne", "01"],
  },
  "raider-bridge": {
    id: "unit.varg",
    sourceSuffixes: ["UNIT_SKELETON_01_IDLE_BASE_NW_01.png"],
    required: ["unit", "skeleton", "idle"],
    preferred: ["base", "nw", "01"],
  },
  "raider-mill": {
    id: "unit.brakk",
    sourceSuffixes: ["UNIT_SKELETON_01_IDLE_BASE_NW_01.png"],
    required: ["unit", "skeleton", "idle"],
    preferred: ["base", "nw", "01"],
  },
};
