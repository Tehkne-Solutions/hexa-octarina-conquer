import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cssPath = fileURLToPath(new URL("./meta10-map-first-hud.css", import.meta.url));
const css = readFileSync(cssPath, "utf8");

describe("META 10.2 map-first HUD contract", () => {
  it("keeps the strategic board as the dominant layout column", () => {
    expect(css).toContain("grid-template-columns: 164px minmax(0, 1fr) 184px");
    expect(css).toContain(".strategic-slice .strategic-board");
  });

  it("de-emphasizes side panels while preserving hover and keyboard focus recovery", () => {
    expect(css).toContain("opacity: .82");
    expect(css).toContain(".strategic-roster:focus-within");
    expect(css).toContain(".strategic-objectives:focus-within");
  });

  it("further recedes the HUD when a map action is active", () => {
    expect(css).toContain(":has(.strategic-edge.is-recommended)");
    expect(css).toContain(":has(.strategic-node.is-recommended)");
    expect(css).toContain(":has(.strategic-cell.is-build-target)");
  });

  it("keeps mobile map-first by floating supporting panels over the board", () => {
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("position: absolute");
    expect(css).toContain("grid-template-columns: 1fr");
  });
});
