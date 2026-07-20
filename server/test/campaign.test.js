import assert from "node:assert/strict";
import test from "node:test";

import { GameRoom } from "../src/game-room.js";
import { RoomManager } from "../src/room-manager.js";

function command(room, player, type, payload) {
  return {
    type,
    payload: {
      roomId: room.id,
      playerId: player.id,
      sessionToken: player.sessionToken,
      expectedRevision: room.revision,
      ...payload,
    },
  };
}

test("creates an active campaign room with a server-controlled opponent", () => {
  const manager = new RoomManager();
  const result = manager.createCampaignRoom({
    missionId: "c1-m1",
    playerName: "Thales",
  });

  assert.equal(result.room.mode, "campaign");
  assert.equal(result.room.status, "active");
  assert.equal(result.room.players.length, 2);
  assert.equal(result.room.players[0].isBot, false);
  assert.equal(result.room.players[1].isBot, true);
  assert.equal(result.room.players[1].name, "Cartógrafo Cinzento");
  assert.equal(result.room.board.currentPlayerId, result.player.id);
  assert.equal(result.room.snapshot().campaign.mission.id, "c1-m1");
});

test("the campaign AI completes its turn after a human edge", () => {
  const manager = new RoomManager();
  const started = manager.createCampaignRoom({ missionId: "c1-m2", playerName: "Arquiteto" });
  const initialRevision = started.room.revision;

  const result = manager.applyCommand(command(
    started.room,
    started.player,
    "action.play_edge",
    { start: [0, 0], end: [1, 0] },
  ));

  assert.ok(result.followUpPatches.length >= 1);
  assert.ok(result.room.revision > initialRevision + 1);
  assert.equal(result.room.board.currentPlayerId, started.player.id);
  assert.equal(result.patch.revision, result.room.revision);
  assert.ok(result.room.board.edges.size >= 2);
});

test("campaign cards return to the compact hand after use", () => {
  const manager = new RoomManager();
  const started = manager.createCampaignRoom({ missionId: "c2-m2", playerName: "Arquiteto" });
  const room = started.room;
  const human = started.player;
  const originalHand = [...human.hand];

  room.board.cells.set("0,0", {
    id: "cell:0,0", x: 0, y: 0, ownerId: human.id, provinceId: "province-recycle",
  });
  room.board.provinces.set("province-recycle", {
    id: "province-recycle",
    ownerId: human.id,
    cellIds: ["cell:0,0"],
    unit: { kind: "recruit", level: 1, hp: 3, element: "physical" },
    protectedTurns: 0,
  });

  manager.applyCommand(command(room, human, "action.play_card", {
    cardId: "fortify",
    provinceId: "province-recycle",
  }));

  assert.equal(human.hand.length, originalHand.length);
  assert.equal(human.hand.filter((cardId) => cardId === "fortify").length, 1);
  assert.equal(room.campaign.stats.fortifications, 1);
  assert.equal(room.board.getProvince("province-recycle").unit.hp, 6);
});

test("finishes a mission and awards objective stars", () => {
  const manager = new RoomManager();
  const started = manager.createCampaignRoom({ missionId: "c1-m1", playerName: "Arquiteto" });
  const room = started.room;
  const human = started.player;

  room.board.cells.set("0,0", {
    id: "cell:0,0",
    x: 0,
    y: 0,
    ownerId: human.id,
    provinceId: "province-test",
  });
  room.board.provinces.set("province-test", {
    id: "province-test",
    ownerId: human.id,
    cellIds: ["cell:0,0"],
    unit: { kind: "recruit", level: 1, hp: 3, element: "physical" },
    protectedTurns: 0,
  });

  const patch = room.commit("campaign.test_progress", { playerId: human.id });
  const result = room.campaignResult();

  assert.equal(room.status, "finished");
  assert.equal(result.success, true);
  assert.equal(result.stars, 3);
  assert.equal(result.stats.cells, 1);
  assert.equal(patch.state.campaign.status, "completed");
  assert.equal(patch.state.campaign.primary.completed, true);
});

test("campaign state survives serialization and restoration", () => {
  const manager = new RoomManager();
  const started = manager.createCampaignRoom({ missionId: "c2-m1", playerName: "Conjurador" });
  const raw = started.room.serialize();
  const restored = GameRoom.restore(raw);

  assert.equal(raw.schemaVersion, 3);
  assert.equal(restored.mode, "campaign");
  assert.equal(restored.campaign.missionId, "c2-m1");
  assert.equal(restored.players.length, 2);
  assert.equal(restored.players[1].isBot, true);
  assert.equal(restored.players[1].connected, true);
  assert.equal(restored.snapshot().campaign.mission.title, "Maré e Trovão");
});
