import { describe, expect, it } from "vitest";

import { animationAssetId, runtimeSpriteAnimation } from "./RuntimePackSprite";
import { isDefeatedHealthText, runtimeCombatState, runtimeEntityForCombatant } from "./RuntimeAssetOverlay";

describe("Sprint Runtime 02 asset mapping", () => {
  it("builds canonical PACK 99 animation IDs", () => {
    expect(animationAssetId("HERO_GUARDIAN_01", "attack", "SE")).toBe("HERO_GUARDIAN_01_ATTACK_SE_01");
  });

  it("preserves both endpoints of looping spritesheets", () => {
    expect(runtimeSpriteAnimation(4, 6, true)).toBe("runtime-pack-frames 0.6666666666666666s steps(4, jump-none) infinite forwards");
    expect(runtimeSpriteAnimation(1, 6, true)).toBeUndefined();
  });

  it("maps campaign combatants to runtime entities", () => {
    expect(runtimeEntityForCombatant("Kael", "player")).toBe("HERO_GUARDIAN_01");
    expect(runtimeEntityForCombatant("Lyra", "player")).toBe("HERO_RANGER_01");
    expect(runtimeEntityForCombatant("Brakk", "enemy")).toBe("CHAMP_BERSERKER_01");
    expect(runtimeEntityForCombatant("Varg", "enemy")).toBe("UNIT_RECRUIT_01");
  });

  it("detects zero HP with and without the rendered prefix", () => {
    expect(isDefeatedHealthText("HP 0/18")).toBe(true);
    expect(isDefeatedHealthText("0/12")).toBe(true);
    expect(isDefeatedHealthText("HP 7/18")).toBe(false);
  });

  it("maps cinematic beats to attack, hit and defeat", () => {
    expect(runtimeCombatState("player", "player-strike", false)).toBe("attack");
    expect(runtimeCombatState("enemy", "player-strike", false)).toBe("hit");
    expect(runtimeCombatState("enemy", "summary", true)).toBe("defeat");
  });
});
