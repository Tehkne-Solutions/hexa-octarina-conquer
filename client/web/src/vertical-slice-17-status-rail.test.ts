import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeEnhancements = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");
const statusRailCss = readFileSync(new URL("./vertical-slice-17-status-rail.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 17 status rail alignment", () => {
  it("loads the VS17 override after the VS16 grid balance", () => {
    expect(runtimeEnhancements.indexOf('vertical-slice-17-status-rail.css')).toBeLessThan(
      runtimeEnhancements.indexOf('vertical-slice-16-home-grid-balance.css'),
    );
  });

  it("aligns the desktop status tray to the compact 228px profile rail", () => {
    expect(statusRailCss).toContain("right: 43px !important");
    expect(statusRailCss).toContain("width: 228px !important");
    expect(statusRailCss).toContain("max-width: 228px !important");
  });

  it("preserves the existing tablet status behavior", () => {
    expect(statusRailCss).toContain("@media (max-width: 1023px) and (min-width: 821px)");
    expect(statusRailCss).toContain("width: min(250px, calc(100vw - 20px)) !important");
  });
});
