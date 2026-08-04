import {
  createStrategicBoard,
  strategicNodeId,
  type StrategicBoard,
  type StrategicFaction,
  type StrategicUnitId,
} from "./strategic-board-model";

export type StrategicRoundStarter = StrategicFaction;

/**
 * Canonical first-playable opening.
 *
 * Both factions start on mirrored west/east fronts with no prebuilt roads.
 * The geometry was selected from the exhaustive neutral-opening search because
 * it resolves under either initiative direction instead of privileging Blue
 * through the original asymmetric roads/central placement.
 */
export function createBalancedStrategicBoard(): StrategicBoard {
  const base = createStrategicBoard();
  const nodes: Record<StrategicUnitId, string> = {
    kael: strategicNodeId(0, 0),
    lyra: strategicNodeId(0, 2),
    varg: strategicNodeId(2, 0),
    brakk: strategicNodeId(2, 2),
  };

  return {
    ...base,
    edges: base.edges.map((edge) => ({ ...edge, owner: null, state: "unbuilt" as const })),
    cells: base.cells.map((cell) => ({ ...cell, owner: null, structure: null })),
    units: base.units.map((unit) => ({ ...unit, nodeId: nodes[unit.id] })),
  };
}

export function strategicStarterFromSeed(seed: number): StrategicRoundStarter {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) % 2 === 0 ? "blue" : "red";
}

export function strategicNextRoundStarter(starter: StrategicRoundStarter): StrategicRoundStarter {
  return starter === "blue" ? "red" : "blue";
}

export function createStrategicMatchSeed(now = Date.now(), entropy = Math.random()): number {
  if (typeof window !== "undefined") {
    try {
      const forcedSeed = window.sessionStorage.getItem("hexa.strategic.match-seed");
      if (forcedSeed !== null && forcedSeed.trim() !== "") {
        const parsed = Number(forcedSeed);
        if (Number.isFinite(parsed)) return parsed >>> 0;
      }
    } catch {
      // Storage can be unavailable in hardened browser contexts; fall back to runtime entropy.
    }
  }

  const entropyBits = Math.floor(entropy * 0x7fffffff);
  return ((now >>> 0) ^ entropyBits) >>> 0;
}
