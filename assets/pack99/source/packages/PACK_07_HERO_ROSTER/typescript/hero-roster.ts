// Hexa Octarina Conquer — Hero Roster
// Tehkné Solutions

export const HERO_ROSTER = [
  "HERO_WARRIOR_01",
  "HERO_NECROMANCER_01",
  "HERO_RANGER_01",
  "HERO_ASSASSIN_01",
  "HERO_GUARDIAN_01",
] as const;

export const HERO_DIRECTIONS = ["NE", "NW", "SE", "SW"] as const;
export const HERO_STATES = [
  "idle",
  "walk",
  "attack",
  "cast",
  "hit",
  "defeat",
  "victory",
] as const;

export type HeroRosterId = typeof HERO_ROSTER[number];
export type HeroDirection = typeof HERO_DIRECTIONS[number];
export type HeroState = typeof HERO_STATES[number];

export function getHeroAnimationId(
  heroId: HeroRosterId,
  state: HeroState,
  direction: HeroDirection,
): string {
  return `${heroId}_${state.toUpperCase()}_${direction}_01`;
}
