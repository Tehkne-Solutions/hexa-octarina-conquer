import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public/strategic-battle-vs37.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/strategic-battle-vs37.css"), "utf8");

describe("VS37 contextual action confirmation", () => {
  it("loads after VS36", () => {
    expect(index.indexOf("strategic-battle-vs37.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs36.js"));
  });

  it("uses only legal targets exposed by VS35", () => {
    expect(js).toContain("[data-legal-target='true']");
    expect(js).not.toMatch(/fetch\(|click\(|dispatch\(|preventDefault|stopPropagation|pathfind|range\s*=|cost\s*=/i);
  });

  it("supports pointer and keyboard focus without changing actions", () => {
    expect(js).toContain('addEventListener("pointerover"');
    expect(js).toContain('addEventListener("focusin"');
    expect(js).toContain('aria-live');
  });

  it("keeps the confirmation non interactive and reduced-motion safe", () => {
    expect(css).toContain("pointer-events:none");
    expect(css).toContain("prefers-reduced-motion");
  });
});
