import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicActionBudget,
  strategicAttackTargets,
  strategicBuildStructure,
  strategicBuildTargets,
  strategicCellRoadProgress,
  strategicClaimEdge,
  strategicEnemyTurn,
  strategicMoveTargets,
  strategicMoveUnit,
  strategicOwnedCellCount,
  strategicResult,
  strategicRoadCount,
  strategicStructureCount,
  strategicStructureTargets,
  strategicUnit,
} from "./strategic-board-model";

describe("META 08 readable road network", () => {
  it("creates nine named nodes, twelve routes, four named regions and four units", () => {
    const board = createStrategicBoard();
    expect(board.nodes).toHaveLength(9);
    expect(board.nodes.every((node) => node.name.length > 0)).toBe(true);
    expect(board.edges).toHaveLength(12);
    expect(board.cells).toHaveLength(4);
    expect(board.cells.every((cell) => cell.name.length > 0)).toBe(true);
    expect(board.units).toHaveLength(4);
  });

  it("starts with a partially formed frontier instead of an almost completed map", () => {
    const board = createStrategicBoard();
    expect(strategicRoadCount(board, "blue")).toBe(2);
    expect(strategicRoadCount(board, "red")).toBe(2);
    expect(strategicOwnedCellCount(board, "blue")).toBe(0);
    expect(strategicOwnedCellCount(board, "red")).toBe(0);
  });

  it("builds, moves and closes the first Orun region across three actions", () => {
    let board = createStrategicBoard();

    expect(strategicBuildTargets(board, "kael")).toContain("s-1-2");
    board = strategicClaimEdge(board, "kael", "s-1-2");
    expect(strategicMoveTargets(board, "kael")).toContain("s-1-2");

    board = strategicMoveUnit(board, "kael", "s-1-2");
    expect(strategicUnit(board, "kael").nodeId).toBe("s-1-2");

    expect(strategicBuildTargets(board, "kael")).toContain("s-0-2");
    board = strategicClaimEdge(board, "kael", "s-0-2");

    expect(strategicOwnedCellCount(board, "blue")).toBe(1);
    expect(strategicCellRoadProgress(board, "sc-0-1", "blue")).toBe(4);
  });

  it("allows a bastion only after a region is closed and increases the next action budget", () => {
    let board = createStrategicBoard();
    expect(strategicStructureTargets(board, "kael")).toEqual([]);

    board = strategicClaimEdge(board, "kael", "s-1-2");
    board = strategicMoveUnit(board, "kael", "s-1-2");
    board = strategicClaimEdge(board, "kael", "s-0-2");

    expect(strategicStructureTargets(board, "kael")).toEqual(["sc-0-1"]);
    board = strategicBuildStructure(board, "kael", "sc-0-1", "bastion");

    expect(strategicStructureCount(board, "blue")).toBe(1);
    expect(strategicActionBudget(board, "blue")).toBe(4);
  });

  it("never attacks across an unbuilt corridor", () => {
    const board = createStrategicBoard();
    expect(strategicAttackTargets(board, "brakk")).toEqual([]);
    expect(strategicAttackTargets(board, "lyra")).toEqual([]);
  });

  it("spends the enemy action budget on deterministic expansion and movement", () => {
    const board = createStrategicBoard();
    const turn = strategicEnemyTurn(board);

    expect(turn.board).not.toEqual(board);
    expect(turn.message.toLowerCase()).toContain("rede rubra");
    expect(strategicActionBudget(board, "red")).toBe(3);
    expect(strategicRoadCount(turn.board, "red")).toBe(4);
    expect(strategicUnit(turn.board, "varg").nodeId).toBe("s-1-0");
  });

  it("does not declare victory from territory alone without a real confrontation", () => {
    let board = createStrategicBoard();
    board = strategicClaimEdge(board, "kael", "s-1-2");
    board = strategicMoveUnit(board, "kael", "s-1-2");
    board = strategicClaimEdge(board, "kael", "s-0-2");
    board = strategicBuildStructure(board, "kael", "sc-0-1", "bastion");
    expect(strategicResult(board)).toBe("playing");
  });
});
