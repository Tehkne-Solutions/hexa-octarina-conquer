import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/strategic-battle-vs60.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/strategic-battle-vs60.css", import.meta.url), "utf8");

describe("VS60 tactical clarity consolidation", () => {
  it("loads after the tactical surfaces it consolidates", () => {
    expect(html.indexOf("strategic-battle-vs60.js")).toBeGreaterThan(html.indexOf("strategic-battle-vs59.js"));
    expect(html.indexOf("strategic-battle-vs59.js")).toBeGreaterThan(html.indexOf("strategic-battle-vs58.js"));
    expect(html).toContain("strategic-battle-vs60.css");
  });

  it("keeps one central hierarchy while preserving token microinformation", () => {
    expect(js).toContain("strategic-decision-priority");
    expect(js).toContain("strategic-endgame-pressure");
    expect(js).toContain("has-enemy-intent");
    expect(js).toContain("pressureSurface.hidden = true");
    expect(js).toContain("data-enemy-intent");
  });

  it("remains presentation-only", () => {
    expect(css).toContain("strategic-endgame-pressure[aria-hidden=\"true\"]");
    expect(js).not.toContain("debugTrace");
    expect(js).not.toContain("dispatchEvent");
    expect(js).not.toContain(".click(");
    expect(js).not.toContain("fetch(");
  });
});
