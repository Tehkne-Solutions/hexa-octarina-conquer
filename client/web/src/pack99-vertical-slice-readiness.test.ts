import { describe, expect, it } from "vitest";

import { PACK99_STRATEGIC_ASSETS } from "./pack99-strategic-catalog";

const REQUIRED_VERTICAL_SLICE_KEYS = [
  "grass",
  "forest",
  "water",
  "pillar",
  "pillarBlue",
  "pillarRed",
  "edgePreviewNeSw",
  "edgePreviewNwSe",
  "edgeBuiltNeSw",
  "edgeBuiltNwSe",
  "kael",
  "lyra",
  "varg",
  "brakk",
  "bastion",
  "watchtower",
  "sanctuary",
  "ruins",
  "rocks",
  "bridge",
] as const;

describe("PACK 99 vertical slice readiness", () => {
  it("keeps every strategic visual on a canonical runtime id", () => {
    for (const key of REQUIRED_VERTICAL_SLICE_KEYS) {
      const entry = PACK99_STRATEGIC_ASSETS[key];
      expect(entry.id).toBeTruthy();
      expect(entry.id).toBe(entry.id.toUpperCase());
      expect(entry).not.toHaveProperty("physicalFallback");
    }
  });

  it("keeps the four playable combatants mapped to the official runtime aliases", () => {
    expect(PACK99_STRATEGIC_ASSETS.kael.id).toBe("HERO_GUARDIAN_01_IDLE_BASE_SW_01");
    expect(PACK99_STRATEGIC_ASSETS.lyra.id).toBe("HERO_RANGER_01_IDLE_BASE_NE_01");
    expect(PACK99_STRATEGIC_ASSETS.varg.id).toBe("UNIT_RECRUIT_01_IDLE_BASE_NW_01");
    expect(PACK99_STRATEGIC_ASSETS.brakk.id).toBe("CHAMP_BERSERKER_01_IDLE_BASE_NW_01");
  });
});
