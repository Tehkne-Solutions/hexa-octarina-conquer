import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const physicalWorld = readFileSync(new URL("./strategic-board-physical-world.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 20 battle readability", () => {
  it("gives the battlefield more horizontal space", () => {
    expect(physicalWorld).toContain("grid-template-columns: 150px minmax(0, 1fr) 176px");
    expect(physicalWorld).toContain("/* VERTICAL SLICE 20 — Battle Readability & Cinematic Scale */");
  });

  it("removes the technical background grid from the player-facing battle", () => {
    expect(physicalWorld).toContain(".meta08-physical-world .strategic-board::before");
    expect(physicalWorld).toContain("opacity: 0;");
  });

  it("promotes runtime unit art to the primary visual", () => {
    expect(physicalWorld).toContain("width: 122px;");
    expect(physicalWorld).toContain("object-fit: contain;");
    expect(physicalWorld).toContain("object-position: center bottom;");
  });
});
