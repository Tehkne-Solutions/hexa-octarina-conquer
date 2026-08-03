import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../public/strategic-battle-vs21.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("VERTICAL SLICE 21 battle continuity", () => {
  it("loads the isolated player-facing battle layer", () => {
    expect(html).toContain('/strategic-battle-vs21.css');
    expect(css).toContain("VERTICAL SLICE 21 — Battle Continuity & Unit Cleanup");
  });

  it("softens tile seams without changing board topology", () => {
    expect(css).toContain("transform: translate(-50%, -50%) scale(1.045)");
    expect(css).toContain("box-shadow: none");
  });

  it("applies per-unit cleanup for baked backgrounds", () => {
    expect(css).toContain(".strategic-unit.unit-brakk .strategic-unit-image");
    expect(css).toContain("mix-blend-mode: screen");
    expect(css).toContain(".strategic-unit.unit-lyra .strategic-unit-image");
    expect(css).toContain("mix-blend-mode: lighten");
  });
});
