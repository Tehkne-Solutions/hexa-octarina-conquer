// Hexa Octarina Conquer — Resources
// Tehkné Solutions

export const ResourceIds = [
  "RES_WOOD",
  "RES_STONE",
  "RES_GOLD",
  "RES_MANA_BLUE",
  "RES_FOOD",
  "RES_KNOWLEDGE",
  "RES_OCTARINE_CRYSTAL",
  "RES_SOUL_FRAGMENT",
] as const;

export const ResourceStates = [
  "SMALL",
  "MEDIUM",
  "ABUNDANT",
  "DEPLETED",
] as const;

export type ResourceId = typeof ResourceIds[number];
export type ResourceState = typeof ResourceStates[number];

export function getResourceNodeId(
  resource: ResourceId,
  state: ResourceState,
): string {
  return `${resource}_${state}_01`;
}
