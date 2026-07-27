// Hexa Octarina Conquer — Deterministic Procedural Generator
// Tehkné Solutions

import type { AutotileMask } from "./map-types";

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function getAutotileMask(
  grid: readonly (readonly string[])[],
  x: number,
  y: number,
): AutotileMask {
  const terrain = grid[y]?.[x];
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  const same = (targetX: number, targetY: number): 0 | 1 =>
    targetX >= 0 &&
    targetY >= 0 &&
    targetX < width &&
    targetY < height &&
    grid[targetY][targetX] === terrain
      ? 1
      : 0;

  return `${same(x, y - 1)}${same(x + 1, y)}${same(x, y + 1)}${same(x - 1, y)}`;
}

export function isoToScreen(
  column: number,
  row: number,
  tileWidth: number,
  tileHeight: number,
  originX: number,
  originY: number,
): { x: number; y: number } {
  return {
    x: originX + ((column - row) * tileWidth) / 2,
    y: originY + ((column + row) * tileHeight) / 2,
  };
}

export function getIsoDepth(
  column: number,
  row: number,
  localOffset = 0,
): number {
  return column + row + localOffset;
}
