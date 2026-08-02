import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeEnhancements = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");
const bannerCss = readFileSync(new URL("./vertical-slice-13-hero-banners.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 13 canonical hero banners", () => {
  it("loads the VS13 layer through RuntimeEnhancements", () => {
    expect(runtimeEnhancements).toContain('import "./vertical-slice-13-hero-banners.css";');
  });

  it("treats source art as framed banners instead of fake transparent cut-outs", () => {
    expect(bannerCss).toContain("mask-image: none !important");
    expect(bannerCss).toContain("border: 1px solid rgba(223, 187, 103, .52) !important");
    expect(bannerCss).toContain("border-radius: 8px 8px 18px 18px !important");
  });

  it("keeps the canonical hero compositions intentionally distinct", () => {
    expect(bannerCss).toContain("transform: rotate(-4deg) !important");
    expect(bannerCss).toContain("transform: rotate(3deg) !important");
  });
});
