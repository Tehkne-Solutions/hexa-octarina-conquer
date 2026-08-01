import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicEdgeId,
  strategicEnemyTurn,
  strategicUnit,
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

describe("META 10.6 AI tactical actions", () => {
  it("limits each enemy unit to one attack per turn", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => unit.id === "brakk"
        ? { ...unit, nodeId: "s-1-2" }
        : unit),
    };
    board = withRedRoad(board, "s-1-2", "s-0-2");

    const lyraBefore = strategicUnit(board, "lyra").hp;
    const turn = strategicEnemyTurn(board);
    const lyraAfter = strategicUnit(turn.board, "lyra").hp;

    expect(lyraBefore - lyraAfter).toBe(5);
    expect(turn.message.match(/Brakk atacou/g)?.length ?? 0).toBe(1);
  });

  it("prioritizes the reachable blue unit with the lowest current HP", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => {
        if (unit.id === "varg") return { ...unit, nodeId: "s-1-1" };
        if (unit.id === "kael") return { ...unit, nodeId: "s-1-0", hp: 16 };
        if (unit.id === "lyra") return { ...unit, nodeId: "s-1-2", hp: 8 };
        if (unit.id === "brakk") return { ...unit, hp: 0 };
        return unit;
      }),
    };
    board = withRedRoad(board, "s-1-1", "s-1-0");
    board = withRedRoad(board, "s-1-1", "s-1-2");

    const turn = strategicEnemyTurn(board);

    expect(strategicUnit(turn.board, "lyra").hp).toBe(5);
    expect(strategicUnit(turn.board, "kael").hp).toBe(16);
    expect(turn.message).toContain("Varg atacou Lyra");
  });
});
