import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(new URL("./Pack99InterfaceCleanup.tsx", import.meta.url), "utf8");
const RUNTIME = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");

describe("PACK 99 interface cleanup contract", () => {
  it("keeps interactive guidance and live phase status outside hidden notice sources", () => {
    const selectorsBlock = SOURCE.match(/const NOTICE_SELECTORS = \[(.*?)\];/s)?.[1] ?? "";
    const hiddenBlock = SOURCE.match(/const HIDE_SOURCE_SELECTORS = new Set\(\[(.*?)\]\);/s)?.[1] ?? "";

    expect(selectorsBlock).not.toContain("battle-coach-card");
    expect(hiddenBlock).not.toContain("phase-banner");
    expect(hiddenBlock).not.toContain("ai-turn-summary");
  });

  it("is mounted by the production runtime enhancements tree", () => {
    expect(RUNTIME).toContain('import { Pack99InterfaceCleanup } from "./Pack99InterfaceCleanup";');
    expect(RUNTIME).toContain("return <Pack99InterfaceCleanup />;");
    expect(SOURCE).toContain('document.querySelector<HTMLDivElement>("#game-main")');
  });

  it("deduplicates the living notice payload against timeline text", () => {
    expect(SOURCE).toContain('if (selector === ".living-notice")');
    expect(SOURCE).toContain('node.querySelector<HTMLElement>("p")');
    expect(SOURCE).toContain("const signature = text;");
    expect(SOURCE).not.toContain("`${selector}:${text}`");
  });
});
