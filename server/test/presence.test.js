import assert from "node:assert/strict";
import test from "node:test";

import { MemoryPresenceStore } from "../src/presence-store.js";

test("presence tracks players, instances and TTL expiration", async () => {
  let now = 1_000;
  const presence = new MemoryPresenceStore({ instanceId: "instance-a", clock: () => now, ttlMs: 1_000 });

  await presence.heartbeatInstance({ version: "0.6.0" });
  await presence.markOnline({ roomId: "ROOM1", playerId: "P1", accountId: "A1" });
  assert.deepEqual(await presence.summary(), { activeInstances: 1, activePlayers: 1 });
  assert.equal((await presence.listRoom("ROOM1"))[0].online, true);

  now += 600;
  await presence.heartbeatPlayer({ roomId: "ROOM1", playerId: "P1" });
  now += 600;
  assert.equal((await presence.listRoom("ROOM1")).length, 1);

  now += 1_100;
  assert.equal((await presence.listRoom("ROOM1")).length, 0);
  assert.equal(await presence.prune(), 1);
  assert.deepEqual(await presence.summary(), { activeInstances: 0, activePlayers: 0 });

  await presence.close();
});
