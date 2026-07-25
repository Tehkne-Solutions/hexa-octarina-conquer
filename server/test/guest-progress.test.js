import assert from "node:assert/strict";
import test from "node:test";

import { MemoryCampaignStore } from "../src/campaign-store.js";
import {
  compareGuestProgress,
  mergeGuestProgress,
  normalizeGuestProgress,
} from "../src/guest-progress.js";

const localVictory = {
  status: "victory",
  percent: 100,
  completedObjectives: 5,
  attempts: 3,
  bestTurn: 8,
  lastTurn: 10,
  building: "farm",
  rewards: ["Arco Prismático", "Fazenda Arcana", "segredo"],
  startedAt: 100,
  lastPlayedAt: 900,
  completedAt: 800,
};

test("normalizes guest progress and rejects unsupported free-form rewards", () => {
  const progress = normalizeGuestProgress({
    ...localVictory,
    percent: 240,
    completedObjectives: 99,
  }, 1000);
  assert.equal(progress.percent, 100);
  assert.equal(progress.completedObjectives, 5);
  assert.deepEqual(progress.rewards, ["Arco Prismático", "Fazenda Arcana"]);
  assert.equal(progress.missionId, "bridge-of-ashes");
});

test("detects a real conflict when equally advanced devices chose different constructions", () => {
  const comparison = compareGuestProgress(
    localVictory,
    { ...localVictory, building: "tower", rewards: ["Arco Prismático", "Torre Rúnica"] },
  );
  assert.equal(comparison.relation, "conflict");
});

test("merges progress monotonically without duplicating attempts", () => {
  const merged = mergeGuestProgress(
    { ...localVictory, attempts: 4, bestTurn: 9, rewards: ["Arco Prismático", "Fazenda Arcana"] },
    { status: "active", percent: 72, completedObjectives: 4, attempts: 8, bestTurn: 12, lastTurn: 13, rewards: [] },
    2000,
  );
  assert.equal(merged.status, "victory");
  assert.equal(merged.percent, 100);
  assert.equal(merged.attempts, 8);
  assert.equal(merged.bestTurn, 9);
  assert.equal(merged.building, "farm");
  assert.deepEqual(merged.rewards, ["Arco Prismático", "Fazenda Arcana"]);
});

test("memory store previews without writing and persists only after an explicit strategy", async () => {
  const store = new MemoryCampaignStore({ clock: () => 5000 });
  const preview = await store.syncGuestProgress("account-1", localVictory, "preview");
  assert.equal(preview.relation, "local-ahead");
  assert.equal(preview.changed, false);
  assert.equal((await store.getProgress("account-1")).guestPrologue.status, "not-started");

  const synchronized = await store.syncGuestProgress("account-1", localVictory, "merge");
  assert.equal(synchronized.changed, true);
  assert.equal((await store.getProgress("account-1")).guestPrologue.status, "victory");

  const repeated = await store.syncGuestProgress("account-1", localVictory, "merge");
  assert.equal(repeated.relation, "equal");
  assert.equal(repeated.changed, false);
});
