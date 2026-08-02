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
  const unitPairs: Record<StrategicUnitId, StrategicUnitId> = {
    kael: "brakk",
    brakk: "kael",
    lyra: "varg",
    varg: "lyra",
  };
  const sourceById = new Map(board.units.map((unit) => [unit.id, unit]));
  return {
    ...board,
    edges: board.edges.map((edge) => ({ ...edge, owner: opposite(edge.owner) })),
    cells: board.cells.map((cell) => ({
      ...cell,
      owner: opposite(cell.owner),
      structure: cell.structure ? { ...cell.structure, owner: opposite(cell.structure.owner)! } : null,
    })),
    units: board.units.map((unit) => {
      const source = sourceById.get(unitPairs[unit.id])!;
      return { ...unit, nodeId: source.nodeId, hp: source.hp, maxHp: source.maxHp };
    }),
  };
}

function blueTurn(board: StrategicBoard): StrategicBoard {
  return swapPerspective(strategicEnemyTurnGlobal(swapPerspective(board)).board);
}

function neutralBoard(): StrategicBoard {
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

function playAlternating(initial: StrategicBoard, firstRoundStarter: FirstFaction, maxRounds = 24): Outcome {
  let board = initial;
  let rounds = 0;
  let starter = firstRoundStarter;

  while (rounds < maxRounds && strategicResult(board) === "playing") {
    rounds += 1;
    if (starter === "blue") {
      board = blueTurn(board);
      if (strategicResult(board) === "playing") board = strategicEnemyTurnGlobal(board).board;
    } else {
      board = strategicEnemyTurnGlobal(board).board;
      if (strategicResult(board) === "playing") board = blueTurn(board);
    }
    starter = starter === "blue" ? "red" : "blue";
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

function starterFromSeed(seed: number): FirstFaction {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) % 2 === 0 ? "blue" : "red";
}

describe("META 10.25 seeded opening initiative", () => {
  it("distributes resolved outcomes fairly across a reproducible 5k sample", () => {
    const sampleSize = 5000;
    const seedOffset = 500000;
    let blueStarts = 0;
    let redStarts = 0;
    let blueWins = 0;
    let redWins = 0;
    let unresolved = 0;
    let roundTotal = 0;

    for (let index = 0; index < sampleSize; index += 1) {
      const starter = starterFromSeed(seedOffset + index);
      if (starter === "blue") blueStarts += 1;
      else redStarts += 1;

      const outcome = playAlternating(neutralBoard(), starter);
      roundTotal += outcome.rounds;
      if (outcome.result === "victory") blueWins += 1;
      else if (outcome.result === "defeat") redWins += 1;
      else unresolved += 1;
    }

    const payload = {
      sampleSize,
      seedOffset,
      blueStarts,
      redStarts,
      blueWins,
      redWins,
      unresolved,
      blueWinRate: blueWins / sampleSize,
      redWinRate: redWins / sampleSize,
      unresolvedRate: unresolved / sampleSize,
      averageRounds: roundTotal / sampleSize,
    };

    console.log(`HOC_STRATEGIC_SEEDED_INITIATIVE=${JSON.stringify(payload)}`);

    expect(unresolved).toBe(0);
    expect(Math.abs(blueStarts - redStarts)).toBeLessThanOrEqual(100);
    expect(Math.abs(blueWins - redWins)).toBeLessThanOrEqual(100);
    expect(blueWins + redWins).toBe(sampleSize);
  });
});
