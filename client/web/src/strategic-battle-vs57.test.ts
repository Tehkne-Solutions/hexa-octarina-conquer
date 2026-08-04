import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../public/strategic-battle-vs57.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/strategic-battle-vs57.css", import.meta.url), "utf8");

describe("VS57 threat consequence readability", () => {
  it("loads after VS56 so opportunity and consequence remain layered", () => {
    expect(index.indexOf("strategic-battle-vs57.css")).toBeGreaterThan(index.indexOf("strategic-battle-vs56.css"));
    expect(index.indexOf("strategic-battle-vs57.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs56.js"));
  });

  it("derives threat only from rendered built roads and canonical Rubra damage", () => {
    expect(runtime).toContain(".strategic-edge.state-road");
    expect(runtime).toContain("Varg: 5");
    expect(runtime).toContain("Brakk: 6");
    expect(runtime).toContain("hasBuiltRoadBetween");
    expect(runtime).toContain("RISCO LETAL");
    expect(runtime).toContain("AMEAÇA");
  });

  it("stays presentation-only and non-interactive", () => {
    expect(runtime).not.toContain("debugTrace");
    expect(runtime).not.toContain("score");
    expect(runtime).not.toContain(".click(");
    expect(runtime).not.toContain("dispatchEvent");
    expect(styles).toContain("pointer-events: none");
  });
});
