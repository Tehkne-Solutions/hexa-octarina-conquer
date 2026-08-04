import assert from "node:assert/strict";
import test from "node:test";

import { PostgresCampaignStore } from "../src/campaign-store.js";
import { PostgresIdentityStore } from "../src/identity-postgres.js";

const databaseUrl = process.env.DATABASE_URL;

function result(roomId = "PG-CAMPAIGN-1", overrides = {}) {
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
    ...overrides,
  };
}

test("PostgreSQL stores campaign results, migrated guest progress and XP idempotently", { skip: !databaseUrl }, async () => {
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

    const preview = await store.syncGuestProgress(accountId, {
      status: "victory",
      percent: 100,
      completedObjectives: 5,
      attempts: 4,
      bestTurn: 8,
      lastTurn: 9,
      building: "farm",
      rewards: ["Arco Prismático", "Fazenda Arcana"],
    }, "preview");
    assert.equal(preview.relation, "local-ahead");
    assert.equal((await store.getProgress(accountId)).guestPrologue.status, "not-started");

    const guestSync = await store.syncGuestProgress(accountId, preview.local, "merge");
    assert.equal(guestSync.changed, true);
    assert.equal(guestSync.resolved.building, "farm");

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
    assert.equal(persisted.rows[0].progress.guestPrologue.status, "victory");
    assert.equal(persisted.rows[0].progress.guestPrologue.bestTurn, 8);
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

test("PLAYTEST 01 persists campaign progress across a fresh PostgreSQL store and never degrades mastery", { skip: !databaseUrl }, async () => {
  const identity = await PostgresIdentityStore.connect({ connectionString: databaseUrl });
  let store = await new PostgresCampaignStore({ connectionString: databaseUrl }).initialize();
  const handle = `pg-campaign-reload-${Date.now()}`;
  let accountId = null;

  try {
    await store.pool.query("TRUNCATE campaign_rewards, campaign_progress");
    const session = await identity.register({
      handle,
      displayName: "Reload Campaigner",
      password: "reload-campaign-password",
    });
    accountId = session.account.id;

    const first = await store.recordResult(accountId, result("PG-CAMPAIGN-RELOAD-1", {
      stars: 3,
      stats: {
        cells: 1,
        botCells: 0,
        duelsWon: 0,
        fortifications: 0,
        captures: 0,
        maxDuelCards: 0,
        largestProvince: 1,
        turns: 4,
        hp: 20,
        edgesPlayed: 4,
      },
      bonusCompleted: [true, true],
    }));

    assert.equal(first.recorded, true);
    assert.equal(first.progress.missions["c1-m1"].stars, 3);
    assert.equal(first.progress.totals.completed, 1);
    assert.equal(first.progress.totals.stars, 3);

    await store.close();
    store = await new PostgresCampaignStore({ connectionString: databaseUrl }).initialize();

    const reloaded = await store.getCatalog(accountId);
    assert.equal(reloaded.missions.find((item) => item.id === "c1-m1")?.progress?.stars, 3);
    assert.equal(reloaded.missions.find((item) => item.id === "c1-m2")?.unlocked, true);
    assert.equal(reloaded.totals.completed, 1);
    assert.equal(reloaded.totals.stars, 3);

    const worseReplay = await store.recordResult(accountId, result("PG-CAMPAIGN-RELOAD-2", {
      stars: 1,
      stats: {
        cells: 1,
        botCells: 0,
        duelsWon: 0,
        fortifications: 0,
        captures: 0,
        maxDuelCards: 0,
        largestProvince: 1,
        turns: 18,
        hp: 4,
        edgesPlayed: 18,
      },
      bonusCompleted: [false, false],
    }));

    assert.equal(worseReplay.recorded, true);
    assert.equal(worseReplay.progress.missions["c1-m1"].stars, 3);
    assert.equal(worseReplay.progress.missions["c1-m1"].attempts, 2);
    assert.equal(worseReplay.progress.totals.completed, 1);
    assert.equal(worseReplay.progress.totals.stars, 3);

    const afterReplay = await store.getCatalog(accountId);
    assert.equal(afterReplay.missions.find((item) => item.id === "c1-m1")?.progress?.stars, 3);
    assert.equal(afterReplay.missions.find((item) => item.id === "c1-m2")?.unlocked, true);
    assert.equal(afterReplay.totals.completed, 1);
    assert.equal(afterReplay.totals.stars, 3);
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
