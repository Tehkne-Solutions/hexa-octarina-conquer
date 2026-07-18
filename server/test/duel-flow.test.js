import assert from "node:assert/strict";
import test from "node:test";

import { RoomManager } from "../src/room-manager.js";

function makeManager() {
  let index = 0;
  return new RoomManager({
    idFactory: () => `id-${String(++index).padStart(4, "0")}`,
    clock: () => 1_700_000_000_000 + index,
  });
}

function command(type, room, player, payload) {
  return {
    type,
    requestId: `${type}-${room.revision}`,
    protocolVersion: "1.0",
    payload: {
      roomId: room.id,
      playerId: player.id,
      sessionToken: player.sessionToken,
      expectedRevision: room.revision,
      ...payload,
    },
  };
}

function edge(manager, room, player, start, end) {
  return manager.applyCommand(command("action.play_edge", room, player, { start, end }));
}

test("resolves a wet plus lightning duel and captures the province", () => {
  const manager = makeManager();
  const first = manager.createRoom({ playerName: "A", boardSize: 3 });
  const second = manager.joinRoom({ roomId: first.room.id, playerName: "B" });
  const room = second.room;

  edge(manager, room, first.player, [0, 0], [1, 0]);
  edge(manager, room, second.player, [0, 0], [0, 1]);
  edge(manager, room, first.player, [1, 0], [1, 1]);
  edge(manager, room, second.player, [0, 1], [1, 1]);

  assert.equal(room.board.getProvince("cell:0,0").ownerId, second.player.id);
  assert.equal(room.board.currentPlayerId, second.player.id);

  edge(manager, room, second.player, [1, 0], [2, 0]);
  assert.equal(room.board.currentPlayerId, first.player.id);

  manager.applyCommand(command("action.play_card", room, first.player, {
    cardId: "duel",
    provinceId: "cell:0,0",
  }));

  const duel = [...room.duels.values()][0];
  assert.ok(duel);

  manager.applyCommand(command("action.resolve_duel_round", room, first.player, {
    duelId: duel.id,
    cardIds: ["wet", "lightning"],
  }));
  manager.applyCommand(command("action.resolve_duel_round", room, second.player, {
    duelId: duel.id,
    cardIds: [],
  }));

  assert.equal(duel.status, "resolved");
  assert.equal(duel.winnerId, first.player.id);
  assert.equal(room.board.getProvince("cell:0,0").ownerId, first.player.id);
});
