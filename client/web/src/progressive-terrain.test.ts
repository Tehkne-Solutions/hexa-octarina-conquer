import { describe, expect, it } from "vitest";

import { progressiveTerrainCenterAssetId } from "./progressive-terrain";

describe("PACK 01 progressive terrain mapping", () => {
  it("maps landmarks to canonical terrain families", () => {
    expect(progressiveTerrainCenterAssetId("orun-mill", "grass", 0, 0)).toBe("TILE_GRASS_FLAT_CENTER_A_01");
    expect(progressiveTerrainCenterAssetId("orun-mill", "forest", 0, 0)).toBe("TILE_FOREST_FLAT_CENTER_A_01");
    expect(progressiveTerrainCenterAssetId("orun-mill", "river", 0, 0)).toBe("TILE_WATER_FLAT_CENTER_A_01");
    expect(progressiveTerrainCenterAssetId("prismatic-ruins", "ruins", 0, 0)).toBe("TILE_RUNIC_FLAT_CENTER_A_01");
    expect(progressiveTerrainCenterAssetId("ash-fortress", "mountain", 0, 0)).toBe("TILE_LAVA_FLAT_CENTER_A_01");
  });

  it("rotates deterministic A B C center variants", () => {
    const values = new Set([
      progressiveTerrainCenterAssetId("orun-mill", "grass", 0, 0),
      progressiveTerrainCenterAssetId("orun-mill", "grass", 1, 0),
      progressiveTerrainCenterAssetId("orun-mill", "grass", 0, 1),
    ]);
    expect(values).toEqual(new Set([
      "TILE_GRASS_FLAT_CENTER_A_01",
      "TILE_GRASS_FLAT_CENTER_B_01",
      "TILE_GRASS_FLAT_CENTER_C_01",
    ]));
  });
});
