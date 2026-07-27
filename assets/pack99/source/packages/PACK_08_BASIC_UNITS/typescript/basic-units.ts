// Hexa Octarina Conquer — Basic Units
// Tehkné Solutions

export const BASIC_UNIT_IDS = [
  "UNIT_RECRUIT_01",
  "UNIT_ARCHER_01",
  "UNIT_GUARDIAN_01",
  "UNIT_ARCANE_APPRENTICE_01",
  "UNIT_COLLECTOR_01",
  "UNIT_SCOUT_01",
  "UNIT_SKELETON_01",
  "UNIT_STONE_GOLEM_01",
] as const;

export const BASIC_UNIT_DIRECTIONS = ["NE", "NW", "SE", "SW"] as const;
export const BASIC_UNIT_STATES = [
  "idle",
  "walk",
  "attack",
  "hit",
  "defeat",
] as const;

export type BasicUnitId = typeof BASIC_UNIT_IDS[number];
export type BasicUnitDirection = typeof BASIC_UNIT_DIRECTIONS[number];
export type BasicUnitState = typeof BASIC_UNIT_STATES[number];

export function getBasicUnitAnimationId(
  unitId: BasicUnitId,
  state: BasicUnitState,
  direction: BasicUnitDirection,
): string {
  return `${unitId}_${state.toUpperCase()}_${direction}_01`;
}
