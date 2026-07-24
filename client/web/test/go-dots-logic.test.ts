import { describe, expect, it } from "vitest";

import {
  canonicalEdgeId,
  deriveClaimedCells,
  registerInfluenceEdge,
  type InfluenceEdge,
} from "../src/go-dots-logic";

describe("Go+Dots territory logic", () => {
  it("normalizes edge direction", () => {
    expect(canonicalEdgeId({ x: 1, y: 0 }, { x: 0, y: 0 })).toBe("0,0|1,0");
  });

  it("closes a cell when all four borders belong to the same faction", () => {
    let edges: InfluenceEdge[] = [];
    edges = registerInfluenceEdge(edges, { x: 0, y: 0 }, { x: 1, y: 0 }, "player");
    edges = registerInfluenceEdge(edges, { x: 1, y: 0 }, { x: 1, y: 1 }, "player");
    edges = registerInfluenceEdge(edges, { x: 1, y: 1 }, { x: 0, y: 1 }, "player");
    edges = registerInfluenceEdge(edges, { x: 0, y: 1 }, { x: 0, y: 0 }, "player");

    expect(deriveClaimedCells(edges, 3)).toEqual([{ id: "0,0", x: 0, y: 0, owner: "player" }]);
  });

  it("marks a route as contested when both factions use it", () => {
    let edges: InfluenceEdge[] = [];
    edges = registerInfluenceEdge(edges, { x: 0, y: 0 }, { x: 1, y: 0 }, "player");
    edges = registerInfluenceEdge(edges, { x: 1, y: 0 }, { x: 0, y: 0 }, "enemy");
    expect(edges[0]?.owner).toBe("contested");
  });
});
