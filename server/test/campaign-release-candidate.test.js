import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_MISSIONS,
  emptyCampaignProgress,
  mergeCampaignResult,
  publicCampaignCatalog,
  unlockedMissionIds,
} from "../src/campaign-catalog.js";

function victoryResult(mission, index, overrides = {}) {
  return {
    roomId: `vs72-room-${index + 1}`,
    missionId: mission.id,
    success: true,
    stars: 3,
    stats: {
      turns: Math.max(1, 6 + index),
      hp: 20,
      cells: Math.max(1, mission.primary.type === "cells" ? mission.primary.target : 2),
      botCells: 0,
      fortifications: mission.primary.type === "fortifications" ? mission.primary.target : 1,
      duelsWon: mission.primary.type === "duels_won" ? mission.primary.target : 1,
      captures: mission.primary.type === "captures" ? mission.primary.target : 0,
      largestProvince: mission.primary.type === "largest_province" ? mission.primary.target : 2,
      maxDuelCards: 3,
    },
    ...overrides,
  };
}

test("release-candidate progression unlocks the campaign sequentially from mission 1 through mission 12", () => {
  let progress = emptyCampaignProgress();

  assert.deepEqual(unlockedMissionIds(progress), [CAMPAIGN_MISSIONS[0].id]);

  for (let index = 0; index < CAMPAIGN_MISSIONS.length; index += 1) {
    const mission = CAMPAIGN_MISSIONS[index];
    const before = publicCampaignCatalog(progress);

    assert.equal(before.missions[index].unlocked, true, `${mission.id} must be unlocked before it can be completed`);
    if (index + 1 < CAMPAIGN_MISSIONS.length) {
      assert.equal(before.missions[index + 1].unlocked, false, `${CAMPAIGN_MISSIONS[index + 1].id} must remain locked before ${mission.id}`);
    }

    const merged = mergeCampaignResult(progress, victoryResult(mission, index), 1_800_000_000_000 + index);
    assert.equal(merged.recorded, true);
    progress = merged.progress;

    assert.equal(progress.missions[mission.id].stars, 3);
    assert.equal(progress.missions[mission.id].lastResult, "victory");
    assert.equal(progress.totals.completed, index + 1);
    assert.equal(progress.totals.stars, (index + 1) * 3);

    const unlocked = unlockedMissionIds(progress);
    assert.equal(unlocked.includes(mission.id), true);
    if (index + 1 < CAMPAIGN_MISSIONS.length) {
      assert.equal(unlocked.includes(CAMPAIGN_MISSIONS[index + 1].id), true, `${CAMPAIGN_MISSIONS[index + 1].id} must unlock after ${mission.id}`);
    }
  }

  assert.equal(progress.totals.completed, 12);
  assert.equal(progress.totals.stars, 36);
  assert.equal(unlockedMissionIds(progress).length, 12);
});

test("release-candidate final state exposes all missions, 36 stars and the authoritative legend achievement only after 12/12", () => {
  let progress = emptyCampaignProgress();

  for (let index = 0; index < CAMPAIGN_MISSIONS.length - 1; index += 1) {
    progress = mergeCampaignResult(progress, victoryResult(CAMPAIGN_MISSIONS[index], index), 1_800_000_100_000 + index).progress;
  }

  const beforeFinal = publicCampaignCatalog(progress);
  assert.equal(beforeFinal.totals.completed, 11);
  assert.equal(beforeFinal.totals.stars, 33);
  assert.equal(beforeFinal.achievements.find((item) => item.id === "legend")?.unlockedAt, null);
  assert.equal(beforeFinal.missions.at(-1)?.unlocked, true);
  assert.equal(beforeFinal.missions.at(-1)?.progress, null);

  const finalMerge = mergeCampaignResult(
    progress,
    victoryResult(CAMPAIGN_MISSIONS.at(-1), CAMPAIGN_MISSIONS.length - 1),
    1_800_000_200_000,
  );
  progress = finalMerge.progress;

  const completed = publicCampaignCatalog(progress);
  const legend = completed.achievements.find((item) => item.id === "legend");

  assert.equal(completed.totals.completed, 12);
  assert.equal(completed.totals.stars, 36);
  assert.equal(completed.missions.every((item) => item.unlocked), true);
  assert.equal(completed.missions.every((item) => (item.progress?.stars ?? 0) === 3), true);
  assert.equal(legend?.unlockedAt, 1_800_000_200_000);
  assert.equal(finalMerge.unlockedAchievements.includes("legend"), true);
});

test("release-candidate replay is idempotent for duplicate rooms and never degrades mastered missions", () => {
  let progress = emptyCampaignProgress();
  const mission = CAMPAIGN_MISSIONS[0];
  const first = victoryResult(mission, 0);

  const initialMerge = mergeCampaignResult(progress, first, 1_800_000_300_000);
  progress = initialMerge.progress;

  const duplicate = mergeCampaignResult(progress, first, 1_800_000_300_100);
  assert.equal(duplicate.recorded, false);
  assert.deepEqual(duplicate.progress, progress);

  const replay = mergeCampaignResult(
    progress,
    victoryResult(mission, 99, {
      roomId: "vs72-replay-c1-m1",
      stars: 1,
      stats: {
        ...first.stats,
        turns: first.stats.turns + 20,
        hp: 4,
      },
    }),
    1_800_000_300_200,
  );

  assert.equal(replay.recorded, true);
  assert.equal(replay.progress.missions[mission.id].stars, 3);
  assert.equal(replay.progress.missions[mission.id].bestTurns, first.stats.turns);
  assert.equal(replay.progress.missions[mission.id].bestHp, first.stats.hp);
  assert.equal(replay.progress.totals.completed, 1);
  assert.equal(replay.progress.totals.stars, 3);
  assert.equal(replay.progress.missions[mission.id].attempts, 2);
});
