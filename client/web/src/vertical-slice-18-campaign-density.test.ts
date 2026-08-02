import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeEnhancements = readFileSync(new URL("./RuntimeEnhancements.tsx", import.meta.url), "utf8");
const densityCss = readFileSync(new URL("./vertical-slice-18-campaign-density.css", import.meta.url), "utf8");
const journey = readFileSync(new URL("./CampaignJourneyScreen.tsx", import.meta.url), "utf8");

describe("VERTICAL SLICE 18 campaign map density", () => {
  it("loads the VS18 layer after the stable Home refinements", () => {
    expect(runtimeEnhancements.indexOf('vertical-slice-18-campaign-density.css')).toBeLessThan(
      runtimeEnhancements.indexOf('vertical-slice-17-status-rail.css'),
    );
  });

  it("targets the real campaign journey structure without changing its behavior", () => {
    expect(journey).toContain('className="campaign-chapter-list"');
    expect(journey).toContain('className="campaign-mission-track"');
    expect(densityCss).toContain(".campaign-chapter");
    expect(densityCss).toContain("height: auto !important");
  });

  it("reduces chapter artwork and mission whitespace on desktop", () => {
    expect(densityCss).toContain("@media (min-width: 981px)");
    expect(densityCss).toContain("height: 112px !important");
    expect(densityCss).toContain("min-height: 68px !important");
    expect(densityCss).toContain("gap: 12px !important");
  });

  it("keeps the selected mission panel visible while scrolling the denser map", () => {
    expect(densityCss).toContain("position: sticky !important");
    expect(densityCss).toContain("top: calc(var(--game-header-height) + 14px) !important");
  });

  it("does not override the canonical mobile chapter sizing", () => {
    expect(densityCss).not.toContain("@media (max-width: 980px)");
  });
});
