import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/strategic-battle-vs29.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/strategic-battle-vs29.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 29 damage and defeat readability", () => {
  it("loads after VS28 physical feedback", () => {
    expect(html).toContain('/strategic-battle-vs29.css');
    expect(html).toContain('/strategic-battle-vs29.js');
    expect(html.indexOf('/strategic-battle-vs29.css')).toBeGreaterThan(html.indexOf('/strategic-battle-vs28.css'));
    expect(html.indexOf('/strategic-battle-vs29.js')).toBeGreaterThan(html.indexOf('/strategic-battle-vs28.js'));
  });

  it("derives damage from real rendered HP instead of duplicating combat rules", () => {
    expect(js).toContain('match(/^(.+),\\s*(\\d+)\\s+de vida$/i)');
    expect(js).toContain('now.hp < before.hp');
    expect(js).toContain('before.hp - now.hp');
    expect(js).toContain('!current.has(name)');
    expect(js).toContain('"DERROTADO"');
  });

  it("keeps the readout presentation non interactive", () => {
    expect(css).toContain("pointer-events:none");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain("strategic-combat-readout");
  });
});
