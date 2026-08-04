import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gate = readFileSync(new URL("../scripts/visual-pack99-runtime-gate.mjs", import.meta.url), "utf8");

describe("VS51 canonical visual/playable responsibility split", () => {
  it("launches the real campaign and captures the strategic board with PACK 99", () => {
    expect(gate).toContain("launchCampaignMission");
    expect(gate).toContain('launchCampaignMission(page, "qa=1&stable=1&screen=campaign")');
    expect(gate).toContain("battle-player-facing-pack99-1366x768.png");
    expect(gate).toContain("battle runtime images:");
  });

  it("keeps canonical runtime verification in the visual gate", () => {
    expect(gate).toContain("canonical assets:");
    expect(gate).toContain("materialized files:");
    expect(gate).toContain("unresolved references:");
    expect(gate).toContain("PACK99_VISUAL_GATE=PASS");
    expect(gate).toContain("/assets/runtime/");
  });

  it("delegates full playthrough authority to the dedicated acceptance gate", () => {
    expect(gate).toContain("playthrough authority: META 08 Playable Acceptance");
    expect(gate).toContain("visual gate scope: canonical assets + player-facing render evidence");
    expect(gate).not.toContain("runPlaythroughGate(page)");
    expect(gate).not.toContain("MAX_PLAYTHROUGH_STEPS");
  });

  it("preserves player-facing evidence without technical PACK 99 badges", () => {
    expect(gate).toContain("PACK99_PLAYER_TECH_BADGE_VISIBLE");
    expect(gate).toContain("home-pack99-1366x768.png");
    expect(gate).toContain("home-player-facing-pack99-1366x768.png");
    expect(gate).toContain("player-facing technical badge: hidden");
  });
});
