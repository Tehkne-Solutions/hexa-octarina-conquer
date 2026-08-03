import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const index = readFileSync(new URL("index.html", root), "utf8");
const vs30 = readFileSync(new URL("public/strategic-battle-vs30.js", root), "utf8");
const vs33 = readFileSync(new URL("public/strategic-battle-vs33.js", root), "utf8");
const vs34 = readFileSync(new URL("public/strategic-battle-vs34.js", root), "utf8");
const vs45 = readFileSync(new URL("public/strategic-battle-vs45.js", root), "utf8");

describe("VS46 complete mission flow contract", () => {
  it("loads mission lifecycle after combat, turn loop and objective tracking", () => {
    const order = [
      "strategic-battle-vs30.js",
      "strategic-battle-vs33.js",
      "strategic-battle-vs34.js",
      "strategic-battle-vs45.js",
    ].map((name) => index.indexOf(name));

    for (const position of order) expect(position).toBeGreaterThan(-1);
    expect(order[0]).toBeLessThan(order[3]);
    expect(order[1]).toBeLessThan(order[3]);
    expect(order[2]).toBeLessThan(order[3]);
  });

  it("covers player phase, enemy phase, objective completion and mission resolution", () => {
    for (const state of [
      'state: "player"',
      'state: "enemy"',
      'state: "objectives"',
      'state: "victory"',
      'state: "defeat"',
      'state: "resolved"',
    ]) expect(vs45).toContain(state);

    expect(vs45).toContain("SEU TURNO");
    expect(vs45).toContain("strategic-enemy-turn-indicator");
    expect(vs45).toContain("completed === total");
    expect(vs45).toContain(".strategic-result");
  });

  it("connects the lifecycle to real combat, turn and objective signals", () => {
    expect(vs30).toContain(".strategic-combat-readout");
    expect(vs30).toContain(".strategic-result");
    expect(vs33).toContain(".strategic-turn-loop-dock");
    expect(vs33).toContain("FASE RUBRA");
    expect(vs34).toContain("Estradas");
    expect(vs34).toContain("Regiões");
    expect(vs34).toContain("Bastiões");
    expect(vs34).toContain("Baixas Rubras");
  });

  it("keeps VS45 observational and does not synthesize gameplay actions", () => {
    expect(vs45).not.toMatch(/\.click\(|dispatchEvent|preventDefault|fetch\(|setState|playEdge|playCard|resolveDuelRound/i);
    expect(vs45).toContain("dataset.missionLifecycleState");
  });
});
