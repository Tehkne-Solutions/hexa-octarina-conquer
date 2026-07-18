import assert from "node:assert/strict";
import test from "node:test";

import { GameRoom } from "../src/game-room.js";
import { PostgresRoomStore } from "../src/postgres-room-store.js";

const databaseUrl = process.env.DATABASE_URL;

test("PostgreSQL room store rejects stale writers", { skip: !databaseUrl }, async () => {
  const store = await PostgresRoomStore.connect({ connectionString: databaseUrl });
  try {
    await store.pool.query("TRUNCATE distributed_room_events, distributed_rooms CASCADE");
    const room = new GameRoom({ id: "PGROOM09", boardSize: 3 });
    room.addPlayer("Alpha", { accountId: "account-alpha" });
    await store.saveRoom(room, { expectedRevision: null });

    const firstCopy = GameRoom.restore(await store.loadRoom(room.id));
    const staleCopy = GameRoom.restore(await store.loadRoom(room.id));
    const originalRevision = firstCopy.revision;
    firstCopy.addPlayer("Beta", { accountId: "account-beta" });
    await store.saveRoom(firstCopy, { expectedRevision: originalRevision });

    staleCopy.addPlayer("Gamma", { accountId: "account-gamma" });
    await assert.rejects(
      store.saveRoom(staleCopy, { expectedRevision: originalRevision }),
      (error) => error.code === "ROOM_WRITE_CONFLICT" && error.details.currentRevision === firstCopy.revision,
    );

    const restored = GameRoom.restore(await store.loadRoom(room.id));
    assert.deepEqual(restored.players.map((player) => player.name), ["Alpha", "Beta"]);
    assert.equal(await store.countEvents(room.id), 2);
  } finally {
    await store.pool.query("TRUNCATE distributed_room_events, distributed_rooms CASCADE");
    await store.close();
  }
});
