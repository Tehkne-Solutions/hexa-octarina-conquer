import { describe, expect, it } from "vitest";

import { strategicEnemyTurnGlobal } from "./strategic-ai-global-executor";
import {
  createStrategicBoard,
  strategicEdgeId,
  strategicOwnedCellCount,
  strategicResult,
  strategicStructureCount,
  strategicNodeId,
  type StrategicBoard,
  type StrategicFaction,
  type StrategicUnitId,
} from "./strategic-board-model";

type FirstFaction = "blue" | "red";

type SetupSpec = {
  name: string;
  units: Record<StrategicUnitId, string>;
  blueRoads?: [string, string][];
  redRoads?: [string, string][];
};

function swapFaction(faction: StrategicFaction): StrategicFaction {
  return faction === "blue" ? "red" : "blue";
}

function swapPerspective(board: StrategicBoard): StrategicBoard {
  return {
    ...board,
    edges: board.edges.map((edge) => ({ ...edge, owner: edge.owner ? swapFaction(edge.owner) : null })),
    cells: board.cells.map((cell) => ({
      ...cell,
      owner: cell.owner ? swapFaction(cell.owner) : null,
      structure: cell.structure ? { ...cell.structure, owner: swapFaction(cell.structure.owner) } : null,
    })),
    units: board.units.map((unit) => ({ ...unit, faction: swapFaction(unit.faction) })),
  };
}

function blueTurn(board: StrategicBoard): StrategicBoard {
  return swapPerspective(strategicEnemyTurnGlobal(swapPerspective(board)).board);
}

function buildSetup(spec: SetupSpec): StrategicBoard {
  const board = createStrategicBoard();
  const roadOwners = new Map<string, StrategicFaction>();
  for (const [a, b] of spec.blueRoads ?? []) roadOwners.set(strategicEdgeId(a, b), "blue");
  for (const [a, b] of spec.redRoads ?? []) roadOwners.set(strategicEdgeId(a, b), "red");

  return {
    ...board,
    edges: board.edges.map((edge) => {
      const owner = roadOwners.get(edge.id) ?? null;
      return { ...edge, owner, state: owner ? "road" : "unbuilt" };
    }),
    cells: board.cells.map((cell) => ({ ...cell, owner: null, structure: null })),
    units: board.units.map((unit) => ({ ...unit, nodeId: spec.units[unit.id] })),
  };
}

function play(initial: StrategicBoard, first: FirstFaction, maxRounds = 24) {
  let board = initial;
  let rounds = 0;
  while (rounds < maxRounds && strategicResult(board) === "playing") {
    rounds += 1;
    if (first === "red") {
      board = strategicEnemyTurnGlobal(board).board;
      if (strategicResult(board) !== "playing") break;
      board = blueTurn(board);
    } else {
      board = blueTurn(board);
      if (strategicResult(board) !== "playing") break;
      board = strategicEnemyTurnGlobal(board).board;
    }
  }
  return {
    result: strategicResult(board),
    rounds,
    blueCells: strategicOwnedCellCount(board, "blue"),
    redCells: strategicOwnedCellCount(board, "red"),
    blueStructures: strategicStructureCount(board, "blue"),
    redStructures: strategicStructureCount(board, "red"),
  };
}

const n = strategicNodeId;

const SETUPS: SetupSpec[] = [
  {
    name: "side-mid-no-roads",
    units: { kael: n(0, 1), lyra: n(0, 2), brakk: n(2, 1), varg: n(2, 0) },
  },
  {
    name: "corner-no-roads",
    units: { kael: n(0, 0), lyra: n(0, 2), brakk: n(2, 0), varg: n(2, 2) },
  },
  {
    name: "outer-one-road",
    units: { kael: n(0, 1), lyra: n(0, 2), brakk: n(2, 1), varg: n(2, 0) },
    blueRoads: [[n(0, 1), n(0, 2)]],
    redRoads: [[n(2, 0), n(2, 1)]],
  },
  {
    name: "center-approach-one-road",
    units: { kael: n(0, 1), lyra: n(0, 2), brakk: n(2, 1), varg: n(2, 0) },
    blueRoads: [[n(0, 1), n(1, 1)]],
    redRoads: [[n(1, 1), n(2, 1)]],
  },
];

describe("META 10.21 neutral symmetric opening search", () => {
  it("compares neutral openings under exactly mirrored AI policies", () => {
    const results = SETUPS.map((spec) => ({
      name: spec.name,
      blueFirst: play(buildSetup(spec), "blue"),
      redFirst: play(buildSetup(spec), "red"),
    }));

    console.log(`HOC_STRATEGIC_NEUTRAL_OPENINGS=${JSON.stringify(results)}`);

    expect(results).toHaveLength(4);
    for (const result of results) {
      expect(result.blueFirst.rounds).toBeGreaterThan(0);
      expect(result.redFirst.rounds).toBeGreaterThan(0);
    }
  });
});
