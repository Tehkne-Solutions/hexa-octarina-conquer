import { describe, expect, it } from "vitest";

import { buildTacticalHighlights, classifyImpact } from "./BattlePresentationLayer";
import { classifyUnitVisualState } from "./FantasyUnitSprite";

describe("Sprint UI 08 presentation rules", () => {
  it("classifies final unit visual states in priority order", () => {
    const base = { hp: 10, maxHp: 10, defeated: false, active: true };
    expect(classifyUnitVisualState(base, false)).toBe("neutral");
    expect(classifyUnitVisualState(base, true)).toBe("selected");
    expect(classifyUnitVisualState({ ...base, hp: 4 }, true)).toBe("wounded");
    expect(classifyUnitVisualState({ ...base, active: false }, true)).toBe("captive");
    expect(classifyUnitVisualState({ ...base, hp: 0, defeated: true }, true)).toBe("defeated");
  });

  it("maps damage into restrained impact tiers", () => {
    expect(classifyImpact(1)).toBe("light");
    expect(classifyImpact(3)).toBe("medium");
    expect(classifyImpact(6)).toBe("heavy");
  });

  it("keeps tactical highlights unique and bounded", () => {
    expect(buildTacticalHighlights([
      "Kael criou uma trilha.",
      "Kael criou uma trilha.",
      "Lyra protegeu o nó.",
      "Brakk foi derrotado.",
      "O moinho foi ocupado.",
    ], "victory")).toEqual([
      "Kael criou uma trilha.",
      "Lyra protegeu o nó.",
      "Brakk foi derrotado.",
    ]);
  });

  it("provides useful cinematic fallbacks", () => {
    expect(buildTacticalHighlights([], "victory").length).toBeGreaterThan(0);
    expect(buildTacticalHighlights([], "defeat").join(" ")).toContain("liberdades");
  });
});
