import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const rootUrl = new URL("../../../", import.meta.url);

async function readRepoFile(path: string) {
  return readFile(new URL(path, rootUrl), "utf8");
}

function stripStringLiterals(source: string) {
  return source
    .replace(/`(?:\\.|[^`])*`/gs, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

describe("VS74 final production and visual acceptance", () => {
  it("keeps the final player journey represented in the canonical Visual QA matrix", async () => {
    const workflow = await readRepoFile(".github/workflows/visual-qa.yml");

    const requiredRoutes = [
      "screen=home",
      "screen=campaign",
      "screen=ui14-gameplay",
      "screen=ui14-combat-selection",
      "screen=ui14-combat-impact",
      "screen=ui08-outcome",
    ];

    for (const route of requiredRoutes) {
      expect(workflow).toContain(route);
    }

    expect(workflow).toContain('viewport-size=\"1366,768\"');
    expect(workflow).toContain('viewport-size=\"390,844\"');
    expect(workflow).toContain("hexa-octarina-visual-qa");
    expect(workflow).toContain("if-no-files-found: error");
  });

  it("keeps PACK 99 production acceptance authoritative and fail-closed", async () => {
    const productionGate = await readRepoFile("client/web/scripts/production-pack99-gate.mjs");

    expect(productionGate).toContain("https://hexa-octarina-conquer.onrender.com");
    expect(productionGate).toContain('install.profile !== "full"');
    expect(productionGate).toContain("install.assetCount !== 1037");
    expect(productionGate).toContain("install.unresolvedReferences !== 0");
    expect(productionGate).toContain("REQUIRED_MISSION_FILES");
    expect(productionGate).toContain("productionBlocked");
    expect(productionGate).toContain("failedAssets");
  });

  it("keeps the final RC audit and campaign completion gates in the release chain", async () => {
    const releaseAudit = await readRepoFile("server/test/hoc-release-candidate-audit.test.js");
    const campaignRc = await readRepoFile("server/test/campaign-release-candidate.test.js");
    const campaignObjectives = await readRepoFile("server/test/campaign-objective-integrity.test.js");

    expect(releaseAudit).toContain("VS73 release audit");
    expect(campaignRc).toContain("12/12");
    expect(campaignRc).toContain("36 stars");

    for (const objective of ["cell_lead", "largest_province", "duel_cards", "captures"]) {
      expect(campaignObjectives).toContain(objective);
    }
  });

  it("does not introduce gameplay or progress authority in the final acceptance layer", async () => {
    const source = await readRepoFile("client/web/src/vs74-final-production-visual-acceptance.test.ts");
    const executable = stripStringLiterals(source);

    expect(executable).not.toMatch(/\bmergeCampaignResult\s*\(/);
    expect(executable).not.toMatch(/\bcreateCampaignRoom\s*\(/);
    expect(executable).not.toMatch(/\bapplyCommand\s*\(/);
    expect(executable).not.toMatch(/\brewardXp\s*=/);
  });
});
