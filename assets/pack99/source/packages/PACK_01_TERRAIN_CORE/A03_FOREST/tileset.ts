// Hexa Octarina Conquer
// Floresta — tileset flat premium 2.5D
// Tehkné Solutions

export const FOREST_TERRAIN_ID = "TERRAIN_FOREST" as const;

export const ForestTiles = {
  center: [
    "TILE_FOREST_FLAT_CENTER_A_01",
    "TILE_FOREST_FLAT_CENTER_B_01",
    "TILE_FOREST_FLAT_CENTER_C_01",
  ],
  edge: {
    N: "TILE_FOREST_FLAT_EDGE_N_01",
    E: "TILE_FOREST_FLAT_EDGE_E_01",
    S: "TILE_FOREST_FLAT_EDGE_S_01",
    W: "TILE_FOREST_FLAT_EDGE_W_01",
  },
  outerCorner: {
    NE: "TILE_FOREST_FLAT_OUTER_NE_01",
    NW: "TILE_FOREST_FLAT_OUTER_NW_01",
    SE: "TILE_FOREST_FLAT_OUTER_SE_01",
    SW: "TILE_FOREST_FLAT_OUTER_SW_01",
  },
  innerCorner: {
    NE: "TILE_FOREST_FLAT_INNER_NE_01",
    NW: "TILE_FOREST_FLAT_INNER_NW_01",
    SE: "TILE_FOREST_FLAT_INNER_SE_01",
    SW: "TILE_FOREST_FLAT_INNER_SW_01",
  },
  isolated: "TILE_FOREST_FLAT_ISOLATED_01",
} as const;
