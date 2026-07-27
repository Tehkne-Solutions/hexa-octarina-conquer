// Hexa Octarina Conquer
// Lava — tileset flat premium 2.5D
// Tehkné Solutions

export const LAVA_TERRAIN_ID = "TERRAIN_LAVA" as const;

export const LavaTiles = {
  center: [
    "TILE_LAVA_FLAT_CENTER_A_01",
    "TILE_LAVA_FLAT_CENTER_B_01",
    "TILE_LAVA_FLAT_CENTER_C_01",
  ],
  edge: {
    N: "TILE_LAVA_FLAT_EDGE_N_01",
    E: "TILE_LAVA_FLAT_EDGE_E_01",
    S: "TILE_LAVA_FLAT_EDGE_S_01",
    W: "TILE_LAVA_FLAT_EDGE_W_01",
  },
  outerCorner: {
    NE: "TILE_LAVA_FLAT_OUTER_NE_01",
    NW: "TILE_LAVA_FLAT_OUTER_NW_01",
    SE: "TILE_LAVA_FLAT_OUTER_SE_01",
    SW: "TILE_LAVA_FLAT_OUTER_SW_01",
  },
  innerCorner: {
    NE: "TILE_LAVA_FLAT_INNER_NE_01",
    NW: "TILE_LAVA_FLAT_INNER_NW_01",
    SE: "TILE_LAVA_FLAT_INNER_SE_01",
    SW: "TILE_LAVA_FLAT_INNER_SW_01",
  },
  isolated: "TILE_LAVA_FLAT_ISOLATED_01",
} as const;
