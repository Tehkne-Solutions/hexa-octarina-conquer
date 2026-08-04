import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/strategic-battle-vs61.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/strategic-battle-vs61.css", import.meta.url), "utf8");

describe("VS61 gameplay quality closure", () => {
  it("loads after the consolidated tactical surface", () => {
    expect(html.indexOf("strategic-battle-vs61.js")).toBeGreaterThan(html.indexOf("strategic-battle-vs60.js"));
    expect(html).toContain("strategic-battle-vs61.css");
  });

  it("removes redundant prompts while preserving consequential log entries", () => {
    expect(js).toContain("A fronteira está aberta. Nenhuma estrada foi erguida ainda.");
    expect(js).toContain("is-vs61-muted-log");
    expect(js).toContain("visible < 2");
    expect(css).toContain(".strategic-command-banner.is-vs61-redundant");
  });

  it("remains presentation-only", () => {
    expect(js).not.toContain("fetch(");
    expect(js).not.toContain("dispatchEvent");
    expect(js).not.toContain(".click(");
    expect(js).not.toContain("debugTrace");
  });
});
