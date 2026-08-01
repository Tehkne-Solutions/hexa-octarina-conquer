import { describe, expect, it } from "vitest";

import { strategicBestGlobalAction, strategicGlobalActionCandidates } from "./strategic-ai-global-action";
import { createStrategicBoard, strategicEdgeId, type StrategicBoard } from "./strategic-board-model";

function withRoad(board: StrategicBoard, a: string, b: string, owner: "red" | "blue" = "red"): StrategicBoard {
  const id = strategicEdgeId(a, b);
  return {
    ...board,
    edges: board.edges.map((edge) => edge.id === id
      ? { ...edge, owner, state: "road" as const }
      : edge),
  };
}

describe("META 10.10 global AI action scoring", () => {
  it("prefers an immediate attack over passive expansion", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => {
        if (unit.id === "varg") return { ...unit, nodeId: "s-1-1" };
        if (unit.id === "kael") return { ...unit, nodeId: "s-1-0", hp: 10 };
        return unit;
      }),
    };
    board = withRoad(board, "s-1-1", "s-1-0");

    const best = strategicBestGlobalAction(board);

    expect(best?.kind).toBe("attack");
    expect(best?.unitId).toBe("varg");
    expect(best?.targetId).toBe("kael");
  });

  it("elevates a territory-closing road above ordinary movement", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => unit.id === "varg"
        ? { ...unit, nodeId: "s-1-1" }
        : unit),
    };
    board = withRoad(board, "s-1-0", "s-2-0");
    board = withRoad(board, "s-2-0", "s-2-1");
    board = withRoad(board, "s-2-1", "s-1-1");

    const candidates = strategicGlobalActionCandidates(board);
    const closingBuild = candidates.find((candidate) => candidate.kind === "build");
    const move = candidates.find((candidate) => candidate.kind === "move");

    expect(closingBuild).toBeDefined();
    expect(closingBuild?.score ?? 0).toBeGreaterThan(move?.score ?? 0);
  });

  it("raises retreat priority for a critical unit when no attack is available", () => {
    let board = createStrategicBoard();
    board = {
      ...board,
      units: board.units.map((unit) => {
        if (unit.id === "varg") return { ...unit, nodeId: "s-1-0", hp: 4 };
        if (unit.id === "kael") return { ...unit, nodeId: "s-0-2" };
        if (unit.id === "lyra") return { ...unit, nodeId: "s-0-1" };
        return unit;
      }),
    };
    board = withRoad(board, "s-1-0", "s-2-0");

    const candidates = strategicGlobalActionCandidates(board);
    const retreat = candidates.find((candidate) => candidate.kind === "move" && candidate.unitId === "varg");

    expect(retreat?.score).toBe(72);
    expect(retreat?.reason).toContain("preserva unidade crítica");
  });
});
