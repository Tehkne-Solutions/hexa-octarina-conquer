import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../public/strategic-battle-vs24.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("VERTICAL SLICE 24 Brakk canonical source crop", () => {
  it("loads the structural crop layer instead of the VS23 recolor workaround", () => {
    expect(html).toContain('/strategic-battle-vs21.css');
    expect(html).toContain('/strategic-battle-vs24.css');
    expect(html).not.toContain('/strategic-battle-vs23.css');
    expect(html.indexOf('/strategic-battle-vs24.css')).toBeGreaterThan(html.indexOf('/strategic-battle-vs21.css'));
  });

  it("windows the native PACK 99 pixels without recoloring Brakk", () => {
    expect(css).toContain("VERTICAL SLICE 24 — Brakk canonical source crop recovery");
    expect(css).toContain("object-fit: none");
    expect(css).toContain("object-position: 50.82% 86.35%");
    expect(css).toContain("background: transparent");
    expect(css).not.toContain("grayscale(");
    expect(css).not.toContain("invert(");
    expect(css).not.toContain("sepia(");
    expect(css).not.toContain("hue-rotate(");
  });
});
