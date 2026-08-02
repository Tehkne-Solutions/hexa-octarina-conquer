import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(new URL("./Pack99HomeHeroArt.tsx", import.meta.url), "utf8");
const RUNTIME = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");

describe("PACK 99 home hero art contract", () => {
  it("uses the official canonical aliases for Kael and Lyra", () => {
    expect(SOURCE).toContain("HERO_GUARDIAN_01_IDLE_BASE_SW_01");
    expect(SOURCE).toContain("HERO_RANGER_01_IDLE_BASE_NE_01");
    expect(SOURCE).toContain("runtimeAssetUrl(item.assetId)");
    expect(SOURCE).not.toContain("/assets/runtime/packages/");
  });

  it("mounts the canonical hero enhancement in production runtime", () => {
    expect(RUNTIME).toContain('import { Pack99HomeHeroArt } from "./Pack99HomeHeroArt";');
    expect(RUNTIME).toContain("<Pack99HomeHeroArt />");
  });
});
