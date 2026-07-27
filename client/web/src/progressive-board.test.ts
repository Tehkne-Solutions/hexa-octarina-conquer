import { describe, expect, it } from "vitest";

import {
  progressiveEdgeAssetId,
  progressivePillarAssetId,
  progressiveTerritoryAssetId,
} from "./progressive-board";
import {
  progressiveBoardMidpoint,
  progressiveBoardPosition,
  progressiveBoardSvgPosition,
} from "./progressive-board-projection";

describe("PACK 02 progressive board mapping", () => {
  it("prioritizes pillar interaction states", () => {
    expect(progressivePillarAssetId({ selected: false, valid: false, recommended: false, disabled: true })).toBe("PILLAR_BLOCKED_01");
    expect(progressivePillarAssetId({ selected: true, valid: true, recommended: true, disabled: false })).toBe("PILLAR_SELECTED_01");
    expect(progressivePillarAssetId({ selected: false, valid: true, recommended: false, disabled: false })).toBe("PILLAR_ENERGIZED_01");
    expect(progressivePillarAssetId({ selected: false, valid: false, recommended: false, disabled: false, faction: "player" })).toBe("PILLAR_BLUE_01");
    expect(progressivePillarAssetId({ selected: false, valid: false, recommended: false, disabled: false, faction: "enemy" })).toBe("PILLAR_RED_01");
    expect(progressivePillarAssetId({ selected: false, valid: false, recommended: false, disabled: false })).toBe("PILLAR_NEUTRAL_01");
  });

  it("maps owner and logical direction to canonical edges", () => {
    expect(progressiveEdgeAssetId("player", { x: 0, y: 0 }, { x: 1, y: 0 })).toBe("EDGE_ARCANE_BUILT_NW_SE_01");
    expect(progressiveEdgeAssetId("enemy", { x: 0, y: 0 }, { x: 0, y: 1 })).toBe("EDGE_STONE_BUILT_NE_SW_01");
    expect(progressiveEdgeAssetId("contested", { x: 1, y: 1 }, { x: 2, y: 1 })).toBe("EDGE_WOOD_BUILT_NW_SE_01");
  });

  it("clamps territory progression to the five canonical stages", () => {
    expect(progressiveTerritoryAssetId(0, "player")).toBe("TERR_SIGIL_BLUE_01");
    expect(progressiveTerritoryAssetId(2, "enemy")).toBe("TERR_CAMP_RED_01");
    expect(progressiveTerritoryAssetId(5, "player")).toBe("TERR_CITADEL_BLUE_01");
    expect(progressiveTerritoryAssetId(99, "enemy")).toBe("TERR_CITADEL_RED_01");
  });
});

describe("progressive isometric projection", () => {
  it("projects the board origin and diagonal deterministically", () => {
    const origin = progressiveBoardPosition(0, 0);
    const east = progressiveBoardPosition(1, 0);
    const south = progressiveBoardPosition(0, 1);
    expect(origin.left).toBeCloseTo(50);
    expect(origin.top).toBeCloseTo(15);
    expect(east.left).toBeCloseTo(57.1);
    expect(east.top).toBeCloseTo(20.35);
    expect(south.left).toBeCloseTo(42.9);
    expect(south.top).toBeCloseTo(20.35);
  });

  it("uses the same projection for SVG and sprite midpoints", () => {
    const svg = progressiveBoardSvgPosition(1, 2);
    const midpoint = progressiveBoardMidpoint({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(svg.x).toBeCloseTo(429);
    expect(svg.y).toBeCloseTo(310.5);
    expect(midpoint.left).toBeCloseTo(53.55);
    expect(midpoint.top).toBeCloseTo(17.675);
  });
});
