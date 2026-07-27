// Hexa Octarina Conquer — VFX, UI & TCG
// Tehkné Solutions

export const MAP_VFX_IDS = [
  "VFX_CELL_SELECTED_01",
  "VFX_CELL_VALID_01",
  "VFX_CELL_INVALID_01",
  "VFX_CELL_OBJECTIVE_01",
  "VFX_MAP_PATH_01",
  "VFX_TERRITORY_CONQUEST_01",
  "VFX_CONSTRUCTION_01",
  "VFX_UPGRADE_01",
  "VFX_STRUCTURE_DAMAGE_01",
  "VFX_EDGE_DESTRUCTION_01",
  "VFX_RESOURCE_COLLECT_01",
  "VFX_TELEPORT_01",
  "VFX_CORRUPTION_01",
  "VFX_HEAL_01",
  "VFX_RESURRECTION_01",
] as const;

export const TCG_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "octarine",
] as const;

export type TcgRarity = typeof TCG_RARITIES[number];

export interface TcgCardDefinition {
  id: string;
  entityId: string;
  name: string;
  entityType: "unit" | "hero" | "champion";
  class: string;
  rarity: TcgRarity;
  cost: number;
  attack: number;
  health: number;
  file: string;
  frameId: string;
  cardBackId: string;
}

export const getProjectileImpactId = (
  projectileId: string,
): string => projectileId.replace("PROJECTILE_", "IMPACT_");
