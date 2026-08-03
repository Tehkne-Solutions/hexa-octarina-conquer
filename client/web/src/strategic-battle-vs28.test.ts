import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/strategic-battle-vs28.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/strategic-battle-vs28.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 28 physical action feedback", () => {
  it("loads after narrative identity layers", () => {
    expect(html).toContain('/strategic-battle-vs28.css');
    expect(html).toContain('/strategic-battle-vs28.js');
    expect(html.indexOf('/strategic-battle-vs28.css')).toBeGreaterThan(html.indexOf('/strategic-battle-vs27.css'));
    expect(html.indexOf('/strategic-battle-vs28.js')).toBeGreaterThan(html.indexOf('/strategic-battle-vs27.js'));
  });

  it("anchors effects to the real strategic unit buttons", () => {
    expect(js).toContain('querySelectorAll(".strategic-unit")');
    expect(js).not.toContain('querySelectorAll(".strategic-unit-token")');
    expect(js).toContain('startsWith(`${speaker},`)');
  });

  it("keeps the fx layer non interactive and honors reduced motion", () => {
    expect(css).toContain("pointer-events:none");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(js).toContain('return "move"');
    expect(js).toContain('return "road"');
    expect(js).toContain('return "build"');
    expect(js).toContain('return "impact"');
    expect(js).toContain('return "defeat"');
  });
});
