import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const campaignSource = readFileSync(resolve(here, "CampaignExperience.tsx"), "utf8");
const authorityCss = readFileSync(resolve(here, "strategic-board-mode-authority.css"), "utf8");

describe("META 08.9 active mode authority", () => {
  it("loads the authority with the strategic campaign chunk", () => {
    expect(campaignSource).toContain('import "./strategic-board-mode-authority.css";');
  });

  it("lets the Bastião cell own hit testing during structure mode", () => {
    expect(authorityCss).toContain(":has(.strategic-command-banner.mode-structure)");
    expect(authorityCss).toContain(":is(.strategic-unit, .strategic-edge, .strategic-node)");
    expect(authorityCss).toContain("pointer-events: none !important");
  });

  it("keeps the active Bastião hitbox physically stable", () => {
    expect(authorityCss).toContain(".strategic-cell.is-build-target");
    expect(authorityCss).toContain("animation: none !important");
    expect(authorityCss).toContain("transform: translate(-50%, -50%) !important");
  });

  it("keeps road, move and attack hit testing scoped to the active mechanic", () => {
    expect(authorityCss).toContain("mode-road");
    expect(authorityCss).toContain("mode-move");
    expect(authorityCss).toContain("mode-attack");
    expect(authorityCss).toContain(".strategic-unit.owner-red:not(.is-attack-target)");
  });
});
