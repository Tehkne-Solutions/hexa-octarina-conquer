import { describe, expect, it } from "vitest";

import {
  INITIAL_LIVING_UNITS,
  createLivingTiles,
  isPassableTerrain,
  resolveCombatRound,
  selectedEnergy,
  tileId,
} from "../src/living-board-data";

describe("living board vertical slice", () => {
  it("builds a 7x7 RPG map with a single passable bridge over the river", () => {
    const tiles = createLivingTiles();
    expect(tiles).toHaveLength(49);
    expect(tiles.find((tile) => tile.id === tileId(3, 3))?.terrain).toBe("bridge");
    expect(isPassableTerrain(tiles.find((tile) => tile.id === tileId(3, 2))!.terrain)).toBe(false);
    expect(isPassableTerrain(tiles.find((tile) => tile.id === tileId(3, 3))!.terrain)).toBe(true);
  });

  it("keeps Lyra captive until the mission rescues her", () => {
    const lyra = INITIAL_LIVING_UNITS.find((unit) => unit.id === "lyra");
    expect(lyra?.active).toBe(false);
    expect(lyra?.deck).toContain("lyra-chuva-prismatica");
  });

  it("limits card combinations by energy", () => {
    expect(selectedEnergy(["kael-golpe-runico", "kael-guardiao-celeste"])).toBe(2);
    expect(selectedEnergy(["lyra-chuva-prismatica", "lyra-flecha-eter"])).toBe(4);
  });

  it("resolves attack and defense from cards and unit attributes", () => {
    const kael = INITIAL_LIVING_UNITS.find((unit) => unit.id === "kael")!;
    const raider = INITIAL_LIVING_UNITS.find((unit) => unit.id === "raider-bridge")!;
    const result = resolveCombatRound(
      kael,
      raider,
      ["kael-golpe-runico", "kael-guardiao-celeste"],
      ["raider-machado"],
    );
    expect(result.playerDamage).toBeGreaterThan(0);
    expect(result.enemyDamage).toBeGreaterThan(0);
    expect(result.playerShield).toBeGreaterThan(kael.defense);
    expect(result.log.some((entry) => entry.includes("iniciativa"))).toBe(true);
  });
});
