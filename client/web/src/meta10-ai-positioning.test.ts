import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicEdgeId,
  strategicPreferredMove,
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

function positioningBoard(hp: number): StrategicBoard {
  let board = createStrategicBoard();
  board = {
    ...board,
    units: board.units.map((unit) => {
      if (unit.id === "varg") return { ...unit, nodeId: "s-1-1", hp };
      if (unit.id === "kael") return { ...unit, nodeId: "s-0-0", hp: 18 };
      if (unit.id === "lyra") return { ...unit, nodeId: "s-0-2", hp: 6 };
      if (unit.id === "brakk") return { ...unit, nodeId: "s-2-2" };
      return unit;
    }),
  };
  board = withRedRoad(board, "s-1-1", "s-1-0");
  board = withRedRoad(board, "s-1-1", "s-2-1");
  return board;
}

describe("META 10.7 AI positioning", () => {
  it("moves a healthy enemy toward the closest vulnerable blue unit", () => {
    const board = positioningBoard(12);
    expect(strategicPreferredMove(board, "varg")).toBe("s-1-0");
  });

  it("moves a critically wounded enemy away from active blue units", () => {
    const board = positioningBoard(4);
    expect(strategicPreferredMove(board, "varg")).toBe("s-2-1");
  });
});
