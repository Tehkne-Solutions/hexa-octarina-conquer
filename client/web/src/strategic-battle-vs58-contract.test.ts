import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/strategic-battle-vs58.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/strategic-battle-vs58.css", import.meta.url), "utf8");

describe("VS58 decision priority surface", () => {
  it("loads after VS56 and VS57", () => {
    expect(html.indexOf("strategic-battle-vs58.js")).toBeGreaterThan(html.indexOf("strategic-battle-vs57.js"));
    expect(html.indexOf("strategic-battle-vs57.js")).toBeGreaterThan(html.indexOf("strategic-battle-vs56.js"));
    expect(html).toContain("strategic-battle-vs58.css");
  });

  it("prioritizes immediate consequence before territory", () => {
    expect(js).toContain("is-lethal-threat");
    expect(js).toContain("is-lethal-opportunity");
    expect(js).toContain("mode-structure");
    expect(js).toContain("ENCERRAR TURNO");
    expect(js).toContain("PRESERVAR");
    expect(js).toContain("FINALIZAR");
  });

  it("stays passive and avoids engine or synthetic interaction", () => {
    expect(css).toContain("pointer-events: none");
    expect(js).not.toContain("debugTrace");
    expect(js).not.toContain("dispatchEvent");
    expect(js).not.toContain(".click(");
    expect(js).not.toContain("fetch(");
  });
});
