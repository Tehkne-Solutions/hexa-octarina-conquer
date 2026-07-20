import assert from "node:assert/strict";
import test from "node:test";

import { MemoryCampaignStore } from "../src/campaign-store.js";

function result(overrides = {}) {
  return {
    roomId: "ROOM-1",
    missionId: "c1-m1",
    success: true,
    stars: 3,
    rewardXp: 175,
    reason: "primary_objective",
    stats: {
      cells: 1,
      botCells: 0,
      duelsWon: 0,
      fortifications: 0,
      captures: 0,
      maxDuelCards: 0,
      turns: 4,
      hp: 20,
      largestProvince: 1,
      edgesPlayed: 4,
    },
    bonusCompleted: [true, true],
    finishedAt: 1000,
    ...overrides,
  };
}

test("records stars, unlocks the next mission and achievements", async () => {
  const store = new MemoryCampaignStore({ clock: () => 2000 });
  const recorded = await store.recordResult("account-1", result());
  const catalog = await store.getCatalog("account-1");

  assert.equal(recorded.recorded, true);
  assert.equal(recorded.progress.totals.stars, 3);
  assert.equal(recorded.progress.totals.completed, 1);
  assert.ok(recorded.unlockedAchievements.includes("first-sigil"));
  assert.ok(recorded.unlockedAchievements.includes("flawless"));
  assert.equal(catalog.missions.find((item) => item.id === "c1-m2").unlocked, true);
  assert.equal(catalog.missions.find((item) => item.id === "c1-m1").progress.stars, 3);
});

test("does not record the same campaign room twice", async () => {
  const store = new MemoryCampaignStore();
  const first = await store.recordResult("account-1", result());
  const duplicate = await store.recordResult("account-1", result());
  const progress = await store.getProgress("account-1");

  assert.equal(first.recorded, true);
  assert.equal(duplicate.recorded, false);
  assert.equal(progress.totals.attempts, 1);
  assert.equal(progress.totals.cells, 1);
});

test("keeps locked missions unavailable for authenticated progression", async () => {
  const store = new MemoryCampaignStore();
  await assert.rejects(
    () => store.assertMissionUnlocked("account-1", "c2-m1"),
    (error) => error.code === "MISSION_LOCKED",
  );
  await store.assertMissionUnlocked("account-1", "c1-m1");
});
