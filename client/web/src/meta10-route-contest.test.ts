import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicEdgeId,
  strategicOwnedCellCount,
  type StrategicBoard,
} from "./strategic-board-model";
import { strategicContestRoute, strategicContestTargets } from "./strategic-route-contest";

function withOwnedRoad(
  board: StrategicBoard,
  a: string,
  b: string,
  owner: "red" | "blue",
): StrategicBoard {
  const id = strategicEdgeId(a, b);
  return {
    ...board,
    edges: board.edges.map((edge) => edge.id === id
      ? { ...edge, owner, state: "road" as const }
      : edge),
  };
}

describe("META 10.14 contested strategic routes", () => {
  it("exposes only adjacent enemy-owned roads as contest targets", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => unit.id === "varg"
        ? { ...unit, nodeId: "s-1-1" }
        : unit),
    };
    board = withOwnedRoad(board, "s-1-1", "s-1-0", "blue");
    board = withOwnedRoad(board, "s-1-1", "s-2-1", "red");

    expect(strategicContestTargets(board, "varg")).toContain("s-1-0");
    expect(strategicContestTargets(board, "varg")).not.toContain("s-2-1");
  });

  it("lets a faction retake the final blocked perimeter edge and close a region", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => unit.id === "varg"
        ? { ...unit, nodeId: "s-1-1" }
        : unit),
    };

    board = withOwnedRoad(board, "s-1-0", "s-2-0", "red");
    board = withOwnedRoad(board, "s-2-0", "s-2-1", "red");
    board = withOwnedRoad(board, "s-2-1", "s-1-1", "red");
    board = withOwnedRoad(board, "s-1-1", "s-1-0", "blue");

    expect(strategicOwnedCellCount(board, "red")).toBe(0);

    board = strategicContestRoute(board, "varg", "s-1-0");

    expect(strategicOwnedCellCount(board, "red")).toBe(1);
    expect(board.edges.find((edge) => edge.id === strategicEdgeId("s-1-1", "s-1-0"))?.owner).toBe("red");
  });
});
