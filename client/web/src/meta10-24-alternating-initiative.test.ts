import { describe, expect, it } from "vitest";

import { strategicEnemyTurnGlobal } from "./strategic-ai-global-executor";
import {
  createStrategicBoard,
  strategicNodeId,
  strategicOwnedCellCount,
  strategicResult,
  strategicStructureCount,
  type StrategicBoard,
  type StrategicFaction,
  type StrategicUnitId,
} from "./strategic-board-model";

type FirstFaction = "blue" | "red";

type Outcome = {
  result: ReturnType<typeof strategicResult>;
  rounds: number;
  blueCells: number;
  redCells: number;
  blueStructures: number;
  redStructures: number;
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

function neutralOpening(): StrategicBoard {
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

function takeTurn(board: StrategicBoard, faction: FirstFaction): StrategicBoard {
  return faction === "blue" ? blueTurn(board) : strategicEnemyTurnGlobal(board).board;
}

function playAlternating(initialFirst: FirstFaction, maxRounds = 24): Outcome {
  let board = neutralOpening();
  let rounds = 0;
  while (rounds < maxRounds && strategicResult(board) === "playing") {
    const first: FirstFaction = rounds % 2 === 0
      ? initialFirst
      : initialFirst === "blue" ? "red" : "blue";
    const second: FirstFaction = first === "blue" ? "red" : "blue";
    rounds += 1;

    board = takeTurn(board, first);
    if (strategicResult(board) !== "playing") break;
    board = takeTurn(board, second);
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

describe("META 10.24 alternating initiative", () => {
  it("compares alternating round initiative from a zero-bias opening", () => {
    const blueStartsRoundOne = playAlternating("blue");
    const redStartsRoundOne = playAlternating("red");

    console.log(`HOC_STRATEGIC_ALTERNATING_INITIATIVE=${JSON.stringify({ blueStartsRoundOne, redStartsRoundOne })}`);

    expect(blueStartsRoundOne.rounds).toBeGreaterThan(0);
    expect(redStartsRoundOne.rounds).toBeGreaterThan(0);
  });
});
