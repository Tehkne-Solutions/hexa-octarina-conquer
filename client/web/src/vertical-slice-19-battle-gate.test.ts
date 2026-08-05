import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gate = readFileSync(new URL("../scripts/visual-pack99-runtime-gate.mjs", import.meta.url), "utf8");
const qaCombat = readFileSync(new URL("./SprintUi14GameplayQa.tsx", import.meta.url), "utf8");

describe("VERTICAL SLICE 19 player-facing battle gate", () => {
  it("uses the deterministic card-combat QA scene for static visual evidence", () => {
    expect(gate).toContain("main.ui14-qa-combat");
    expect(gate).toContain("combat-player-facing-pack99-1366x768.png");
    expect(gate).toContain("screen=ui14-combat-selection");
  });

  it("requires the direct combat structure before capturing evidence", () => {
    expect(qaCombat).toContain('className="living-battle-overlay"');
    expect(qaCombat).toContain('className="tcg-hand"');
    expect(gate).toContain("cards.length >= 4");
    expect(gate).toContain("fighters.length >= 2");
  });

  it("requires PACK 99 runtime images inside the player-facing combat scene", () => {
    expect(gate).toContain("main.ui14-qa-combat img");
    expect(gate).toContain("/assets/runtime/");
    expect(gate).toContain("PACK99_COMBAT_RUNTIME_IMAGES");
  });

  it("publishes combat geometry and card evidence in the canonical manifest", () => {
    expect(gate).toContain("combat cards:");
    expect(gate).toContain("combat selected cards:");
    expect(gate).toContain("combat fighters:");
    expect(gate).toContain("combat scene:");
    expect(gate).toContain("combat overlay:");
  });
});
