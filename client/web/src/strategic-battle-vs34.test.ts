import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public/strategic-battle-vs34.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/strategic-battle-vs34.css"), "utf8");

describe("VS34 mission progress feedback", () => {
  it("loads after VS33", () => {
    expect(index.indexOf("strategic-battle-vs34.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs33.js"));
  });

  it("tracks the four real mission counters", () => {
    for (const label of ["Estradas", "Regiões", "Bastiões", "Baixas Rubras"]) expect(js).toContain(label);
  });

  it("does not duplicate mission rules or trigger actions", () => {
    expect(js).not.toMatch(/fetch\(|click\(|dispatch\(|setState|victory\s*=|target\s*[+\-*/]=/);
    expect(js).toContain("objective.current >= objective.target");
  });

  it("snapshots initial state and only reports positive progress", () => {
    expect(js.indexOf("if (!initialized)")).toBeLessThan(js.indexOf("showProgress(board"));
    expect(js).toContain("objective.current <= previous");
  });

  it("ignores mutations produced by its own transient layer", () => {
    expect(js).toContain('closest(".strategic-mission-progress-layer")');
  });

  it("keeps feedback non interactive and reduced-motion safe", () => {
    expect(css).toContain("pointer-events:none");
    expect(css).toContain("prefers-reduced-motion");
    expect(js).toContain('aria-live');
  });
});
