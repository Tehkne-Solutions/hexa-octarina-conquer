import { describe, expect, it } from "vitest";

import { strategicEnemyTurnGlobal } from "./strategic-ai-global-executor";
import {
  createStrategicBoard,
  strategicNodeId,
  strategicOwnedCellCount,
  strategicResult,
  strategicStructureCount,
  type StrategicBoard,
  type StrategicUnitId,
} from "./strategic-board-model";

type FirstFaction = "blue" | "red";

function swapFactionPerspective(board: StrategicBoard): StrategicBoard {
  const unitPairs: Record<StrategicUnitId, StrategicUnitId> = {
    kael: "brakk",
    brakk: "kael",
    lyra: "varg",
    varg: "lyra",
  };
  const sourceById = new Map(board.units.map((unit) => [unit.id, unit]));
  return {
    ...board,
    edges: board.edges.map((edge) => ({
      ...edge,
      owner: edge.owner === "blue" ? "red" : edge.owner === "red" ? "blue" : null,
    })),
    cells: board.cells.map((cell) => ({
      ...cell,
      owner: cell.owner === "blue" ? "red" : cell.owner === "red" ? "blue" : null,
      structure: cell.structure
        ? { ...cell.structure, owner: cell.structure.owner === "blue" ? "red" as const : "blue" as const }
        : null,
    })),
    units: board.units.map((unit) => {
      const source = sourceById.get(unitPairs[unit.id])!;
      return { ...unit, nodeId: source.nodeId, hp: source.hp, maxHp: source.maxHp };
    }),
  };
}

function blueTurn(board: StrategicBoard, maxActions?: number): StrategicBoard {
  return swapFactionPerspective(strategicEnemyTurnGlobal(swapFactionPerspective(board), maxActions).board);
}

function fairOpening(): StrategicBoard {
  const base = createStrategicBoard();
  const positions: Record<StrategicUnitId, string> = {
    kael: strategicNodeId(0, 0),
    lyra: strategicNodeId(1, 2),
    brakk: strategicNodeId(2, 2),
    varg: strategicNodeId(1, 0),
  };
  return {
    ...base,
    edges: base.edges.map((edge) => ({ ...edge, owner: null, state: "unbuilt" as const })),
    cells: base.cells.map((cell) => ({ ...cell, owner: null, structure: null })),
    units: base.units.map((unit) => ({ ...unit, nodeId: positions[unit.id] })),
  };
}

function play(first: FirstFaction, openingBudget: number, maxRounds = 24) {
  let board = fairOpening();
  let rounds = 0;
  let firstTurn = true;

  while (rounds < maxRounds && strategicResult(board) === "playing") {
    rounds += 1;
    if (first === "blue") {
      board = blueTurn(board, firstTurn ? openingBudget : undefined);
      firstTurn = false;
      if (strategicResult(board) !== "playing") break;
      board = strategicEnemyTurnGlobal(board).board;
    } else {
      board = strategicEnemyTurnGlobal(board, firstTurn ? openingBudget : undefined).board;
      firstTurn = false;
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

describe("META 10.23 opening budget compensation", () => {
  it("compares reduced first-turn budgets on a zero-bias symmetric opening", () => {
    const results = [1, 2, 3].map((openingBudget) => ({
      openingBudget,
      blueFirst: play("blue", openingBudget),
      redFirst: play("red", openingBudget),
    }));

    console.log(`HOC_STRATEGIC_OPENING_BUDGET=${JSON.stringify(results)}`);

    expect(results).toHaveLength(3);
    expect(results.every((entry) => entry.blueFirst.rounds > 0 && entry.redFirst.rounds > 0)).toBe(true);
  });
});
