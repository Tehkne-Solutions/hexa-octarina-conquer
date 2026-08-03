import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public/strategic-battle-vs31.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/strategic-battle-vs31.css"), "utf8");

describe("VS31 enemy turn readability", () => {
  it("loads after combat resolution layers", () => {
    expect(html.indexOf("strategic-battle-vs31.js")).toBeGreaterThan(html.indexOf("strategic-battle-vs30.js"));
  });

  it("derives enemy actors from rendered roster and units", () => {
    expect(js).toContain('rosterNames(root, "owner-red")');
    expect(js).toContain('root.querySelectorAll(".strategic-unit")');
    expect(js).toContain('getAttribute("aria-label")');
  });

  it("does not claim a target when none is present in the canonical message", () => {
    expect(js).toContain("if (target)");
    expect(js).toContain('stage(indicator, "resolving")');
  });

  it("is visual-only and reduced-motion safe", () => {
    expect(css).toContain("pointer-events:none");
    expect(css).toContain("prefers-reduced-motion");
  });
});
