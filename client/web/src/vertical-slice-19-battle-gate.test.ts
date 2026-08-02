import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gate = readFileSync(new URL("../scripts/visual-pack99-runtime-gate.mjs", import.meta.url), "utf8");
const strategicSlice = readFileSync(new URL("./StrategicBoardSlice.tsx", import.meta.url), "utf8");

describe("VERTICAL SLICE 19 player-facing battle gate", () => {
  it("launches the real campaign mission instead of validating the synthetic UI14 mock", () => {
    expect(gate).toContain('main.strategic-slice');
    expect(gate).toContain('battle-player-facing-pack99-1366x768.png');
    expect(gate).not.toContain('screen=ui14-gameplay');
  });

  it("requires the real strategic board structure before capturing evidence", () => {
    expect(strategicSlice).toContain('className="strategic-board"');
    expect(strategicSlice).toContain('className="strategic-roster-card');
    expect(gate).toContain('nodes.length >= 9');
    expect(gate).toContain('units.length >= 4');
  });

  it("requires PACK 99 runtime images inside the player-facing battle", () => {
    expect(gate).toContain('main.strategic-slice img');
    expect(gate).toContain('/assets/runtime/');
    expect(gate).toContain('PACK99_BATTLE_RUNTIME_IMAGES');
  });

  it("publishes battle geometry in the canonical manifest", () => {
    expect(gate).toContain('battle strategic nodes:');
    expect(gate).toContain('battle roster units:');
    expect(gate).toContain('battle slice:');
    expect(gate).toContain('battle board:');
  });
});
