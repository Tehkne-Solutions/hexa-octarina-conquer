import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeEnhancements = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");
const trayCss = readFileSync(new URL("./vertical-slice-11-status-tray.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 11 player-facing status tray", () => {
  it("loads the VS11 override after the VS10 status layout", () => {
    expect(runtimeEnhancements.indexOf('vertical-slice-11-status-tray.css')).toBeLessThan(
      runtimeEnhancements.indexOf('vertical-slice-10-status-layout.css'),
    );
  });

  it("anchors non-battle status to the lower-right desktop tray", () => {
    expect(trayCss).toContain("top: auto");
    expect(trayCss).toContain("right: 14px");
    expect(trayCss).toContain("bottom: 58px");
    expect(trayCss).toContain("width: min(272px, calc(100vw - 28px))");
  });

  it("keeps the override desktop-only so VS10 mobile placement remains intact", () => {
    expect(trayCss).toContain("@media (min-width: 821px)");
  });
});
