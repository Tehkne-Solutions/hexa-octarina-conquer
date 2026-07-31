import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const stylesheet = readFileSync(
  resolve(currentDirectory, "strategic-board-canonical-units.css"),
  "utf8",
);

describe("META 08 tactical unit token contract", () => {
  it("hard-clips runtime artwork instead of exposing baked rectangular backgrounds", () => {
    expect(stylesheet).toContain("clip-path: polygon(");
    expect(stylesheet).toContain("object-fit: cover");
    expect(stylesheet).toContain("mix-blend-mode: normal");
    expect(stylesheet).not.toContain("mix-blend-mode: multiply");
    expect(stylesheet).not.toContain("mix-blend-mode: screen");
  });

  it("keeps faction framing and explicit per-unit crop corrections", () => {
    expect(stylesheet).toContain(".strategic-unit.owner-red");
    expect(stylesheet).toContain(".strategic-unit.unit-kael .strategic-unit-image");
    expect(stylesheet).toContain(".strategic-unit.unit-lyra .strategic-unit-image");
    expect(stylesheet).toContain(".strategic-unit.unit-varg .strategic-unit-image");
    expect(stylesheet).toContain(".strategic-unit.unit-brakk .strategic-unit-image");
  });

  it("preserves the physical road readability hierarchy", () => {
    expect(stylesheet).toContain(".strategic-edge.state-road .strategic-edge-asset");
    expect(stylesheet).toContain(".strategic-edge.state-unbuilt .strategic-edge-asset");
    expect(stylesheet).toContain(".strategic-edge.is-recommended .strategic-edge-asset");
  });
});
