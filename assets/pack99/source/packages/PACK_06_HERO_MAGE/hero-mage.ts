// Hexa Octarina Conquer — Hero Mage
// Tehkné Solutions

export const HERO_MAGE_ID = "HERO_MAGE_01" as const;
export const HERO_MAGE_DIRECTIONS = ["NE", "NW", "SE", "SW"] as const;
export const HERO_MAGE_STATES = ["idle", "walk", "attack", "cast", "hit", "defeat", "victory"] as const;

export type HeroMageDirection = typeof HERO_MAGE_DIRECTIONS[number];
export type HeroMageState = typeof HERO_MAGE_STATES[number];

export function getHeroMageAnimationId(
  state: HeroMageState,
  direction: HeroMageDirection,
): string {
  return `HERO_MAGE_${state.toUpperCase()}_${direction}_01`;
}
