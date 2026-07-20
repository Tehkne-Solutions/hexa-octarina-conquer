import { describe, expect, it } from "vitest";

import { canonicalEdge, isAdjacent } from "./protocol";

describe("web protocol helpers", () => {
  it("canonicalizes an edge independently of tap order", () => {
    expect(canonicalEdge([1, 0], [0, 0])).toBe("0,0|1,0");
    expect(canonicalEdge([0, 0], [1, 0])).toBe("0,0|1,0");
  });

  it("accepts only orthogonally adjacent points", () => {
    expect(isAdjacent([0, 0], [1, 0])).toBe(true);
    expect(isAdjacent([0, 0], [0, 1])).toBe(true);
    expect(isAdjacent([0, 0], [1, 1])).toBe(false);
    expect(isAdjacent([0, 0], [2, 0])).toBe(false);
  });
});
