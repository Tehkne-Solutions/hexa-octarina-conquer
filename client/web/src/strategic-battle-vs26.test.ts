import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/strategic-battle-vs26.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/strategic-battle-vs26.js", import.meta.url), "utf8");

describe("VERTICAL SLICE 26 battle narrative feedback", () => {
  it("loads narrative assets after the visual slices", () => {
    expect(html).toContain('/strategic-battle-vs26.css');
    expect(html).toContain('/strategic-battle-vs26.js');
    expect(html.indexOf('/strategic-battle-vs26.css')).toBeGreaterThan(html.indexOf('/strategic-battle-vs25.css'));
  });

  it("projects the latest existing turn log without mutating gameplay state", () => {
    expect(script).toContain('LOG_SELECTOR = ".strategic-objectives ol"');
    expect(script).toContain('li:first-child');
    expect(script).toContain('MutationObserver');
    expect(script).toContain('aria-live');
    expect(script).not.toContain('click()');
    expect(script).not.toContain('dispatchEvent');
  });

  it("classifies road, movement, construction, combat, enemy and round feedback", () => {
    for (const tone of ["combat", "build", "road", "move", "enemy", "round"]) {
      expect(script).toContain(`tone: "${tone}"`);
    }
    expect(css).toContain('.strategic-field-narrative[data-tone="combat"]');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
