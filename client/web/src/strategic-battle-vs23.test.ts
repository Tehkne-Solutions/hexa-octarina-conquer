import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../public/strategic-battle-vs23.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("VERTICAL SLICE 23 Brakk portrait recovery", () => {
  it("loads the isolated Brakk recovery layer after the shared battle layer", () => {
    expect(html).toContain('/strategic-battle-vs21.css');
    expect(html).toContain('/strategic-battle-vs23.css');
    expect(html.indexOf('/strategic-battle-vs23.css')).toBeGreaterThan(html.indexOf('/strategic-battle-vs21.css'));
  });

  it("uses the canonical Brakk bitmap as an engraved tactical portrait", () => {
    expect(css).toContain("VERTICAL SLICE 23 — Brakk Tactical Portrait Recovery");
    expect(css).toContain(".strategic-unit.unit-brakk .strategic-unit-image");
    expect(css).toContain("grayscale(1)");
    expect(css).toContain("invert(.86)");
    expect(css).toContain("sepia(.82)");
  });
});
