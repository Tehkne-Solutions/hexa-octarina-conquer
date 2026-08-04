import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const launcher = readFileSync(new URL("./AuthoritativeCampaignLauncher.tsx", import.meta.url), "utf8");
const gameApp = readFileSync(new URL("./GameApp.tsx", import.meta.url), "utf8");

describe("VS63 campaign continuity", () => {
  it("routes the authoritative result map action back to the unified campaign shell", () => {
    expect(launcher).toContain("Mapa da campanha");
    expect(launcher).toContain("routeToUnifiedMap");
    expect(launcher).toContain("event.stopPropagation()");
    expect(launcher).toContain("onBack()");
    expect(launcher).toContain('data-unified-campaign-shell="true"');
  });

  it("preserves direct next-mission chaining inside the authoritative battle client", () => {
    expect(launcher).toContain('.campaign-result .result-actions button');
    expect(launcher).not.toContain("Próxima missão\"");
  });

  it("refreshes the unified dashboard whenever the embedded campaign returns to the map", () => {
    expect(gameApp).toContain('const backToCampaignMap = () => { setCampaignView("map"); void refreshDashboard(); };');
  });
});
