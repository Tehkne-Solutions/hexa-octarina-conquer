import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public/strategic-battle-vs36.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/strategic-battle-vs36.css"), "utf8");

describe("VS36 action option count", () => {
  it("loads after VS35", () => {
    expect(index.indexOf("strategic-battle-vs36.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs35.js"));
  });

  it("counts only targets already marked legal by VS35", () => {
    expect(js).toContain("[data-legal-target='true']");
    expect(js).toContain("targets.length");
    expect(js).not.toMatch(/fetch\(|click\(|dispatch\(|setState|pathfind|range\s*=|cost\s*=/i);
  });

  it("uses only existing action names", () => {
    for (const label of ["CONSTRUIR ESTRADA", "MOVER", "BASTIÃO", "ATACAR"]) expect(js).toContain(label);
  });

  it("stays presentation-only", () => {
    expect(css).toContain("pointer-events:none");
    expect(js).toContain('aria-live');
    expect(css).toContain("prefers-reduced-motion");
    expect(js).not.toContain("preventDefault");
    expect(js).not.toContain("stopPropagation");
  });
});
