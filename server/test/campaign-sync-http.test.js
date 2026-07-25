import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { MemoryCampaignStore } from "../src/campaign-store.js";
import { MemoryIdentityStore } from "../src/identity-memory.js";
import { startServer } from "../src/server-campaign.js";

async function request(base, session, strategy, localProgress) {
  const response = await fetch(`${base}/campaign/sync-guest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accountId: session.account.id,
      accessToken: session.accessToken,
      strategy,
      localProgress,
    }),
  });
  return { response, payload: await response.json() };
}

test("previews, synchronizes and rewards a guest prologue exactly once", async () => {
  const identity = new MemoryIdentityStore({ clock: () => 10_000 });
  const campaign = new MemoryCampaignStore({ clock: () => 10_000 });
  const session = await identity.register({
    handle: "guest-migration",
    displayName: "Migrante",
    password: "guest-migration-password",
  });
  const instance = startServer({ port: 0, identity, campaign });
  const localProgress = {
    status: "victory",
    percent: 100,
    completedObjectives: 5,
    attempts: 2,
    bestTurn: 9,
    lastTurn: 9,
    building: "tower",
    rewards: ["Arco Prismático", "Torre Rúnica"],
    completedAt: 9000,
  };

  try {
    await once(instance.httpServer, "listening");
    const address = instance.httpServer.address();
    const base = `http://127.0.0.1:${address.port}`;

    const preview = await request(base, session, "preview", localProgress);
    assert.equal(preview.response.status, 200);
    assert.equal(preview.payload.relation, "local-ahead");
    assert.equal(preview.payload.changed, false);
    assert.equal((await campaign.getProgress(session.account.id)).guestPrologue.status, "not-started");

    const synchronized = await request(base, session, "merge", localProgress);
    assert.equal(synchronized.response.status, 200);
    assert.equal(synchronized.payload.changed, true);
    assert.equal(synchronized.payload.resolved.status, "victory");
    assert.equal(synchronized.payload.xpReward.recorded, true);
    assert.equal(synchronized.payload.xpReward.xpAwarded, 300);
    assert.equal(synchronized.payload.signature, "Tehkné Solutions");

    const duplicate = await request(base, session, "merge", localProgress);
    assert.equal(duplicate.payload.relation, "equal");
    assert.equal(duplicate.payload.changed, false);
    assert.equal(duplicate.payload.xpReward.recorded, false);
    assert.equal(duplicate.payload.profile.xp, 300);
  } finally {
    await instance.close();
  }
});

test("requires authentication and rejects unknown synchronization strategies", async () => {
  const instance = startServer({ port: 0 });
  try {
    await once(instance.httpServer, "listening");
    const address = instance.httpServer.address();
    const base = `http://127.0.0.1:${address.port}`;
    const unauthenticated = await fetch(`${base}/campaign/sync-guest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ strategy: "merge", localProgress: {} }),
    });
    assert.equal(unauthenticated.status, 400);

    const identity = instance.identity;
    const session = await identity.register({ handle: "invalid-strategy", displayName: "Teste", password: "valid-password" });
    const invalid = await request(base, session, "overwrite-everything", {});
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.payload.error, "INVALID_SYNC_STRATEGY");
  } finally {
    await instance.close();
  }
});
