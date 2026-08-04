import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/strategic-battle-vs59.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/strategic-battle-vs59.css", import.meta.url), "utf8");

describe("VS59 objective pressure and endgame readability", () => {
  it("loads after VS58", () => {
    expect(html.indexOf("strategic-battle-vs59.js")).toBeGreaterThan(html.indexOf("strategic-battle-vs58.js"));
    expect(html).toContain("strategic-battle-vs59.css");
  });

  it("mirrors the real terminal triad without requiring road count", () => {
    expect(js).toContain(".strategic-cell.owner-${faction}");
    expect(js).toContain(".strategic-structure.owner-${faction}");
    expect(js).toContain(".strategic-roster-card.owner-${enemy}:disabled");
    expect(js).not.toContain("/6");
    expect(js).not.toContain("Estradas");
  });

  it("distinguishes Orun, Rubra and dual endgame pressure", () => {
    expect(js).toContain("ORUN A 1 CONDIÇÃO");
    expect(js).toContain("RUBRA A 1 CONDIÇÃO");
    expect(js).toContain("DESFECHO ABERTO");
    expect(css).toContain("is-orun-pressure");
    expect(css).toContain("is-rubra-pressure");
    expect(css).toContain("is-dual-pressure");
  });

  it("stays passive", () => {
    expect(css).toContain("pointer-events: none");
    expect(js).not.toContain("debugTrace");
    expect(js).not.toContain("dispatchEvent");
    expect(js).not.toContain(".click(");
    expect(js).not.toContain("fetch(");
  });
});
