import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeEnhancements = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");
const compactCss = readFileSync(new URL("./vertical-slice-12-status-card-compact.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 12 compact status card", () => {
  it("loads the VS12 override after the previous status layers", () => {
    expect(runtimeEnhancements.indexOf('vertical-slice-12-status-card-compact.css')).toBeLessThan(
      runtimeEnhancements.indexOf('vertical-slice-11-status-tray.css'),
    );
  });

  it("prevents the status container and card from stretching vertically", () => {
    expect(compactCss).toContain("height: auto !important");
    expect(compactCss).toContain("min-height: 0 !important");
    expect(compactCss).toContain("max-height: 220px !important");
    expect(compactCss).toContain("align-self: end !important");
  });

  it("keeps the connection action inside a compact content-driven grid", () => {
    expect(compactCss).toContain("grid-auto-rows: min-content");
    expect(compactCss).toContain(".connection-status > button");
  });
});
