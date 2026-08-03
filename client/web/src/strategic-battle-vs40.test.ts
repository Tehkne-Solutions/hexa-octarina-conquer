import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../public/strategic-battle-vs40.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("VS40 action budget feedback contract", () => {
  it("derives feedback only from rendered budget decreases", () => {
    expect(source).toContain("strategic-turn-loop-budget");
    expect(source).toContain("after < before");
    expect(source).toContain("lastBudget = next");
  });

  it("does not mutate strategic rules or synthesize actions", () => {
    expect(source).not.toContain("preventDefault");
    expect(source).not.toContain("dispatchEvent");
    expect(source).not.toContain(".click(");
    expect(source).not.toContain("fetch(");
  });

  it("loads after the turn-loop dock", () => {
    expect(index.indexOf("strategic-battle-vs40.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs33.js"));
  });
});
