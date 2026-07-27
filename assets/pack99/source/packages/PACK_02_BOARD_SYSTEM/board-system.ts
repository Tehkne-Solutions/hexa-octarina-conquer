// Hexa Octarina Conquer — Board System
// Tehkné Solutions

export const BoardSystemPack = {
  pillars: {
    neutral: "PILLAR_NEUTRAL_01",
    blue: "PILLAR_BLUE_01",
    red: "PILLAR_RED_01",
    energized: "PILLAR_ENERGIZED_01",
    blocked: "PILLAR_BLOCKED_01",
    selected: "PILLAR_SELECTED_01",
  },
  territoryLineage: [
    "TERR_SIGIL",
    "TERR_CAMP",
    "TERR_OUTPOST",
    "TERR_FORT",
    "TERR_CITADEL",
  ],
  edgeMaterials: ["WOOD", "STONE", "ARCANE"],
  edgeStates: ["PREVIEW", "BUILT", "DAMAGED", "DESTROYED"],
  edgeOrientations: ["NE_SW", "NW_SE"],
} as const;
