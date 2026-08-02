import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(new URL("./Pack99InterfaceCleanup.tsx", import.meta.url), "utf8");

describe("PACK 99 interface cleanup contract", () => {
  it("keeps interactive guidance and live phase status outside hidden notice sources", () => {
    const selectorsBlock = SOURCE.match(/const NOTICE_SELECTORS = \[(.*?)\];/s)?.[1] ?? "";
    const hiddenBlock = SOURCE.match(/const HIDE_SOURCE_SELECTORS = new Set\(\[(.*?)\]\);/s)?.[1] ?? "";

    expect(selectorsBlock).not.toContain("battle-coach-card");
    expect(hiddenBlock).not.toContain("phase-banner");
    expect(hiddenBlock).not.toContain("ai-turn-summary");
  });

  it("deduplicates equivalent events by cleaned text instead of source selector", () => {
    expect(SOURCE).toContain("const signature = text;");
    expect(SOURCE).not.toContain("`${selector}:${text}`");
  });
});
