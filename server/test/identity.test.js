import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { MemoryIdentityStore } from "../src/identity-memory.js";
import { SqliteIdentityStore } from "../src/identity-sqlite.js";
import { ProtocolError } from "../src/protocol.js";
import { RoomManager } from "../src/room-manager.js";

function deterministicIds() {
  let value = 0;
  return () => `id-${++value}`;
}

async function exerciseIdentity(store) {
  const first = await store.register({ handle: "octarina", displayName: "Octarina", password: "senha-segura-1" });
  const second = await store.register({ handle: "arquiteto", displayName: "Arquiteto", password: "senha-segura-2" });

  assert.equal(first.account.rating, 1000);
  assert.equal(await store.authenticate(first.account.id, first.accessToken).then((account) => account.handle), "octarina");
  assert.equal((await store.login({ handle: "OCTARINA", password: "senha-segura-1" })).account.id, first.account.id);
  await assert.rejects(
    store.login({ handle: "octarina", password: "senha-incorreta" }),
    (error) => error instanceof ProtocolError && error.code === "INVALID_LOGIN",
  );

  const result = await store.recordMatch({
    roomId: "ROOM-1",
    winnerAccountId: first.account.id,
    loserAccountId: second.account.id,
    reason: "forfeit",
    finishedAt: 2_000,
  });
  assert.equal(result.recorded, true);
  assert.equal((await store.recordMatch({
    roomId: "ROOM-1",
    winnerAccountId: first.account.id,
    loserAccountId: second.account.id,
  })).recorded, false);

  const leaderboard = await store.leaderboard();
  assert.equal(leaderboard[0].id, first.account.id);
  assert.equal(leaderboard[0].wins, 1);
  assert.equal(leaderboard[1].losses, 1);
  assert.equal((await store.history(first.account.id))[0].roomId, "ROOM-1");
  return { first, second };
}

test("memory identity supports secure sessions and idempotent progression", async () => {
  const store = new MemoryIdentityStore({ clock: () => 1_000, idFactory: deterministicIds() });
  await exerciseIdentity(store);
});

test("SQLite identity persists accounts, ranking and history", async () => {
  const directory = mkdtempSync(join(tmpdir(), "hexa-identity-"));
  const filename = join(directory, "identity.sqlite");
  try {
    const store = new SqliteIdentityStore({ filename, clock: () => 1_000, idFactory: deterministicIds() });
    const { first } = await exerciseIdentity(store);
    await store.close();

    const restored = new SqliteIdentityStore({ filename, clock: () => 3_000, idFactory: deterministicIds() });
    assert.equal((await restored.getProfile(first.account.id)).wins, 1);
    assert.equal((await restored.history(first.account.id))[0].reason, "forfeit");
    await restored.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("account-linked room produces a progression-ready result on forfeit", () => {
  const manager = new RoomManager({ idFactory: deterministicIds(), clock: () => 5_000 });
  const first = manager.createRoom({ playerName: "A", boardSize: 3, accountId: "account-a" });
  const second = manager.joinRoom({ roomId: first.room.id, playerName: "B", accountId: "account-b" });
  const patch = manager.applyCommand({
    type: "match.forfeit",
    payload: {
      roomId: first.room.id,
      playerId: second.player.id,
      sessionToken: second.player.sessionToken,
      expectedRevision: second.room.revision,
    },
  }).patch;

  assert.equal(patch.event.type, "match.finished");
  assert.equal(first.room.status, "finished");
  assert.equal(first.room.matchResult.winnerAccountId, "account-a");
  assert.equal(first.room.matchResult.loserAccountId, "account-b");
});
