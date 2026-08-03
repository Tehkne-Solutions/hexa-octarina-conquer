import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "public/strategic-battle-vs32.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/strategic-battle-vs32.css"), "utf8");

describe("VS32 turn phase transition contract", () => {
  it("loads after VS31 and remains visual-only", () => {
    expect(index.indexOf("strategic-battle-vs32.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs31.js"));
    expect(index).toContain("strategic-battle-vs32.css");
    expect(script).toContain("MutationObserver");
    expect(script).not.toMatch(/fetch\(|localStorage|sessionStorage|dispatchEvent|click\(/);
  });

  it("does not show a phase card on initial boot", () => {
    expect(script).toContain("if (!initialized)");
    expect(script).toContain("lastPhase = phase");
    expect(script).toContain("return;");
  });

  it("recognizes player and enemy phases without mutating game rules", () => {
    expect(script).toContain('text.includes("SEU TURNO")');
    expect(script).toContain('text.includes("TURNO DA RUBRA")');
    expect(script).toContain('text.includes("LEGIÃO RUBRA")');
    expect(script).not.toMatch(/damage|hp\s*=|pathfinding|winner\s*=|turn\s*=/i);
  });

  it("keeps overlays non interactive and accessible", () => {
    expect(css).toContain("pointer-events:none");
    expect(script).toContain('aria-live');
    expect(css).toContain("prefers-reduced-motion");
  });
});
