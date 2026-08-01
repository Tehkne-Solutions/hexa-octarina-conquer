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
  it("executes the globally highest-scored lethal attack and exposes its decision trace", () => {
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
    expect(turn.message).toContain("[IA ATTACK · score 158]");
    expect(turn.message).toContain("finalização de alvo vulnerável");
    expect(turn.message).toContain("Varg atacou Lyra");
  });

  it("keeps attack and movement limits across the whole action budget", () => {
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

    expect(before - after).toBe(5);
    expect(turn.message.match(/Brakk atacou Lyra/g)?.length ?? 0).toBe(1);
    expect(turn.message).toMatch(/\[IA (ATTACK|CONFRONT|BUILD|STRUCTURE|MOVE) · score \d+\]/);
  });
});
