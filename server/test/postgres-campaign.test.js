import assert from "node:assert/strict";
import test from "node:test";

import { PostgresCampaignStore } from "../src/campaign-store.js";
import { PostgresIdentityStore } from "../src/identity-postgres.js";

const databaseUrl = process.env.DATABASE_URL;

function result(roomId = "PG-CAMPAIGN-1") {
  return {
    roomId,
    missionId: "c1-m1",
    success: true,
    stars: 2,
    rewardXp: 150,
    reason: "primary_objective",
    stats: {
      cells: 1,
      botCells: 0,
      duelsWon: 0,
      fortifications: 0,
      captures: 0,
      maxDuelCards: 0,
      largestProvince: 1,
      turns: 7,
      hp: 20,
      edgesPlayed: 4,
    },
    bonusCompleted: [false, true],
    finishedAt: Date.now(),
  };
}

test("PostgreSQL stores campaign results and XP transactionally and idempotently", { skip: !databaseUrl }, async () => {
  const identity = await PostgresIdentityStore.connect({ connectionString: databaseUrl });
  const store = await new PostgresCampaignStore({ connectionString: databaseUrl }).initialize();
  const handle = `pg-campaign-${Date.now()}`;
  let accountId = null;
  try {
    await store.pool.query("TRUNCATE campaign_rewards, campaign_progress");
    const session = await identity.register({
      handle,
      displayName: "Postgres Campaigner",
      password: "postgres-campaign-password",
    });
    accountId = session.account.id;

    const first = await store.recordResult(accountId, result());
    const duplicate = await store.recordResult(accountId, result());
    const firstXp = await identity.awardCampaignXp({ roomId: "PG-CAMPAIGN-1", accountId, xp: 150 });
    const duplicateXp = await identity.awardCampaignXp({ roomId: "PG-CAMPAIGN-1", accountId, xp: 150 });
    const catalog = await store.getCatalog(accountId);
    const profile = await identity.getProfile(accountId);

    assert.equal(first.recorded, true);
    assert.equal(duplicate.recorded, false);
    assert.equal(firstXp.recorded, true);
    assert.equal(firstXp.xpAwarded, 150);
    assert.equal(duplicateXp.recorded, false);
    assert.equal(duplicateXp.xpAwarded, 0);
    assert.equal(profile.xp, 150);
    assert.equal(catalog.totals.stars, 2);
    assert.equal(catalog.totals.attempts, 1);
    assert.equal(catalog.missions[1].unlocked, true);

    const persisted = await store.pool.query(
      "SELECT progress FROM campaign_progress WHERE account_id = $1",
      [accountId],
    );
    const reward = await store.pool.query(
      "SELECT xp FROM campaign_rewards WHERE room_id = $1",
      ["PG-CAMPAIGN-1"],
    );
    assert.equal(persisted.rowCount, 1);
    assert.equal(persisted.rows[0].progress.recordedRooms.length, 1);
    assert.equal(reward.rowCount, 1);
    assert.equal(Number(reward.rows[0].xp), 150);
  } finally {
    await store.pool.query("TRUNCATE campaign_rewards, campaign_progress");
    if (accountId) {
      await identity.pool.query("DELETE FROM account_sessions WHERE account_id = $1", [accountId]);
      await identity.pool.query("DELETE FROM accounts WHERE id = $1", [accountId]);
    }
    await store.close();
    await identity.close();
  }
});
