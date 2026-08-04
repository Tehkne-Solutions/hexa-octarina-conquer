import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CAMPAIGN_ACHIEVEMENTS,
  CAMPAIGN_CHAPTERS,
  CAMPAIGN_MISSIONS,
} from "../src/campaign-catalog.js";

const rootUrl = new URL("../../", import.meta.url);

async function readRepoFile(path) {
  return readFile(new URL(path, rootUrl), "utf8");
}

test("VS73 release audit keeps the authoritative campaign RC contract present", async () => {
  assert.equal(CAMPAIGN_CHAPTERS.length, 3);
  assert.equal(CAMPAIGN_MISSIONS.length, 12);
  assert.equal(CAMPAIGN_ACHIEVEMENTS.length, 10);
  assert.equal(CAMPAIGN_MISSIONS.at(-1)?.id, "c3-m4");
  assert.equal(CAMPAIGN_MISSIONS.at(-1)?.title, "Octarina Absoluta");
  assert.equal(CAMPAIGN_ACHIEVEMENTS.some((item) => item.id === "legend"), true);

  const objectiveGate = await readRepoFile("server/test/campaign-objective-integrity.test.js");
  const progressionGate = await readRepoFile("server/test/campaign-release-candidate.test.js");

  for (const objective of ["cell_lead", "largest_province", "duel_cards", "captures"]) {
    assert.equal(objectiveGate.includes(objective), true, `advanced objective gate missing ${objective}`);
  }
  assert.equal(progressionGate.includes("12/12"), true);
  assert.equal(progressionGate.includes("36 stars"), true);
  assert.equal(progressionGate.includes("legend"), true);
  assert.equal(progressionGate.includes("idempotent"), true);
});

test("VS73 release audit requires PACK 99 full runtime gates for local visual QA and production", async () => {
  const visualGate = await readRepoFile("client/web/scripts/visual-pack99-runtime-gate.mjs");
  const productionGate = await readRepoFile("client/web/scripts/production-pack99-gate.mjs");

  for (const source of [visualGate, productionGate]) {
    assert.match(source, /1037/);
    assert.match(source, /unresolved/i);
    assert.match(source, /full/);
  }

  assert.match(visualGate, /PACK99_VISUAL_GATE=PASS/);
  assert.match(visualGate, /materializedAssetCount/);
  assert.match(visualGate, /hero-kael/);
  assert.match(visualGate, /hero-lyra/);

  assert.match(productionGate, /hexa-octarina-conquer\.onrender\.com/);
  assert.match(productionGate, /REQUIRED_MISSION_FILES/);
  assert.match(productionGate, /productionBlocked/);
});

test("VS73 release audit keeps web build, test, PACK 99 and production verification commands wired", async () => {
  const webPackage = JSON.parse(await readRepoFile("client/web/package.json"));
  const scripts = webPackage.scripts ?? {};

  assert.equal(typeof scripts.test, "string");
  assert.equal(typeof scripts.build, "string");
  assert.equal(typeof scripts["verify:pack99"], "string");
  assert.equal(typeof scripts["verify:production"], "string");
  assert.match(scripts.check, /verify:pack99/);
  assert.match(scripts.check, /test/);
  assert.match(scripts.check, /build/);
});

test("VS73 release audit is additive and never becomes a second gameplay authority", async () => {
  const source = await readRepoFile("server/test/hoc-release-candidate-audit.test.js");

  assert.equal(source.includes("mergeCampaignResult("), false);
  assert.equal(source.includes("createCampaignRoom("), false);
  assert.equal(source.includes("applyCommand("), false);
  assert.equal(source.includes("fetch("), false);
});
