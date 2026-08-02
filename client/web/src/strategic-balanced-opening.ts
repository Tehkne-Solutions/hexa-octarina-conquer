import {
  createStrategicBoard,
  strategicNodeId,
  type StrategicBoard,
  type StrategicFaction,
  type StrategicUnitId,
} from "./strategic-board-model";

export type StrategicRoundStarter = StrategicFaction;

export function createBalancedStrategicBoard(): StrategicBoard {
  const base = createStrategicBoard();
  const nodes: Record<StrategicUnitId, string> = {
    kael: strategicNodeId(0, 0),
    lyra: strategicNodeId(1, 2),
    brakk: strategicNodeId(2, 2),
    varg: strategicNodeId(1, 0),
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
