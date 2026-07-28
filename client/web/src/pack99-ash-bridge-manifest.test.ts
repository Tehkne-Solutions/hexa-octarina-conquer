import { describe, expect, it } from "vitest";

import {
  ASH_BRIDGE_RESOURCES,
  ASH_BRIDGE_TERRAIN,
  ASH_BRIDGE_UNITS,
  type Pack99MissionAssetRef,
} from "./pack99-ash-bridge-manifest";

function references(): Pack99MissionAssetRef[] {
  return [
    ...Object.values(ASH_BRIDGE_TERRAIN),
    ...Object.values(ASH_BRIDGE_RESOURCES),
    ...Object.values(ASH_BRIDGE_UNITS),
  ];
}

describe("Ash Bridge canonical PACK 99 contract", () => {
  it("declara ID canônico para cada terreno, recurso e unidade", () => {
    for (const reference of references()) {
      expect(reference.canonicalId).toMatch(/^[A-Z0-9_]+$/);
      expect(reference.sourceSuffixes.length).toBeGreaterThan(0);
      expect(reference.sourceSuffixes[0]).toContain(reference.canonicalId);
    }
  });

  it("não reutiliza o Guardião para Ranger, Recruta ou Berserker", () => {
    expect(ASH_BRIDGE_UNITS.kael.canonicalId).toBe("HERO_GUARDIAN_01_IDLE_BASE_SW_01");
    expect(ASH_BRIDGE_UNITS.lyra.canonicalId).toBe("HERO_RANGER_01_IDLE_BASE_NE_01");
    expect(ASH_BRIDGE_UNITS["raider-bridge"].canonicalId).toBe("UNIT_RECRUIT_01_IDLE_BASE_NW_01");
    expect(ASH_BRIDGE_UNITS["raider-mill"].canonicalId).toBe("CHAMP_BERSERKER_01_IDLE_BASE_NW_01");
    expect(new Set(Object.values(ASH_BRIDGE_UNITS).map((reference) => reference.canonicalId)).size).toBe(4);
  });

  it("não reutiliza grama para floresta ou água", () => {
    expect(ASH_BRIDGE_TERRAIN.grass.canonicalId).toBe("TILE_GRASS_FLAT_CENTER_A_01");
    expect(ASH_BRIDGE_TERRAIN.forest.canonicalId).toBe("TILE_FOREST_FLAT_CENTER_A_01");
    expect(ASH_BRIDGE_TERRAIN.river.canonicalId).toBe("TILE_WATER_FLAT_CENTER_A_01");
    expect(new Set([
      ASH_BRIDGE_TERRAIN.grass.canonicalId,
      ASH_BRIDGE_TERRAIN.forest.canonicalId,
      ASH_BRIDGE_TERRAIN.river.canonicalId,
    ]).size).toBe(3);
  });

  it("usa nós finais próprios para madeira, alimento e octarina", () => {
    expect(ASH_BRIDGE_RESOURCES.wood.canonicalId).toBe("RES_WOOD_ABUNDANT_01");
    expect(ASH_BRIDGE_RESOURCES.food.canonicalId).toBe("RES_FOOD_ABUNDANT_01");
    expect(ASH_BRIDGE_RESOURCES.crystal.canonicalId).toBe("RES_OCTARINE_CRYSTAL_ABUNDANT_01");
  });
});
