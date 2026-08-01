import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicCellRoadProgress,
  strategicClaimEdge,
  strategicEdgeId,
  strategicOwnedCellCount,
  strategicPreferredBuild,
  type StrategicBoard,
} from "./strategic-board-model";

function withRedRoad(board: StrategicBoard, a: string, b: string): StrategicBoard {
  const id = strategicEdgeId(a, b);
  return {
    ...board,
    edges: board.edges.map((edge) => edge.id === id
      ? { ...edge, owner: "red" as const, state: "road" as const }
      : edge),
  };
}

describe("META 10.8 AI expansion objectives", () => {
  it("prioritizes a road that immediately closes a red territory", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => unit.id === "varg"
        ? { ...unit, nodeId: "s-1-1" }
        : unit),
    };

    // sc-1-0 já tem três lados Rubros; a ligação s-1-1 -> s-1-0 fecha a região.
    board = withRedRoad(board, "s-1-0", "s-2-0");
    board = withRedRoad(board, "s-2-0", "s-2-1");
    board = withRedRoad(board, "s-1-1", "s-2-1");

    expect(strategicCellRoadProgress(board, "sc-1-0", "red")).toBe(3);
    expect(strategicPreferredBuild(board, "varg")).toBe("s-1-0");

    const next = strategicClaimEdge(board, "varg", "s-1-0");
    expect(strategicOwnedCellCount(next, "red")).toBeGreaterThan(strategicOwnedCellCount(board, "red"));
  });

  it("uses territorial progress before simple proximity when no cell closes immediately", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => unit.id === "varg"
        ? { ...unit, nodeId: "s-1-1" }
        : unit),
    };

    // Reforça sc-1-0 sem deixá-la a um passo do fechamento.
    board = withRedRoad(board, "s-1-0", "s-2-0");
    board = withRedRoad(board, "s-2-0", "s-2-1");

    expect(strategicCellRoadProgress(board, "sc-1-0", "red")).toBe(2);
    expect(strategicPreferredBuild(board, "varg")).toBe("s-1-0");
  });
});
