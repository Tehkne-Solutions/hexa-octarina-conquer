import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/strategic-battle-vs30.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/strategic-battle-vs30.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 30 combat resolution sequence", () => {
  it("loads after VS29 combat readouts", () => {
    expect(html.indexOf('/strategic-battle-vs30.css')).toBeGreaterThan(html.indexOf('/strategic-battle-vs29.css'));
    expect(html.indexOf('/strategic-battle-vs30.js')).toBeGreaterThan(html.indexOf('/strategic-battle-vs29.js'));
  });

  it("reacts to VS29 output instead of duplicating combat state", () => {
    expect(js).toContain('.strategic-combat-readout');
    expect(js).toContain('is-damage');
    expect(js).toContain('is-defeat');
    expect(js).toContain('.strategic-result');
    expect(js).not.toContain('strategicAttack(');
  });

  it("preserves non interactive presentation and reduced motion", () => {
    expect(css).toContain('pointer-events:none');
    expect(css).toContain('prefers-reduced-motion:reduce');
    expect(css).toContain('strategic-objective-confirm');
    expect(css).toContain('strategic-result-resolving');
  });
});
