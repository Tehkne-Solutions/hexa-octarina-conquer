import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gate = readFileSync(new URL("../scripts/visual-pack99-runtime-gate.mjs", import.meta.url), "utf8");

describe("VS49 canonical browser playthrough gate", () => {
  it("launches the real campaign before driving the strategic board", () => {
    expect(gate).toContain("launchCampaignMission");
    expect(gate).toContain("runPlaythroughGate");
    expect(gate).toContain("battleSnapshot");

    const mainStart = gate.indexOf("async function main()");
    const mainBody = gate.slice(mainStart);
    const missionLaunch = mainBody.indexOf('launchCampaignMission(page, "qa=1&stable=1&screen=campaign")');
    const playthroughRun = mainBody.indexOf("runPlaythroughGate(page)");
    expect(mainStart).toBeGreaterThan(-1);
    expect(missionLaunch).toBeGreaterThan(-1);
    expect(playthroughRun).toBeGreaterThan(missionLaunch);
  });

  it("uses only real enabled strategic controls", () => {
    expect(gate).toContain(".strategic-unit.is-attack-target:not(:disabled)");
    expect(gate).toContain(".strategic-edge.is-recommended:not(:disabled)");
    expect(gate).toContain(".strategic-node.is-recommended:not(:disabled)");
    expect(gate).toContain(".strategic-cell.is-build-target:not(:disabled)");
    expect(gate).toContain(".strategic-end-turn:not(:disabled)");
  });

  it("requires player activity, enemy execution and a terminal state", () => {
    expect(gate).toContain('path.includes("player")');
    expect(gate).toContain("endTurns > 0");
    expect(gate).toContain("TERMINAL_STATES.has(snapshot.lifecycle)");
    expect(gate).toContain('"enemy-executed"');
  });

  it("captures final evidence and bounded diagnostics", () => {
    expect(gate).toContain("MAX_PLAYTHROUGH_STEPS = 96");
    expect(gate).toContain("PACK99_PLAYTHROUGH_STALLED");
    expect(gate).toContain("PACK99_PLAYTHROUGH_STEP_LIMIT");
    expect(gate).toContain("battle-playthrough-final-pack99-1366x768.png");
    expect(gate).toContain("playthrough enemy turns:");
    expect(gate).toContain("playthrough path:");
  });
});
