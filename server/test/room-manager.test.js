import assert from "node:assert/strict";
import test from "node:test";

import { ProtocolError } from "../src/protocol.js";
import { RoomManager } from "../src/room-manager.js";

function makeManager() {
  let index = 0;
  return new RoomManager({
    idFactory: () => `id-${String(++index).padStart(4, "0")}`,
    clock: () => 1_700_000_000_000 + index,
  });
}

function action(type, room, player, expectedRevision, extra) {
  return {
    type,
    requestId: `req-${expectedRevision}`,
    protocolVersion: "1.0",
    payload: {
      roomId: room.id,
      playerId: player.id,
      sessionToken: player.sessionToken,
      expectedRevision,
      ...extra,
    },
  };
}

test("creates a room and activates it after the second player joins", () => {
  const manager = makeManager();
  const first = manager.createRoom({ playerName: "A", boardSize: 5 });
  assert.equal(first.room.status, "waiting");

  const second = manager.joinRoom({ roomId: first.room.id, playerName: "B" });
  assert.equal(second.room.status, "active");
  assert.equal(second.room.players.length, 2);
  assert.equal(second.room.board.currentPlayerId, first.player.id);
});

test("rejects stale revisions and out-of-turn actions", () => {
  const manager = makeManager();
  const first = manager.createRoom({ playerName: "A", boardSize: 5 });
  const second = manager.joinRoom({ roomId: first.room.id, playerName: "B" });
  const room = second.room;

  manager.applyCommand(action("action.play_edge", room, first.player, room.revision, {
    start: [0, 0],
    end: [1, 0],
  }));

  assert.throws(() => manager.applyCommand(action("action.play_edge", room, first.player, room.revision - 1, {
    start: [0, 0],
    end: [0, 1],
  })), (error) => error instanceof ProtocolError && error.code === "REVISION_CONFLICT");

  assert.throws(() => manager.applyCommand(action("action.play_edge", room, first.player, room.revision, {
    start: [0, 0],
    end: [0, 1],
  })), (error) => error instanceof ProtocolError && error.code === "NOT_YOUR_TURN");
});

test("reconnects with incremental patches when history is available", () => {
  const manager = makeManager();
  const first = manager.createRoom({ playerName: "A", boardSize: 5 });
  const second = manager.joinRoom({ roomId: first.room.id, playerName: "B" });
  const room = second.room;
  const revisionBeforeAction = room.revision;

  manager.applyCommand(action("action.play_edge", room, first.player, room.revision, {
    start: [0, 0],
    end: [1, 0],
  }));

  const result = manager.reconnect({
    roomId: room.id,
    playerId: first.player.id,
    sessionToken: first.player.sessionToken,
    lastRevision: revisionBeforeAction,
  });

  assert.equal(result.mode, "patches");
  assert.equal(result.patches.length, 1);
  assert.equal(result.patches[0].event.type, "edge.played");
});

test("rejects invalid reconnection credentials", () => {
  const manager = makeManager();
  const created = manager.createRoom({ playerName: "A", boardSize: 5 });

  assert.throws(() => manager.reconnect({
    roomId: created.room.id,
    playerId: created.player.id,
    sessionToken: "wrong-token",
    lastRevision: 0,
  }), (error) => error instanceof ProtocolError && error.code === "INVALID_SESSION");
});
