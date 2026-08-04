import assert from "node:assert/strict";
import test from "node:test";

import { CAMPAIGN_MISSIONS } from "../src/campaign-catalog.js";
import { MemoryCampaignStore } from "../src/campaign-store.js";
import { RoomManager } from "../src/room-manager.js";

function seededVictory(mission, index) {
  return {
    roomId: `playtest-seed-${mission.id}`,
    missionId: mission.id,
    success: true,
    stars: 3,
    reason: "primary_objective",
    stats: {
      turns: 6 + index,
      hp: 20,
      cells: Math.max(2, mission.primary.type === "cells" ? mission.primary.target : 3),
      botCells: 0,
      fortifications: mission.primary.type === "fortifications" ? mission.primary.target : 2,
      duelsWon: mission.primary.type === "duels_won" ? mission.primary.target : 2,
      captures: mission.primary.type === "captures" ? mission.primary.target : 0,
      largestProvince: mission.primary.type === "largest_province" ? mission.primary.target : 3,
      maxDuelCards: 3,
      edgesPlayed: 6 + index,
    },
    bonusCompleted: [true, true],
    finishedAt: 1_900_000_000_000 + index,
  };
}

test("PLAYTEST 01 completes and persists the advanced c3-m2 capture lifecycle", async () => {
  const accountId = "playtest-chapter3";
  const store = new MemoryCampaignStore({ clock: () => 1_900_000_100_000 });

  // Seed the authoritative unlock chain through c3-m1.
  for (const [index, mission] of CAMPAIGN_MISSIONS.slice(0, 9).entries()) {
    const merged = await store.recordResult(accountId, seededVictory(mission, index));
    assert.equal(merged.recorded, true, `${mission.id} seed should record`);
  }

  const before = await store.getCatalog(accountId);
  const targetBefore = before.missions.find((mission) => mission.id === "c3-m2");
  assert.equal(targetBefore?.unlocked, true);
  assert.equal(targetBefore?.progress, null);

  const manager = new RoomManager();
  const started = manager.createCampaignRoom({ missionId: "c3-m2", playerName: "Playtester" });
  const room = started.room;
  const human = started.player;
  const bot = room.players.find((player) => player.isBot);

  assert.equal(room.snapshot().campaign.mission.id, "c3-m2");
  assert.equal(room.snapshot().campaign.primary.type, "captures");
  assert.equal(room.snapshot().campaign.primary.target, 2);

  room.commit("duel.round_resolved", {
    playerId: bot.id,
    submittedCardCount: 3,
    mergedProvinceId: "enemy-capture",
    resolution: { resolved: true, winnerId: bot.id },
  });
  assert.equal(room.campaign.stats.captures, 0);
  assert.equal(room.status, "active");

  room.commit("duel.round_resolved", {
    playerId: human.id,
    submittedCardCount: 2,
    mergedProvinceId: "human-capture-1",
    resolution: { resolved: true, winnerId: human.id },
  });
  assert.equal(room.campaign.stats.captures, 1);
  assert.equal(room.status, "active");

  room.commit("duel.round_resolved", {
    playerId: human.id,
    submittedCardCount: 2,
    mergedProvinceId: "human-capture-2",
    resolution: { resolved: true, winnerId: human.id },
  });

  const result = room.campaignResult();
  assert.equal(room.status, "finished");
  assert.equal(result.success, true);
  assert.equal(result.reason, "primary_objective");
  assert.equal(result.stats.captures, 2);
  assert.equal(result.stats.duelsWon, 2);
  assert.ok(result.stars >= 1 && result.stars <= 3);

  const recorded = await store.recordResult(accountId, {
    roomId: room.id,
    ...result,
  });
  assert.equal(recorded.recorded, true);

  const persisted = await store.getCatalog(accountId);
  const targetPersisted = persisted.missions.find((mission) => mission.id === "c3-m2");
  assert.equal(targetPersisted?.progress?.stars, result.stars);
  assert.equal(targetPersisted?.progress?.lastResult, "victory");
  assert.equal(persisted.totals.completed, 10);
  assert.equal(persisted.missions.find((mission) => mission.id === "c3-m3")?.unlocked, true);

  const worseReplay = await store.recordResult(accountId, {
    ...seededVictory(CAMPAIGN_MISSIONS.find((mission) => mission.id === "c3-m2"), 99),
    roomId: "playtest-c3-m2-worse-replay",
    stars: 1,
    stats: {
      ...result.stats,
      turns: result.stats.turns + 30,
      hp: 1,
    },
    bonusCompleted: [false, false],
  });

  assert.equal(worseReplay.recorded, true);
  assert.equal(worseReplay.progress.missions["c3-m2"].stars, result.stars);
  assert.equal(worseReplay.progress.missions["c3-m2"].attempts, 2);
  assert.equal(worseReplay.progress.totals.completed, 10);

  const afterReplay = await store.getCatalog(accountId);
  assert.equal(afterReplay.missions.find((mission) => mission.id === "c3-m2")?.progress?.stars, result.stars);
  assert.equal(afterReplay.missions.find((mission) => mission.id === "c3-m3")?.unlocked, true);
});
