import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const integrationCss = readFileSync(new URL("./vertical-slice-08-hero-integration.css", import.meta.url), "utf8");
const polishCss = readFileSync(new URL("./vertical-slice-03-polish.css", import.meta.url), "utf8");

describe("VERTICAL SLICE 08 canonical hero integration", () => {
  it("loads the integration layer after the cinematic home layer", () => {
    const integrationIndex = polishCss.indexOf('@import "./vertical-slice-08-hero-integration.css";');
    const cinematicIndex = polishCss.indexOf('@import "./vertical-slice-07-home-cinematic.css";');
    expect(integrationIndex).toBeGreaterThanOrEqual(0);
    expect(cinematicIndex).toBeGreaterThanOrEqual(0);
    expect(integrationIndex).toBeLessThan(cinematicIndex);
  });

  it("feathers the canonical hero canvases into the scene", () => {
    expect(integrationCss).toContain("mask-image: radial-gradient");
    expect(integrationCss).toContain(".campaign-hero-art .hero-kael");
    expect(integrationCss).toContain("background-size: 210% auto !important");
    expect(integrationCss).toContain(".campaign-hero-art .hero-lyra");
    expect(integrationCss).toContain("background-size: 216% auto !important");
  });

  it("keeps player-facing build diagnostics hidden", () => {
    expect(integrationCss).toContain(".runtime-build-badge");
    expect(integrationCss).toContain(".pack99-runtime-badge");
    expect(integrationCss).toContain("display: none !important");
  });
});
