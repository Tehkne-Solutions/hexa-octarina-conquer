// Hexa Octarina Conquer — Map Runtime Helpers
// Tehkné Solutions

import type { MapDefinition, MapCell } from "./map-types";

export function indexMapCells(
  map: MapDefinition,
): ReadonlyMap<string, MapCell> {
  return new Map(map.cells.map((cell) => [`${cell.x}:${cell.y}`, cell]));
}

export function isWalkable(
  map: MapDefinition,
  x: number,
  y: number,
): boolean {
  const cell = map.cells.find((candidate) => candidate.x === x && candidate.y === y);
  return Boolean(cell?.walkable);
}

export function getMovementCost(
  map: MapDefinition,
  x: number,
  y: number,
): number {
  const cell = map.cells.find((candidate) => candidate.x === x && candidate.y === y);
  return cell?.movementCost ?? Number.POSITIVE_INFINITY;
}

export function getRenderQueue(map: MapDefinition) {
  return [
    ...map.cells.map((cell) => ({
      kind: "terrain" as const,
      id: `${map.mapId}:terrain:${cell.x}:${cell.y}`,
      x: cell.x,
      y: cell.y,
      z: cell.zBase,
      assetId: cell.baseTileId,
      overlayId: cell.transitionOverlayId,
    })),
    ...map.spawns.map((spawn) => ({
      kind: spawn.kind,
      id: spawn.id,
      x: spawn.x,
      y: spawn.y,
      z: spawn.x + spawn.y + spawn.zOffset,
      assetId: spawn.assetId,
    })),
  ].sort((left, right) => left.z - right.z);
}
