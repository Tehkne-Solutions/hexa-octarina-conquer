import { describe, expect, it } from "vitest";

import { PACK99_STRATEGIC_ASSETS } from "./pack99-strategic-catalog";

describe("PACK 99 strategic catalog", () => {
  it("resolves the four canonical units through runtime registry aliases", () => {
    expect(PACK99_STRATEGIC_ASSETS.kael).toEqual({
      id: "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
    });
    expect(PACK99_STRATEGIC_ASSETS.lyra).toEqual({
      id: "HERO_RANGER_01_IDLE_BASE_NE_01",
    });
    expect(PACK99_STRATEGIC_ASSETS.varg).toEqual({
      id: "UNIT_RECRUIT_01_IDLE_BASE_NW_01",
    });
    expect(PACK99_STRATEGIC_ASSETS.brakk).toEqual({
      id: "CHAMP_BERSERKER_01_IDLE_BASE_NW_01",
    });

    for (const key of ["kael", "lyra", "varg", "brakk"] as const) {
      expect(PACK99_STRATEGIC_ASSETS[key]).not.toHaveProperty("physicalFallback");
    }
  });

  it("keeps physical roads and faction pillars in the strategic slice", () => {
    expect(PACK99_STRATEGIC_ASSETS.edgeBuiltNeSw.id).toBe("EDGE_STONE_BUILT_NE_SW_01");
    expect(PACK99_STRATEGIC_ASSETS.edgeBuiltNwSe.id).toBe("EDGE_STONE_BUILT_NW_SE_01");
    expect(PACK99_STRATEGIC_ASSETS.pillarBlue.id).toBe("PILLAR_BLUE_01");
    expect(PACK99_STRATEGIC_ASSETS.pillarRed.id).toBe("PILLAR_RED_01");
  });
});
