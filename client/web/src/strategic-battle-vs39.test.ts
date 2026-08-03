import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public/strategic-battle-vs39.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/strategic-battle-vs39.css"), "utf8");

describe("VS39 touch action intent", () => {
  it("loads after VS38", () => {
    expect(index.indexOf("strategic-battle-vs39.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs38.js"));
  });

  it("uses only legal targets already exposed by VS35", () => {
    expect(js).toContain("[data-legal-target='true']");
    expect(js).toContain('event.pointerType === "touch"');
    expect(js).toContain('event.pointerType === "pen"');
  });

  it("does not interfere with the real action", () => {
    expect(js).not.toMatch(/preventDefault|stopPropagation|\.click\(|dispatchEvent|fetch\(|pathfind|range\s*=|cost\s*=/i);
    expect(css).toContain("pointer-events:none");
  });

  it("clears transient feedback automatically", () => {
    expect(js).toContain("window.setTimeout");
    expect(js).toContain("clearTouchIntent");
  });

  it("is reduced-motion safe", () => {
    expect(css).toContain("prefers-reduced-motion");
  });
});
