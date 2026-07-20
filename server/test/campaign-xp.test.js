import assert from "node:assert/strict";
import test from "node:test";

import { MemoryIdentityStore } from "../src/identity-memory.js";
import { SqliteIdentityStore } from "../src/identity-sqlite.js";

async function verifyRewardStore(identity, handle) {
  const session = await identity.register({
    handle,
    displayName: "Campaign Hero",
    password: "campaign-reward-password",
  });

  const first = await identity.awardCampaignXp({
    roomId: `${handle}-room`,
    accountId: session.account.id,
    xp: 195,
  });
  const duplicate = await identity.awardCampaignXp({
    roomId: `${handle}-room`,
    accountId: session.account.id,
    xp: 195,
  });
  const profile = await identity.getProfile(session.account.id);

  assert.equal(first.recorded, true);
  assert.equal(first.xpAwarded, 195);
  assert.equal(first.profile.xp, 195);
  assert.equal(duplicate.recorded, false);
  assert.equal(duplicate.xpAwarded, 0);
  assert.equal(profile.xp, 195);
  assert.equal(profile.level, first.profile.level);
}

test("memory identity awards campaign XP once per room", async () => {
  const identity = new MemoryIdentityStore();
  await verifyRewardStore(identity, "memory-campaign-xp");
  await identity.close();
});

test("SQLite identity awards campaign XP once per room", async () => {
  const identity = new SqliteIdentityStore({ filename: ":memory:" });
  try {
    await verifyRewardStore(identity, "sqlite-campaign-xp");
    const rewardCount = identity.database.prepare("SELECT COUNT(*) AS total FROM campaign_rewards").get();
    assert.equal(Number(rewardCount.total), 1);
  } finally {
    await identity.close();
  }
});
