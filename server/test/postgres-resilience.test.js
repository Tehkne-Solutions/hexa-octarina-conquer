import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { GameRoom } from "../src/game-room.js";
import { PostgresResilienceStore } from "../src/resilience-store.js";

const connectionString = process.env.DATABASE_URL;

test("postgres resilience store claims leases once and persists replay events", { skip: !connectionString }, async () => {
  let now = 20_000;
  const store = await PostgresResilienceStore.connect({ connectionString, clock: () => now });
  const roomId = `R${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const playerId = `P${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  let sequence = 0;

  try {
    await store.scheduleDisconnect({ roomId, playerId, accountId: null, deadlineAt: 20_500 });
    assert.equal((await store.listDisconnects(roomId)).length, 1);
    assert.deepEqual(await store.claimExpiredDisconnects(), []);
    now = 20_500;
    const claimed = await store.claimExpiredDisconnects();
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].roomId, roomId);
    assert.deepEqual(await store.claimExpiredDisconnects(), []);

    const room = new GameRoom({
      id: roomId,
      boardSize: 3,
      idFactory: () => `id-${++sequence}`,
      clock: () => 30_000 + sequence,
    });
    const first = room.addPlayer("Alpha");
    const second = room.addPlayer("Beta");
    await store.appendReplay(room, first.patch);
    await store.appendReplay(room, second.patch);

    const replay = await store.getReplay(roomId);
    assert.equal(replay.status, "active");
    assert.equal(replay.events.length, 2);
    assert.deepEqual(replay.events.map((entry) => entry.revision), [1, 2]);
    assert.equal((await store.listReplays({ limit: 10 })).some((entry) => entry.roomId === roomId), true);
  } finally {
    await store.pool.query("DELETE FROM reconnect_leases WHERE room_id = $1", [roomId]);
    await store.pool.query("DELETE FROM match_replays WHERE room_id = $1", [roomId]);
    await store.close();
  }
});
