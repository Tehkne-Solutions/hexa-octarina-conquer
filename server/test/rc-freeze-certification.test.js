import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const rootUrl = new URL("../../", import.meta.url);
const FROZEN_SHA = "5acfa1e07e0f01b8080242d615693c701b94e56d";

async function readRepoFile(path) {
  return readFile(new URL(path, rootUrl), "utf8");
}

test("VS75 freezes the release candidate on the accepted VS74 commit", async () => {
  const freeze = await readRepoFile("docs/release/VS75-RC-FREEZE-PRODUCTION-CERTIFICATION.txt");
  assert.equal(freeze.includes(FROZEN_SHA), true);
  assert.equal(freeze.includes("nenhuma nova feature entra no RC"), true);
  assert.equal(freeze.includes("blockers reais de release"), true);
});

test("VS75 keeps production certification chained to PACK 99 and visual acceptance", async () => {
  const productionGate = await readRepoFile("client/web/scripts/production-pack99-gate.mjs");
  const visualAcceptance = await readRepoFile("client/web/src/vs74-final-production-visual-acceptance.test.ts");
  const releaseAudit = await readRepoFile("server/test/hoc-release-candidate-audit.test.js");

  assert.match(productionGate, /install\.profile !== "full"/);
  assert.match(productionGate, /install\.assetCount !== 1037/);
  assert.match(productionGate, /unresolvedReferences !== 0/);
  assert.match(visualAcceptance, /screen=ui14-gameplay/);
  assert.match(visualAcceptance, /screen=ui14-combat-selection/);
  assert.match(visualAcceptance, /screen=ui14-combat-impact/);
  assert.match(releaseAudit, /VS73 release audit/);
});

test("VS75 remains a release guardrail and does not become gameplay authority", async () => {
  const source = await readRepoFile("server/test/rc-freeze-certification.test.js");
  for (const forbidden of ["mergeCampaignResult(", "createCampaignRoom(", "applyCommand(", "rewardXp ="]) {
    assert.equal(source.includes(forbidden), false, `freeze gate must not contain ${forbidden}`);
  }
});
