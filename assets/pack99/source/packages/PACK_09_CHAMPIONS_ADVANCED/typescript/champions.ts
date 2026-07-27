// Hexa Octarina Conquer — Champions & Advanced Units
// Tehkné Solutions

export const CHAMPION_IDS = [
  "CHAMP_PALADIN_01",
  "CHAMP_SORCERESS_01",
  "CHAMP_BERSERKER_01",
  "CHAMP_UNDEAD_KNIGHT_01",
] as const;

export const CHAMPION_DIRECTIONS = ["NE", "NW", "SE", "SW"] as const;
export const CHAMPION_STATES = [
  "idle",
  "walk",
  "attack",
  "cast",
  "hit",
  "defeat",
  "victory",
] as const;

export const CHAMPION_EVOLUTION = {
  UNIT_GUARDIAN_01: "CHAMP_PALADIN_01",
  UNIT_ARCANE_APPRENTICE_01: "CHAMP_SORCERESS_01",
  UNIT_RECRUIT_01: "CHAMP_BERSERKER_01",
  UNIT_SKELETON_01: "CHAMP_UNDEAD_KNIGHT_01",
} as const;

export type ChampionId = typeof CHAMPION_IDS[number];
export type ChampionDirection = typeof CHAMPION_DIRECTIONS[number];
export type ChampionState = typeof CHAMPION_STATES[number];

export function getChampionAnimationId(
  championId: ChampionId,
  state: ChampionState,
  direction: ChampionDirection,
): string {
  return `${championId}_${state.toUpperCase()}_${direction}_01`;
}
