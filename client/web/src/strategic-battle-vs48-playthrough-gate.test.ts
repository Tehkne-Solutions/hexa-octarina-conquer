import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gate = readFileSync(new URL("../scripts/visual-pack99-runtime-gate.mjs", import.meta.url), "utf8");

describe("VS48 canonical complete playthrough gate", () => {
  it("launches the real campaign and starts the opt-in runner only after battle load", () => {
    expect(gate).toContain("launchCampaignMission");
    expect(gate).toContain("runPlaythroughGate");
    expect(gate).toContain('new Event("hoc:playtest-start")');
    expect(gate.indexOf('launchCampaignMission(page, "qa=1&stable=1&screen=campaign")')).toBeLessThan(gate.indexOf("runPlaythroughGate(page)"));
  });

  it("requires both runner completion and complete mission trace", () => {
    expect(gate).toContain('root?.dataset.playtestRunner === "complete"');
    expect(gate).toContain('root?.dataset.missionPlaythrough === "complete"');
    expect(gate).toContain('result.runner === "complete"');
    expect(gate).toContain('result.missionPlaythrough === "complete"');
  });

  it("requires player, enemy and terminal lifecycle evidence", () => {
    expect(gate).toContain('missionPath?.includes("player")');
    expect(gate).toContain('missionPath?.includes("enemy")');
    expect(gate).toContain('["victory", "defeat", "resolved"].includes(result.terminal)');
  });

  it("captures final evidence and records diagnostics in the manifest", () => {
    expect(gate).toContain("battle-playthrough-final-pack99-1366x768.png");
    expect(gate).toContain("playthrough terminal:");
    expect(gate).toContain("playthrough steps:");
    expect(gate).toContain("playthrough path:");
  });
});
