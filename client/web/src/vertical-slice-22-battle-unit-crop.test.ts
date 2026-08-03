import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../public/strategic-battle-vs21.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 22 deterministic unit crop", () => {
  it("uses explicit portrait cropping for baked-background runtime PNGs", () => {
    expect(css).toContain("VERTICAL SLICE 22 — deterministic portrait crop");
    expect(css).toContain("object-fit: cover");
    expect(css).toContain("clip-path: polygon");
    expect(css).toContain("mix-blend-mode: normal");
  });

  it("gives Brakk a dedicated enlarged crop instead of screen blending", () => {
    expect(css).toContain(".strategic-unit.unit-brakk .strategic-unit-image");
    expect(css).toContain("transform: translateX(-50%) scale(2.35)");
    expect(css).toContain("brightness(1.9)");
  });

  it("keeps the VS21 terrain continuity layer intact", () => {
    expect(css).toContain("scale(1.045)");
    expect(css).toContain("box-shadow: none");
  });
});
