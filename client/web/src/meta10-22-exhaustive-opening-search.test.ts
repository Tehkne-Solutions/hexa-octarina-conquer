import { describe, expect, it } from "vitest";

import { strategicEnemyTurnGlobal } from "./strategic-ai-global-executor";
import {
  createStrategicBoard,
  strategicOwnedCellCount,
  strategicResult,
  strategicStructureCount,
  strategicNodeId,
  type StrategicBoard,
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

function blueTurn(board: StrategicBoard): StrategicBoard {
  return swapFactionPerspective(strategicEnemyTurnGlobal(swapFactionPerspective(board)).board);
}

function play(initial: StrategicBoard, first: FirstFaction, maxRounds = 24): Outcome {
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

function mirrorNode(nodeId: string): string {
  const [, colText, rowText] = nodeId.split("-");
  const col = Number(colText);
  const row = Number(rowText);
  return strategicNodeId(2 - col, 2 - row);
}

function neutralBoard(kaelNode: string, lyraNode: string): StrategicBoard | null {
  const brakkNode = mirrorNode(kaelNode);
  const vargNode = mirrorNode(lyraNode);
  const occupied = new Set([kaelNode, lyraNode, brakkNode, vargNode]);
  if (occupied.size !== 4) return null;

  const base = createStrategicBoard();
  const nodeByUnit: Record<StrategicUnitId, string> = {
    kael: kaelNode,
    lyra: lyraNode,
    brakk: brakkNode,
    varg: vargNode,
  };
  return {
    ...base,
    edges: base.edges.map((edge) => ({ ...edge, owner: null, state: "unbuilt" as const })),
    cells: base.cells.map((cell) => ({ ...cell, owner: null, structure: null })),
    units: base.units.map((unit) => ({ ...unit, nodeId: nodeByUnit[unit.id] })),
  };
}

function resultCode(result: Outcome["result"]): number {
  return result === "victory" ? 1 : result === "defeat" ? -1 : 0;
}

function fairnessScore(blueFirst: Outcome, redFirst: Outcome): number {
  const outcomeBias = Math.abs(resultCode(blueFirst.result) + resultCode(redFirst.result)) * 100;
  const territoryBias = Math.abs((blueFirst.blueCells - blueFirst.redCells) + (redFirst.blueCells - redFirst.redCells)) * 10;
  const structureBias = Math.abs((blueFirst.blueStructures - blueFirst.redStructures) + (redFirst.blueStructures - redFirst.redStructures)) * 10;
  const roundGap = Math.abs(blueFirst.rounds - redFirst.rounds);
  return outcomeBias + territoryBias + structureBias + roundGap;
}

describe("META 10.22 exhaustive symmetric neutral opening search", () => {
  it("ranks every valid 180-degree symmetric no-road opening", () => {
    const nodes = Array.from({ length: 9 }, (_, index) => strategicNodeId(index % 3, Math.floor(index / 3)))
      .filter((nodeId) => nodeId !== strategicNodeId(1, 1));

    const candidates: Array<{
      kael: string;
      lyra: string;
      brakk: string;
      varg: string;
      blueFirst: Outcome;
      redFirst: Outcome;
      score: number;
    }> = [];

    for (const kael of nodes) {
      for (const lyra of nodes) {
        if (lyra === kael) continue;
        const board = neutralBoard(kael, lyra);
        if (!board) continue;
        const blueFirst = play(board, "blue");
        const redFirst = play(board, "red");
        candidates.push({
          kael,
          lyra,
          brakk: mirrorNode(kael),
          varg: mirrorNode(lyra),
          blueFirst,
          redFirst,
          score: fairnessScore(blueFirst, redFirst),
        });
      }
    }

    candidates.sort((a, b) => a.score - b.score
      || Math.abs(a.blueFirst.rounds - a.redFirst.rounds) - Math.abs(b.blueFirst.rounds - b.redFirst.rounds)
      || a.kael.localeCompare(b.kael)
      || a.lyra.localeCompare(b.lyra));

    const top = candidates.slice(0, 10);
    console.log(`HOC_STRATEGIC_EXHAUSTIVE_OPENINGS=${JSON.stringify({ evaluated: candidates.length, top })}`);

    expect(candidates.length).toBeGreaterThan(0);
    expect(top[0]?.score).toBeGreaterThanOrEqual(0);
  });
});
