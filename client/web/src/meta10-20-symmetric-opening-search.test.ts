import { describe, expect, it } from "vitest";

import { strategicEnemyTurnGlobal } from "./strategic-ai-global-executor";
import {
  createStrategicBoard,
  strategicEdgeId,
  strategicNodeId,
  strategicOwnedCellCount,
  strategicResult,
  strategicStructureCount,
  type StrategicBoard,
  type StrategicFaction,
  type StrategicUnitId,
} from "./strategic-board-model";

type FirstFaction = "blue" | "red";

type Opening = {
  name: string;
  units: Record<StrategicUnitId, string>;
  blueRoads: [string, string][];
  redRoads: [string, string][];
};

function opposite(faction: StrategicFaction | null): StrategicFaction | null {
  return faction === "blue" ? "red" : faction === "red" ? "blue" : null;
}

function swapPerspective(board: StrategicBoard): StrategicBoard {
  return {
    ...board,
    edges: board.edges.map((edge) => ({ ...edge, owner: opposite(edge.owner) })),
    cells: board.cells.map((cell) => ({
      ...cell,
      owner: opposite(cell.owner),
      structure: cell.structure ? { ...cell.structure, owner: opposite(cell.structure.owner)! } : null,
    })),
    units: board.units.map((unit) => ({ ...unit, faction: opposite(unit.faction)! })),
  };
}

function blueTurn(board: StrategicBoard): StrategicBoard {
  return swapPerspective(strategicEnemyTurnGlobal(swapPerspective(board)).board);
}

function applyOpening(opening: Opening): StrategicBoard {
  const board = createStrategicBoard();
  const blueRoadIds = new Set(opening.blueRoads.map(([a, b]) => strategicEdgeId(a, b)));
  const redRoadIds = new Set(opening.redRoads.map(([a, b]) => strategicEdgeId(a, b)));
  return {
    ...board,
    edges: board.edges.map((edge) => {
      if (blueRoadIds.has(edge.id)) return { ...edge, owner: "blue" as const, state: "road" as const };
      if (redRoadIds.has(edge.id)) return { ...edge, owner: "red" as const, state: "road" as const };
      return { ...edge, owner: null, state: "unbuilt" as const };
    }),
    cells: board.cells.map((cell) => ({ ...cell, owner: null, structure: null })),
    units: board.units.map((unit) => ({ ...unit, nodeId: opening.units[unit.id] })),
  };
}

function play(initial: StrategicBoard, first: FirstFaction, maxRounds = 24) {
  let board = initial;
  let rounds = 0;
  while (rounds < maxRounds && strategicResult(board) === "playing") {
    rounds += 1;
    if (first === "blue") {
      board = blueTurn(board);
      if (strategicResult(board) !== "playing") break;
      board = strategicEnemyTurnGlobal(board).board;
    } else {
      board = strategicEnemyTurnGlobal(board).board;
      if (strategicResult(board) !== "playing") break;
      board = blueTurn(board);
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
const openings: Opening[] = [
  {
    name: "side-mid-mirror",
    units: { kael: n(0, 1), lyra: n(0, 2), varg: n(2, 1), brakk: n(2, 2) },
    blueRoads: [[n(0, 1), n(0, 2)], [n(0, 1), n(1, 1)]],
    redRoads: [[n(2, 1), n(2, 2)], [n(2, 1), n(1, 1)]],
  },
  {
    name: "outer-columns",
    units: { kael: n(0, 0), lyra: n(0, 2), varg: n(2, 0), brakk: n(2, 2) },
    blueRoads: [[n(0, 0), n(0, 1)], [n(0, 1), n(0, 2)]],
    redRoads: [[n(2, 0), n(2, 1)], [n(2, 1), n(2, 2)]],
  },
  {
    name: "diagonal-corners",
    units: { kael: n(0, 0), lyra: n(1, 0), varg: n(2, 2), brakk: n(1, 2) },
    blueRoads: [[n(0, 0), n(1, 0)], [n(0, 0), n(0, 1)]],
    redRoads: [[n(2, 2), n(1, 2)], [n(2, 2), n(2, 1)]],
  },
];

describe("META 10.20 symmetric opening search", () => {
  it("compares mirrored openings under identical AI policies", () => {
    const results = openings.map((opening) => ({
      name: opening.name,
      blueFirst: play(applyOpening(opening), "blue"),
      redFirst: play(applyOpening(opening), "red"),
    }));

    console.log(`HOC_STRATEGIC_SYMMETRIC_OPENINGS=${JSON.stringify(results)}`);

    expect(results).toHaveLength(3);
    expect(results.every((entry) => entry.blueFirst.rounds > 0 && entry.redFirst.rounds > 0)).toBe(true);
  });
});
