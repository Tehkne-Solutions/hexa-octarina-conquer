import assert from "node:assert/strict";
import test from "node:test";

import { PostgresClusterBus } from "../src/cluster-bus.js";
import { PostgresCompetitionStore } from "../src/competition-postgres.js";
import { PostgresGovernanceStore } from "../src/governance-store.js";
import { PostgresIdentityStore } from "../src/identity-postgres.js";
import { PostgresPresenceStore } from "../src/presence-store.js";

const databaseUrl = process.env.DATABASE_URL;

function waitForEvent(bus, topic, timeoutMs = 3_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`timeout waiting for ${topic}`));
    }, timeoutMs);
    const unsubscribe = bus.subscribe((event) => {
      if (event.topic !== topic) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(event);
    });
  });
}

test("PostgreSQL distributes events, presence and competitive penalties", { skip: !databaseUrl }, async () => {
  const identity = await PostgresIdentityStore.connect({ connectionString: databaseUrl });
  const competition = await PostgresCompetitionStore.connect({ connectionString: databaseUrl });
  const governance = await PostgresGovernanceStore.connect({ connectionString: databaseUrl });
  const firstBus = await PostgresClusterBus.connect({ connectionString: databaseUrl, instanceId: "pg-replica-a" });
  const secondBus = await PostgresClusterBus.connect({ connectionString: databaseUrl, instanceId: "pg-replica-b" });
  const firstPresence = await PostgresPresenceStore.connect({ connectionString: databaseUrl, instanceId: "pg-replica-a", ttlMs: 10_000 });
  const secondPresence = await PostgresPresenceStore.connect({ connectionString: databaseUrl, instanceId: "pg-replica-b", ttlMs: 10_000 });

  try {
    await identity.pool.query(`
      TRUNCATE cluster_events, player_presence, cluster_instances, competitive_penalties,
        recovery_challenges, telemetry_events, matchmaking_matches, matchmaking_queue,
        season_ratings, competitive_seasons, match_history, account_sessions, accounts CASCADE
    `);
    await competition.currentSeason();

    const firstEvent = waitForEvent(secondBus, "room.update");
    await firstBus.publish("room.update", {
      roomId: "ROOMPG01",
      messages: [{ type: "room.patch", payload: { text: "z".repeat(16_000) } }],
    });
    const delivered = await firstEvent;
    assert.equal(delivered.originInstanceId, "pg-replica-a");
    assert.equal(delivered.payload.messages[0].payload.text.length, 16_000);

    await firstPresence.heartbeatInstance({ version: "0.6.0" });
    await secondPresence.heartbeatInstance({ version: "0.6.0" });
    await firstPresence.markOnline({ roomId: "ROOMPG01", playerId: "P1", accountId: null });
    await secondPresence.markOnline({ roomId: "ROOMPG01", playerId: "P2", accountId: null });
    assert.equal((await firstPresence.listRoom("ROOMPG01")).length, 2);
    assert.deepEqual(await secondPresence.summary(), { activeInstances: 2, activePlayers: 2 });

    const alpha = await identity.register({ handle: "cluster_alpha", displayName: "Cluster Alpha", password: "password-alpha" });
    const beta = await identity.register({ handle: "cluster_beta", displayName: "Cluster Beta", password: "password-beta" });
    const queued = await competition.enqueue({ account: alpha.account, region: "br", boardSize: 5 });
    const matched = await competition.enqueue({ account: beta.account, region: "br", boardSize: 5 });
    assert.equal(queued.state, "queued");
    assert.equal(matched.state, "matched");
    await competition.accept(alpha.account.id, matched.match.id);
    await competition.pool.query("UPDATE matchmaking_matches SET expires_at = $2 WHERE id = $1", [matched.match.id, Date.now() - 1]);

    const expired = await governance.expireAssignments();
    assert.equal(expired.length, 1);
    assert.equal(expired[0].accountId, beta.account.id);
    await assert.rejects(
      governance.assertEligible(beta.account.id),
      (error) => error.code === "MATCHMAKING_COOLDOWN",
    );
    await governance.assertEligible(alpha.account.id);
  } finally {
    await identity.pool.query(`
      TRUNCATE cluster_events, player_presence, cluster_instances, competitive_penalties,
        recovery_challenges, telemetry_events, matchmaking_matches, matchmaking_queue,
        season_ratings, competitive_seasons, match_history, account_sessions, accounts CASCADE
    `);
    await firstPresence.close();
    await secondPresence.close();
    await firstBus.close();
    await secondBus.close();
    await governance.close();
    await competition.close();
    await identity.close();
  }
});
