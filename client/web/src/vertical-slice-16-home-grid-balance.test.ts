import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeEnhancements = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");
const gridCss = readFileSync(new URL("./vertical-slice-16-home-grid-balance.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 16 Home mode grid balance", () => {
  it("loads the VS16 layer after the profile refinement", () => {
    expect(runtimeEnhancements.indexOf('vertical-slice-16-home-grid-balance.css')).toBeLessThan(
      runtimeEnhancements.indexOf('vertical-slice-15-profile-panel.css'),
    );
  });

  it("uses a stable two-column mode grid on desktop", () => {
    expect(gridCss).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("lets the final mode card close the last row without affecting mobile", () => {
    expect(gridCss).toContain(".home-menu-grid > .home-mode-card:last-child");
    expect(gridCss).toContain("grid-column: 1 / -1");
    expect(gridCss).toContain("grid-column: auto");
  });
});
