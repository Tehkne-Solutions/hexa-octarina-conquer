import assert from "node:assert/strict";
import test from "node:test";

import { PostgresCampaignStore } from "../src/campaign-store.js";

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

test("PostgreSQL stores campaign results transactionally and idempotently", { skip: !databaseUrl }, async () => {
  const store = await new PostgresCampaignStore({ connectionString: databaseUrl }).initialize();
  try {
    await store.pool.query("TRUNCATE campaign_progress");
    const first = await store.recordResult("pg-campaign-account", result());
    const duplicate = await store.recordResult("pg-campaign-account", result());
    const catalog = await store.getCatalog("pg-campaign-account");

    assert.equal(first.recorded, true);
    assert.equal(duplicate.recorded, false);
    assert.equal(catalog.totals.stars, 2);
    assert.equal(catalog.totals.attempts, 1);
    assert.equal(catalog.missions[1].unlocked, true);

    const persisted = await store.pool.query(
      "SELECT progress FROM campaign_progress WHERE account_id = $1",
      ["pg-campaign-account"],
    );
    assert.equal(persisted.rowCount, 1);
    assert.equal(persisted.rows[0].progress.recordedRooms.length, 1);
  } finally {
    await store.pool.query("TRUNCATE campaign_progress");
    await store.close();
  }
});
