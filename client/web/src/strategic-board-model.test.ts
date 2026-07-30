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
  strategicRoadCount,
  strategicStructureCount,
  strategicStructureTargets,
  strategicUnit,
} from "./strategic-board-model";

describe("META 08 readable roads vertical slice", () => {
  it("creates nine nodes, twelve route corridors, four regions and four units", () => {
    const board = createStrategicBoard();
    expect(board.nodes).toHaveLength(9);
    expect(board.edges).toHaveLength(12);
    expect(board.cells).toHaveLength(4);
    expect(board.units).toHaveLength(4);
    expect(board.edges.some((edge) => edge.state === "unbuilt")).toBe(true);
    expect(board.edges.some((edge) => edge.state === "road")).toBe(true);
  });

  it("lets Kael construct the missing road and closes the first blue region", () => {
    const board = createStrategicBoard();
    expect(strategicBuildTargets(board, "kael")).toContain("s-1-2");
    const closed = strategicClaimEdge(board, "kael", "s-1-2");
    expect(strategicOwnedCellCount(closed, "blue")).toBe(1);
    expect(strategicRoadCount(closed, "blue")).toBe(strategicRoadCount(board, "blue") + 1);
  });

  it("allows a hero to build inside a controlled region and increases the next action budget", () => {
    let board = createStrategicBoard();
    board = strategicClaimEdge(board, "kael", "s-1-2");
    const cells = strategicStructureTargets(board, "kael");
    expect(cells).toEqual(["sc-0-1"]);
    board = strategicBuildStructure(board, "kael", cells[0], "bastion");
    expect(strategicStructureCount(board, "blue")).toBe(1);
    expect(strategicActionBudget(board, "blue")).toBe(4);
  });

  it("moves units only through constructed faction roads and never into occupied nodes", () => {
    let board = createStrategicBoard();
    board = strategicClaimEdge(board, "kael", "s-1-2");
    expect(strategicMoveTargets(board, "kael")).toContain("s-1-2");
    board = strategicMoveUnit(board, "kael", "s-1-2");
    expect(strategicUnit(board, "kael").nodeId).toBe("s-1-2");
  });

  it("executes a deterministic enemy road expansion", () => {
    const board = createStrategicBoard();
    const turn = strategicEnemyTurn(board);
    expect(turn.board).not.toEqual(board);
    expect(turn.message).toContain("estrada rubra");
    expect(strategicRoadCount(turn.board, "red")).toBeGreaterThan(strategicRoadCount(board, "red"));
  });
});
