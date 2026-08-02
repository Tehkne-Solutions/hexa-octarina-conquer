import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeEnhancements = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");
const profileCss = readFileSync(new URL("./vertical-slice-15-profile-panel.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 15 Home profile panel", () => {
  it("loads the VS15 profile layer after the previous hero refinements", () => {
    expect(runtimeEnhancements.indexOf('vertical-slice-15-profile-panel.css')).toBeLessThan(
      runtimeEnhancements.indexOf('vertical-slice-14-hero-balance.css'),
    );
  });

  it("keeps the desktop profile rail compact and content-driven", () => {
    expect(profileCss).toContain("grid-template-columns: minmax(0, 1fr) 228px !important");
    expect(profileCss).toContain("height: auto !important");
    expect(profileCss).toContain("min-height: 0 !important");
  });

  it("compacts profile metrics without changing their data semantics", () => {
    expect(profileCss).toContain("min-height: 58px !important");
    expect(profileCss).toContain("grid-template-columns: 40px minmax(0, 1fr) !important");
  });
});
