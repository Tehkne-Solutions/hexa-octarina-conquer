import assert from "node:assert/strict";
import test from "node:test";

import { PostgresIdentityStore } from "../src/identity-postgres.js";

const connectionString = process.env.DATABASE_URL;

test("PostgreSQL stores accounts, sessions and progression transactionally", { skip: !connectionString }, async () => {
  const store = await PostgresIdentityStore.connect({ connectionString });
  const suffix = Date.now().toString(36);
  try {
    const first = await store.register({ handle: `winner_${suffix}`, displayName: "Vencedor", password: "senha-postgres-1" });
    const second = await store.register({ handle: `loser_${suffix}`, displayName: "Desafiante", password: "senha-postgres-2" });
    assert.equal((await store.authenticate(first.account.id, first.accessToken)).id, first.account.id);

    const progression = await store.recordMatch({
      roomId: `ROOM-${suffix}`,
      winnerAccountId: first.account.id,
      loserAccountId: second.account.id,
      reason: "forfeit",
    });
    assert.equal(progression.recorded, true);
    assert.equal((await store.getProfile(first.account.id)).wins, 1);
    assert.equal((await store.history(second.account.id))[0].loserAccountId, second.account.id);
  } finally {
    await store.close();
  }
});
