// Hexa Octarina Conquer — Props & Obstacles
// Tehkné Solutions

export const PropFamilies = {
  natural: [
    "PROP_TREE_GREEN_A_01",
    "PROP_TREE_GREEN_B_01",
    "PROP_TREE_GREEN_C_01",
    "PROP_TREE_DEAD_01",
    "PROP_TREE_CORRUPTED_01",
    "PROP_ROCK_A_01",
    "PROP_ROCK_B_01",
    "PROP_ROCK_C_01",
  ],
  portals: [
    "PROP_PORTAL_ACTIVE_01",
    "PROP_PORTAL_INACTIVE_01",
    "PROP_PORTAL_CORRUPTED_01",
  ],
  hazards: [
    "PROP_LAVA_FISSURE_ACTIVE_01",
    "PROP_LAVA_FISSURE_DORMANT_01",
    "PROP_LAVA_FISSURE_CORRUPTED_01",
  ],
} as const;

export const PropOrientations = ["NE_SW", "NW_SE"] as const;
export const DestructibleStates = ["BUILT", "DAMAGED", "DESTROYED"] as const;
