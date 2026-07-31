import { describe, expect, it } from "vitest";

import { PACK99_STRATEGIC_ASSETS } from "./pack99-strategic-catalog";

describe("PACK 99 strategic catalog", () => {
  it("uses the four canonical unit aliases materialized by runtime 1.0.1", () => {
    expect(PACK99_STRATEGIC_ASSETS.kael).toEqual({ id: "HERO_GUARDIAN_01_IDLE_BASE_SW_01" });
    expect(PACK99_STRATEGIC_ASSETS.lyra).toEqual({ id: "HERO_RANGER_01_IDLE_BASE_NE_01" });
    expect(PACK99_STRATEGIC_ASSETS.varg).toEqual({ id: "UNIT_RECRUIT_01_IDLE_BASE_NW_01" });
    expect(PACK99_STRATEGIC_ASSETS.brakk).toEqual({ id: "CHAMP_BERSERKER_01_IDLE_BASE_NW_01" });
  });

  it("keeps physical roads and faction pillars in the strategic slice", () => {
    expect(PACK99_STRATEGIC_ASSETS.edgeBuiltNeSw.id).toBe("EDGE_STONE_BUILT_NE_SW_01");
    expect(PACK99_STRATEGIC_ASSETS.edgeBuiltNwSe.id).toBe("EDGE_STONE_BUILT_NW_SE_01");
    expect(PACK99_STRATEGIC_ASSETS.pillarBlue.id).toBe("PILLAR_BLUE_01");
    expect(PACK99_STRATEGIC_ASSETS.pillarRed.id).toBe("PILLAR_RED_01");
  });
});
