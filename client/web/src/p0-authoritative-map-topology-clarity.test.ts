import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./pack99-combat-cinematics.css", import.meta.url), "utf8");
const board = readFileSync(new URL("./Board.tsx", import.meta.url), "utf8");

describe("P0 authoritative map topology clarity", () => {
  it("keeps board placement points explicit", () => {
    expect(board).toContain('className={`board-point');
    expect(board).toContain("valid-neighbor");
    expect(css).toContain(".board-point.valid-neighbor");
  });

  it("does not paint the entire candidate edge graph before a point is selected", () => {
    expect(css).toContain(".edge-option:not(.valid):not(.suggested) .edge-option-visible");
    expect(css).toContain("opacity:0!important");
    expect(css).toContain(".edge-option:not(.valid):not(.suggested) .edge-option-hit");
    expect(css).toContain("pointer-events:none!important");
  });

  it("shows only valid adjacent links and the tutorial suggestion", () => {
    expect(css).toContain(".edge-option.valid .edge-option-visible");
    expect(css).toContain(".edge-option.suggested .edge-option-visible");
    expect(board).toContain("validEdgesFromSelection");
    expect(board).toContain("canonicalEdge(startPoint, endPoint)");
  });
});
