import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicPreferredStructure,
  type StrategicBoard,
} from "./strategic-board-model";

function withOwnedCells(board: StrategicBoard, cellIds: string[]): StrategicBoard {
  return {
    ...board,
    cells: board.cells.map((cell) => cellIds.includes(cell.id)
      ? { ...cell, owner: "red" as const, structure: null }
      : cell),
  };
}

describe("META 10.9 AI structure strategy", () => {
  it("fortifies the owned cell closest to the active enemy front", () => {
    let board = createStrategicBoard();
    board = withOwnedCells(board, ["sc-0-0", "sc-1-0"]);
    board = {
      ...board,
      units: board.units.map((unit) => {
        if (unit.id === "varg") return { ...unit, nodeId: "s-1-1" };
        if (unit.id === "kael") return { ...unit, nodeId: "s-2-0" };
        return unit;
      }),
    };

    expect(strategicPreferredStructure(board, "varg")).toBe("sc-1-0");
  });

  it("preserves a critical unit instead of spending its action on a structure", () => {
    let board = createStrategicBoard();
    board = withOwnedCells(board, ["sc-1-0"]);
    board = {
      ...board,
      units: board.units.map((unit) => unit.id === "varg"
        ? { ...unit, nodeId: "s-1-1", hp: 4 }
        : unit),
    };

    expect(strategicPreferredStructure(board, "varg")).toBeNull();
  });

  it("stops building towers after structures already provide the maximum action budget", () => {
    let board = createStrategicBoard();
    board = withOwnedCells(board, ["sc-0-0", "sc-1-0", "sc-0-1", "sc-1-1"]);
    board = {
      ...board,
      cells: board.cells.map((cell) => {
        if (cell.id === "sc-0-1" || cell.id === "sc-1-1") {
          return { ...cell, structure: { type: "watchtower" as const, owner: "red" as const } };
        }
        return cell;
      }),
      units: board.units.map((unit) => unit.id === "varg"
        ? { ...unit, nodeId: "s-1-1" }
        : unit),
    };

    expect(strategicPreferredStructure(board, "varg")).toBeNull();
  });
});
