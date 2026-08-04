import { describe, expect, it } from "vitest";

import { strategicEnemyTurnGlobal } from "./strategic-ai-global-executor";
import {
  createStrategicBoard,
  strategicEdgeId,
  strategicResult,
  strategicUnit,
  type StrategicBoard,
} from "./strategic-board-model";

function withRoad(board: StrategicBoard, a: string, b: string): StrategicBoard {
  const id = strategicEdgeId(a, b);
  return {
    ...board,
    edges: board.edges.map((edge) => edge.id === id
      ? { ...edge, owner: "red" as const, state: "road" as const }
      : edge),
  };
}

describe("META 10.10B global AI executor", () => {
  it("executes the globally highest-scored lethal attack while keeping score out of player copy", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => {
        if (unit.id === "varg") return { ...unit, nodeId: "s-1-1" };
        if (unit.id === "lyra") return { ...unit, nodeId: "s-1-2", hp: 2 };
        if (unit.id === "kael") return { ...unit, hp: 0 };
        if (unit.id === "brakk") return { ...unit, nodeId: "s-2-2" };
        return unit;
      }),
    };
    board = withRoad(board, "s-1-1", "s-1-2");

    const turn = strategicEnemyTurnGlobal(board);

    expect(strategicUnit(turn.board, "lyra").hp).toBe(0);
    expect(strategicResult(turn.board)).toBe("defeat");
    expect(turn.message).not.toContain("score");
    expect(turn.message).not.toContain("[IA ");
    expect(turn.message).toContain("Varg ataca Lyra");
    expect(turn.debugTrace).toMatch(/\[IA ATTACK · score \d+\]/);
    expect(turn.debugTrace).toContain("finalização de alvo vulnerável");
  });

  it("keeps attack and movement limits across the whole action budget without leaking debug copy", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => {
        if (unit.id === "brakk") return { ...unit, nodeId: "s-1-2" };
        return unit;
      }),
    };
    board = withRoad(board, "s-1-2", "s-0-2");

    const before = strategicUnit(board, "lyra").hp;
    const turn = strategicEnemyTurnGlobal(board);
    const after = strategicUnit(turn.board, "lyra").hp;

    expect(before - after).toBe(6);
    expect(turn.message.match(/Brakk ataca Lyra/g)?.length ?? 0).toBe(1);
    expect(turn.message).not.toContain("score");
    expect(turn.debugTrace).toMatch(/\[IA (ATTACK|CONFRONT|BUILD|STRUCTURE|MOVE) · score \d+\]/);
  });
});
