import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "public/strategic-battle-vs35.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/strategic-battle-vs35.css"), "utf8");

describe("VS35 legal target clarity", () => {
  it("loads after VS34", () => {
    expect(index.indexOf("strategic-battle-vs35.js")).toBeGreaterThan(index.indexOf("strategic-battle-vs34.js"));
  });

  it("derives targets only from existing enabled controls", () => {
    expect(js).toContain("button:disabled");
    expect(js).toContain("aria-disabled='true'");
    expect(js).toContain("dataset.legalTarget");
    expect(js).not.toMatch(/fetch\(|click\(|dispatch\(|setState|pathfind|range\s*=|cost\s*=/i);
  });

  it("does not invent unsupported action labels", () => {
    for (const label of ["CLIQUE AQUI", "CONSTRUIR", "MOVER", "ATACAR", "BASTIÃO"]) expect(js).toContain(label);
  });

  it("keeps hitboxes and interactions owned by the existing runtime", () => {
    expect(css).toContain("pointer-events: none");
    expect(js).not.toContain("preventDefault");
    expect(js).not.toContain("stopPropagation");
  });

  it("is reduced-motion safe", () => {
    expect(css).toContain("prefers-reduced-motion");
  });
});
