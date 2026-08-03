import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public/strategic-battle-vs38.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/strategic-battle-vs38.css"), "utf8");

describe("VS38 active unit to target link", () => {
  it("loads after VS37", () => {
    expect(index.indexOf("strategic-battle-vs38.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs37.js"));
  });

  it("derives origin and target only from rendered runtime state", () => {
    expect(js).toContain("UNIDADE ATIVA");
    expect(js).toContain("[data-legal-target='true']");
    expect(js).toContain(".strategic-unit");
  });

  it("reacts only to hover and focus signals", () => {
    for (const event of ["pointerover", "pointerout", "focusin", "focusout"]) expect(js).toContain(event);
    expect(js).not.toMatch(/click\(|dispatch\(|fetch\(|preventDefault|stopPropagation|pathfind|range\s*=|cost\s*=/i);
  });

  it("keeps the connector visual only", () => {
    expect(css).toContain("pointer-events:none");
    expect(css).toContain("prefers-reduced-motion");
    expect(js).toContain("createElementNS");
  });
});
