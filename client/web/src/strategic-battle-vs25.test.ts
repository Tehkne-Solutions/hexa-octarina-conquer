import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../public/strategic-battle-vs25.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("VERTICAL SLICE 25 Brakk direct source window", () => {
  it("loads after the previous structural crop layer", () => {
    expect(html).toContain('/strategic-battle-vs24.css');
    expect(html).toContain('/strategic-battle-vs25.css');
    expect(html.indexOf('/strategic-battle-vs25.css')).toBeGreaterThan(html.indexOf('/strategic-battle-vs24.css'));
  });

  it("positions the audited physical bitmap directly instead of using object-position as the crop authority", () => {
    expect(css).toContain("VERTICAL SLICE 25 — Brakk direct physical source window");
    expect(css).toContain('img[src*="CHAMP_BERSERKER_01_IDLE_BASE_NW_01"]');
    expect(css).toContain("width: 666px !important");
    expect(css).toContain("height: 666px !important");
    expect(css).toContain("left: calc(50% - 337px) !important");
    expect(css).toContain("top: -499px !important");
    expect(css).toContain("transform: none !important");
    expect(css).not.toContain("grayscale(");
    expect(css).not.toContain("invert(");
    expect(css).not.toContain("sepia(");
    expect(css).not.toContain("hue-rotate(");
  });

  it("applies the same physical source correction to the roster thumbnail", () => {
    expect(css).toContain("strategic-roster-icon:has");
    expect(css).toContain("width: 225px !important");
    expect(css).toContain("top: -171px !important");
  });
});
