import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public/strategic-battle-vs33.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/strategic-battle-vs33.css"), "utf8");

describe("VS33 complete turn loop", () => {
  it("loads after VS32", () => {
    expect(index.indexOf("strategic-battle-vs33.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs32.js"));
  });

  it("reads existing UI instead of changing the turn engine", () => {
    expect(js).toContain("SEU TURNO");
    expect(js).toContain("LEGIÃO RUBRA");
    expect(js).toContain("ENCERRAR TURNO");
    expect(js).not.toMatch(/dispatch\(|setState|fetch\(|click\(\)/);
  });

  it("tracks the four existing action budgets", () => {
    for (const label of ["ESTRADA", "MOVER", "BASTIÃO", "ATACAR"]) expect(js).toContain(label);
  });

  it("keeps the guidance layer non interactive and accessible", () => {
    expect(css).toContain("pointer-events:none");
    expect(js).toContain('aria-live');
    expect(css).toContain("prefers-reduced-motion");
  });

  it("hides the turn dock when the real battle result exists", () => {
    expect(js).toContain('.strategic-result');
    expect(js).toContain('dock.hidden !== Boolean(result)');
  });

  it("does not react indefinitely to mutations produced by its own dock", () => {
    expect(js).toContain("function setText");
    expect(js).toContain("shouldRenderFromMutations");
    expect(js).toContain('closest(".strategic-turn-loop-dock")');
    expect(js).toContain("renderingTurnLoop");
  });

  it("prioritizes the same current-player signal already approved in VS32", () => {
    const textRead = js.indexOf("const text = normalizedText(root).toUpperCase()");
    const playerCheck = js.indexOf('text.includes("SEU TURNO")');
    const enemyIndicatorCheck = js.indexOf('root.querySelector(".strategic-enemy-turn-indicator")');
    const rubraCheck = js.indexOf('text.includes("LEGIÃO RUBRA")');
    expect(textRead).toBeGreaterThan(-1);
    expect(playerCheck).toBeGreaterThan(textRead);
    expect(enemyIndicatorCheck).toBeGreaterThan(playerCheck);
    expect(rubraCheck).toBeGreaterThan(enemyIndicatorCheck);
  });
});
