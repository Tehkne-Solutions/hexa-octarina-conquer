import assert from "node:assert/strict";
import test from "node:test";

import { MemoryResilienceStore } from "../src/resilience-store.js";
import { RoomManager } from "../src/room-manager.js";

test("reconnect leases can be cancelled or claimed once after expiry", async () => {
  let now = 1_000;
  const store = new MemoryResilienceStore({ clock: () => now, reconnectGraceMs: 500 });

  const first = await store.scheduleDisconnect({ roomId: "ROOM-A", playerId: "P1", accountId: "A1" });
  assert.equal(first.deadlineAt, 1_500);
  assert.equal((await store.listDisconnects()).length, 1);
  assert.deepEqual(await store.cancelDisconnect("ROOM-A", "P1"), { cancelled: true });
  assert.equal((await store.listDisconnects()).length, 0);

  await store.scheduleDisconnect({ roomId: "ROOM-A", playerId: "P1", accountId: "A1" });
  now = 1_499;
  assert.deepEqual(await store.claimExpiredDisconnects(), []);
  now = 1_500;
  const claimed = await store.claimExpiredDisconnects();
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].playerId, "P1");
  assert.deepEqual(await store.claimExpiredDisconnects(), []);
});

test("replay archive stores public patches in revision order", async () => {
  let sequence = 0;
  const manager = new RoomManager({
    idFactory: () => `id-${++sequence}`,
    clock: () => 10_000 + sequence,
  });
  const store = new MemoryResilienceStore();

  const created = manager.createRoom({ roomId: "REPLAY01", playerName: "Alpha", boardSize: 3 });
  const joined = manager.joinRoom({ roomId: "REPLAY01", playerName: "Beta" });
  await store.appendReplay(created.room, created.patch);
  await store.appendReplay(joined.room, joined.patch);

  const replay = await store.getReplay("REPLAY01");
  const serialized = JSON.stringify(replay);
  assert.equal(replay.status, "active");
  assert.equal(replay.events.length, 2);
  assert.deepEqual(replay.events.map((entry) => entry.revision), [1, 2]);
  assert.equal(serialized.includes("sessionToken"), false);
  assert.equal(serialized.includes('"hand":'), false);
  assert.equal(serialized.includes('"handSize":'), true);
});

test("expired active disconnect becomes an authoritative abandonment", () => {
  let sequence = 0;
  const manager = new RoomManager({ idFactory: () => `id-${++sequence}` });
  const created = manager.createRoom({ roomId: "ABANDON1", playerName: "Alpha", boardSize: 3, accountId: "account-a" });
  manager.joinRoom({ roomId: "ABANDON1", playerName: "Beta", accountId: "account-b" });

  const result = manager.expireDisconnect("ABANDON1", created.player.id);
  assert.equal(result.room.status, "finished");
  assert.equal(result.patch.event.type, "match.finished");
  assert.equal(result.room.matchResult.reason, "abandonment");
  assert.equal(result.room.matchResult.loserAccountId, "account-a");
});
