import { describe, expect, it } from "vitest";

import { createMetaBoardModel, metaCellPolygon, metaEdgeId, metaIsoPoint } from "./meta-board-model";

describe("META board foundation", () => {
  it("creates a stable node, edge and cell topology", () => {
    const board = createMetaBoardModel();
    expect(board.nodes).toHaveLength(35);
    expect(board.edges).toHaveLength(58);
    expect(board.cells).toHaveLength(24);
    expect(new Set(board.nodes.map((node) => node.id)).size).toBe(board.nodes.length);
    expect(new Set(board.edges.map((edge) => edge.id)).size).toBe(board.edges.length);
  });

  it("projects logical neighbours to consistent isometric distances", () => {
    const origin = metaIsoPoint(0, 0);
    const east = metaIsoPoint(1, 0);
    const south = metaIsoPoint(0, 1);
    expect(east.x - origin.x).toBe(58);
    expect(east.y - origin.y).toBe(33);
    expect(south.x - origin.x).toBe(-58);
    expect(south.y - origin.y).toBe(33);
  });

  it("uses deterministic edge ids and closed cell polygons", () => {
    expect(metaEdgeId("n-2-1", "n-1-1")).toBe("n-1-1--n-2-1");
    const board = createMetaBoardModel();
    const polygon = metaCellPolygon(board.cells[0]);
    expect(polygon.split(" ")).toHaveLength(4);
    expect(board.cells.some((cell) => cell.owner === "blue")).toBe(true);
    expect(board.cells.some((cell) => cell.owner === "red")).toBe(true);
    expect(board.cells.some((cell) => cell.owner === "violet")).toBe(true);
  });
});
