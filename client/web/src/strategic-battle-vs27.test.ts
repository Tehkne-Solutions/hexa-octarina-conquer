import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/strategic-battle-vs27.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/strategic-battle-vs27.js", import.meta.url), "utf8");

describe("VERTICAL SLICE 27 narrative speaker identity", () => {
  it("loads speaker identity after the narrative layer", () => {
    expect(html).toContain('/strategic-battle-vs27.css');
    expect(html).toContain('/strategic-battle-vs27.js');
    expect(html.indexOf('/strategic-battle-vs27.css')).toBeGreaterThan(html.indexOf('/strategic-battle-vs26.css'));
    expect(html.indexOf('/strategic-battle-vs27.js')).toBeGreaterThan(html.indexOf('/strategic-battle-vs26.js'));
  });

  it("reuses the player-facing roster identity instead of introducing duplicate asset mappings", () => {
    expect(script).toContain('.strategic-roster-card');
    expect(script).toContain('.strategic-roster-icon');
    expect(script).toContain('cloneNode(true)');
    expect(script).not.toContain('/assets/runtime/');
  });

  it("keeps faction identity contextual and non-interactive", () => {
    expect(script).toContain('speaker-red');
    expect(script).toContain('speaker-blue');
    expect(script).toContain('speaker-world');
    expect(css).toContain('.strategic-field-narrative-portrait');
    expect(script).not.toContain('click()');
    expect(script).not.toContain('dispatchEvent');
  });
});
