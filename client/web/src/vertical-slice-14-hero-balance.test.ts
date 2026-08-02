import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeEnhancements = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");
const balanceCss = readFileSync(new URL("./vertical-slice-14-hero-balance.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 14 hero banner balance", () => {
  it("loads the VS14 balance layer after the VS13 banner treatment", () => {
    expect(runtimeEnhancements.indexOf('vertical-slice-14-hero-balance.css')).toBeLessThan(
      runtimeEnhancements.indexOf('vertical-slice-13-hero-banners.css'),
    );
  });

  it("reduces banner footprint to restore scene breathing room", () => {
    expect(balanceCss).toContain("width: 136px !important");
    expect(balanceCss).toContain("height: 204px !important");
    expect(balanceCss).toContain("width: 128px !important");
    expect(balanceCss).toContain("height: 194px !important");
  });

  it("preserves distinct banner rotation while reducing visual weight", () => {
    expect(balanceCss).toContain("rotate(-3deg)");
    expect(balanceCss).toContain("rotate(2deg)");
  });
});
