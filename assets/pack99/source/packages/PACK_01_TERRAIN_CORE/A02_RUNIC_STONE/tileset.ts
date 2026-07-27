// Hexa Octarina Conquer
// Pedra Rúnica — tileset flat premium 2.5D
// Tehkné Solutions

export const RUNIC_TERRAIN_ID = "TERRAIN_RUNIC_STONE" as const;

export const RunicTiles = {
  center: [
    "TILE_RUNIC_FLAT_CENTER_A_01",
    "TILE_RUNIC_FLAT_CENTER_B_01",
    "TILE_RUNIC_FLAT_CENTER_C_01",
  ],
  edge: {
    N: "TILE_RUNIC_FLAT_EDGE_N_01",
    E: "TILE_RUNIC_FLAT_EDGE_E_01",
    S: "TILE_RUNIC_FLAT_EDGE_S_01",
    W: "TILE_RUNIC_FLAT_EDGE_W_01",
  },
  outerCorner: {
    NE: "TILE_RUNIC_FLAT_OUTER_NE_01",
    NW: "TILE_RUNIC_FLAT_OUTER_NW_01",
    SE: "TILE_RUNIC_FLAT_OUTER_SE_01",
    SW: "TILE_RUNIC_FLAT_OUTER_SW_01",
  },
  innerCorner: {
    NE: "TILE_RUNIC_FLAT_INNER_NE_01",
    NW: "TILE_RUNIC_FLAT_INNER_NW_01",
    SE: "TILE_RUNIC_FLAT_INNER_SE_01",
    SW: "TILE_RUNIC_FLAT_INNER_SW_01",
  },
  isolated: "TILE_RUNIC_FLAT_ISOLATED_01",
} as const;
