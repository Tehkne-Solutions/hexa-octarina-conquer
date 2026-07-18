import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { FileRoomStore } from "../src/room-store.js";
import { RoomManager } from "../src/room-manager.js";

function deterministicIds() {
  let value = 0;
  return () => `id-${++value}`;
}

test("restores rooms, sessions and board state after process restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "hexa-rooms-"));
  try {
    const store = new FileRoomStore({ directory });
    const firstManager = new RoomManager({ store, idFactory: deterministicIds(), clock: () => 1000 });
    const created = firstManager.createRoom({ playerName: "A", boardSize: 3 });
    const joined = firstManager.joinRoom({ roomId: created.room.id, playerName: "B" });

    const command = {
      type: "action.play_edge",
      payload: {
        roomId: created.room.id,
        playerId: created.player.id,
        sessionToken: created.player.sessionToken,
        expectedRevision: joined.room.revision,
        start: [0, 0],
        end: [1, 0],
      },
    };
    firstManager.applyCommand(command);
    const persistedRevision = created.room.revision;

    const restoredManager = new RoomManager({ store, idFactory: deterministicIds(), clock: () => 2000 });
    const restored = restoredManager.getRoom(created.room.id);

    assert.equal(restored.revision, persistedRevision);
    assert.equal(restored.board.edges.size, 1);
    assert.equal(restored.players.length, 2);
    assert.equal(restored.players[0].sessionToken, created.player.sessionToken);
    assert.equal(restored.players[1].sessionToken, joined.player.sessionToken);

    const reconnect = restoredManager.reconnect({
      roomId: restored.id,
      playerId: created.player.id,
      sessionToken: created.player.sessionToken,
      lastRevision: 0,
    });
    assert.ok(["patches", "snapshot"].includes(reconnect.mode));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("lobby summaries never expose session tokens", () => {
  const manager = new RoomManager({ idFactory: deterministicIds(), clock: () => 1000 });
  const created = manager.createRoom({ playerName: "A", boardSize: 5 });
  const [summary] = manager.listRooms();

  assert.equal(summary.roomId, created.room.id);
  assert.equal(summary.playerCount, 1);
  assert.equal(summary.boardSize, 5);
  assert.equal(JSON.stringify(summary).includes("sessionToken"), false);
});
