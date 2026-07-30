import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicActionBudget,
  strategicBuildStructure,
  strategicBuildTargets,
  strategicClaimEdge,
  strategicEnemyTurn,
  strategicMoveTargets,
  strategicMoveUnit,
  strategicOwnedCellCount,
  strategicStructureCount,
  strategicStructureTargets,
  strategicUnit,
} from "./strategic-board-model";

describe("META 07 strategic vertical slice", () => {
  it("creates nine nodes, twelve edges, four cells and four units", () => {
    const board = createStrategicBoard();
    expect(board.nodes).toHaveLength(9);
    expect(board.edges).toHaveLength(12);
    expect(board.cells).toHaveLength(4);
    expect(board.units).toHaveLength(4);
  });

  it("gives Kael a visible opening wall that closes the first blue cell", () => {
    const board = createStrategicBoard();
    expect(strategicBuildTargets(board, "kael")).toContain("s-1-2");
    const closed = strategicClaimEdge(board, "kael", "s-1-2");
    expect(strategicOwnedCellCount(closed, "blue")).toBe(1);
  });

  it("allows a hero to build inside a controlled cell and increases the next action budget", () => {
    let board = createStrategicBoard();
    board = strategicClaimEdge(board, "kael", "s-1-2");
    const cells = strategicStructureTargets(board, "kael");
    expect(cells).toEqual(["sc-0-1"]);
    board = strategicBuildStructure(board, "kael", cells[0], "bastion");
    expect(strategicStructureCount(board, "blue")).toBe(1);
    expect(strategicActionBudget(board, "blue")).toBe(4);
  });

  it("moves units only through owned walls and never into occupied nodes", () => {
    let board = createStrategicBoard();
    board = strategicClaimEdge(board, "kael", "s-1-2");
    expect(strategicMoveTargets(board, "kael")).toContain("s-1-2");
    board = strategicMoveUnit(board, "kael", "s-1-2");
    expect(strategicUnit(board, "kael").nodeId).toBe("s-1-2");
  });

  it("executes a deterministic enemy expansion", () => {
    const board = createStrategicBoard();
    const turn = strategicEnemyTurn(board);
    expect(turn.board).not.toEqual(board);
    expect(turn.message).toContain("rubra");
  });
});
