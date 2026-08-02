import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeEnhancements = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");
const statusCss = readFileSync(new URL("./vertical-slice-10-status-layout.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 10 player-facing status layout", () => {
  it("loads the status layout globally through RuntimeEnhancements", () => {
    expect(runtimeEnhancements).toContain('import "./vertical-slice-10-status-layout.css";');
  });

  it("keeps non-battle status cards in a compact right-side dock", () => {
    expect(statusCss).toContain(".unified-game-shell:not(.battle-active) .system-status-center");
    expect(statusCss).toContain("right: 14px");
    expect(statusCss).toContain("width: min(286px, calc(100vw - 28px))");
  });

  it("moves the status dock away from the hero on mobile", () => {
    expect(statusCss).toContain("bottom: 70px");
    expect(statusCss).toContain("left: 10px");
  });
});
