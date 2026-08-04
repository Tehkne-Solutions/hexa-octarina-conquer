import assert from "node:assert/strict";
import test from "node:test";

import { CAMPAIGN_MISSIONS } from "../src/campaign-catalog.js";
import { RoomManager } from "../src/room-manager.js";

const SUPPORTED_OBJECTIVES = new Set([
  "cells",
  "cell_lead",
  "fortifications",
  "duels_won",
  "captures",
  "largest_province",
  "duel_cards",
  "turns_max",
  "hp_min",
]);

function startMission(missionId) {
  const manager = new RoomManager();
  const started = manager.createCampaignRoom({ missionId, playerName: "Integrity" });
  return { manager, ...started, human: started.player, bot: started.room.players.find((item) => item.isBot) };
}

function putCell(room, { id, ownerId, provinceId }) {
  room.board.cells.set(id, {
    id: `cell:${id}`,
    x: Number(id.split(",")[0] ?? 0),
    y: Number(id.split(",")[1] ?? 0),
    ownerId,
    provinceId,
  });
}

test("all 12 authoritative missions use runtime-supported objective types", () => {
  assert.equal(CAMPAIGN_MISSIONS.length, 12);
  for (const mission of CAMPAIGN_MISSIONS) {
    assert.equal(mission.bonus.length, 2, `${mission.id} must keep two bonus objectives`);
    for (const objective of [mission.primary, ...mission.bonus]) {
      assert.equal(SUPPORTED_OBJECTIVES.has(objective.type), true, `${mission.id} uses unsupported ${objective.type}`);
    }
  }
});

test("cell_lead primary objective completes from derived board ownership", () => {
  const { room, human, bot } = startMission("c1-m4");
  putCell(room, { id: "0,0", ownerId: human.id, provinceId: "h-1" });
  putCell(room, { id: "1,0", ownerId: human.id, provinceId: "h-1" });
  putCell(room, { id: "2,0", ownerId: human.id, provinceId: "h-2" });
  putCell(room, { id: "3,0", ownerId: bot.id, provinceId: "b-1" });

  room.commit("campaign.integrity.cell_lead", { playerId: human.id });

  assert.equal(room.campaign.stats.cells, 3);
  assert.equal(room.campaign.stats.botCells, 1);
  assert.equal(room.campaign.result?.success, true);
  assert.equal(room.campaign.result?.reason, "primary_objective");
});

test("largest_province primary objective is derived from province cell membership", () => {
  const { room, human } = startMission("c2-m3");
  for (const id of ["0,0", "1,0", "2,0"]) {
    putCell(room, { id, ownerId: human.id, provinceId: "province-wide" });
  }
  room.board.provinces.set("province-wide", {
    id: "province-wide",
    ownerId: human.id,
    cellIds: ["cell:0,0", "cell:1,0", "cell:2,0"],
    unit: { kind: "recruit", level: 1, hp: 3, element: "physical" },
    protectedTurns: 0,
  });

  room.commit("campaign.integrity.largest_province", { playerId: human.id });

  assert.equal(room.campaign.stats.largestProvince, 3);
  assert.equal(room.campaign.result?.success, true);
});

test("duel_cards bonus tracks the largest real human submission", () => {
  const { room, human } = startMission("c2-m1");

  room.commit("duel.cards_submitted", { playerId: human.id, submittedCardCount: 1 });
  room.commit("duel.cards_submitted", { playerId: human.id, submittedCardCount: 2 });

  const state = room.snapshot().campaign;
  assert.equal(state.stats.maxDuelCards, 2);
  assert.equal(state.bonus.find((objective) => objective.type === "duel_cards")?.completed, true);
  assert.equal(room.status, "active");
});

test("captures primary objective increments only from resolved human duel captures", () => {
  const { room, human, bot } = startMission("c3-m2");

  room.commit("duel.round_resolved", {
    playerId: bot.id,
    submittedCardCount: 3,
    mergedProvinceId: "enemy-capture",
    resolution: { resolved: true, winnerId: bot.id },
  });
  assert.equal(room.campaign.stats.captures, 0);

  room.commit("duel.round_resolved", {
    playerId: human.id,
    submittedCardCount: 2,
    mergedProvinceId: "capture-1",
    resolution: { resolved: true, winnerId: human.id },
  });
  assert.equal(room.campaign.stats.captures, 1);
  assert.equal(room.status, "active");

  room.commit("duel.round_resolved", {
    playerId: human.id,
    submittedCardCount: 2,
    mergedProvinceId: "capture-2",
    resolution: { resolved: true, winnerId: human.id },
  });

  assert.equal(room.campaign.stats.captures, 2);
  assert.equal(room.campaign.stats.duelsWon, 2);
  assert.equal(room.campaign.result?.success, true);
  assert.equal(room.campaign.result?.reason, "primary_objective");
});
