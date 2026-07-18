import assert from "node:assert/strict";
import test from "node:test";

import { RoomManager } from "../src/room-manager.js";
import { SqliteRoomStore } from "../src/room-store.js";

function deterministicIds() {
  let value = 0;
  return () => `id-${++value}`;
}

test("SQLite store commits room state and event journal atomically", () => {
  const store = new SqliteRoomStore({ filename: ":memory:" });
  try {
    const manager = new RoomManager({ store, idFactory: deterministicIds(), clock: () => 1000 });
    const created = manager.createRoom({ playerName: "A", boardSize: 3 });
    const joined = manager.joinRoom({ roomId: created.room.id, playerName: "B" });
    manager.applyCommand({
      type: "action.play_edge",
      payload: {
        roomId: created.room.id,
        playerId: created.player.id,
        sessionToken: created.player.sessionToken,
        expectedRevision: joined.room.revision,
        start: [0, 0],
        end: [1, 0],
      },
    });

    assert.equal(store.loadRooms().length, 1);
    assert.equal(store.countEvents(created.room.id), 3);

    const restored = new RoomManager({ store, idFactory: deterministicIds(), clock: () => 2000 });
    const room = restored.getRoom(created.room.id);
    assert.equal(room.board.edges.size, 1);
    assert.equal(room.revision, created.room.revision);
    assert.equal(room.players.every((player) => player.connected === false), true);
  } finally {
    store.close();
  }
});

test("SQLite store rolls forward only unique room events", () => {
  const store = new SqliteRoomStore({ filename: ":memory:" });
  try {
    const manager = new RoomManager({ store, idFactory: deterministicIds(), clock: () => 1000 });
    const created = manager.createRoom({ playerName: "A", boardSize: 3 });
    store.saveRoom(created.room);
    store.saveRoom(created.room);
    assert.equal(store.countEvents(created.room.id), 1);
  } finally {
    store.close();
  }
});
