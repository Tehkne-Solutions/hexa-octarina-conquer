import assert from "node:assert/strict";
import test from "node:test";

import { PostgresCompetitionStore } from "../src/competition-postgres.js";
import { PostgresIdentityStore } from "../src/identity-postgres.js";

const databaseUrl = process.env.DATABASE_URL;

test("PostgreSQL persists matchmaking, season, telemetry and recovery", { skip: !databaseUrl }, async () => {
  const identity = await PostgresIdentityStore.connect({ connectionString: databaseUrl });
  const competition = await PostgresCompetitionStore.connect({ connectionString: databaseUrl });
  try {
    await competition.pool.query(`
      TRUNCATE recovery_challenges, telemetry_events, matchmaking_matches, matchmaking_queue,
        season_ratings, competitive_seasons, match_history, account_sessions, accounts CASCADE
    `);
    const first = await identity.register({ handle: "pg_alpha", displayName: "PG Alpha", password: "password-alpha" });
    const second = await identity.register({ handle: "pg_beta", displayName: "PG Beta", password: "password-beta" });

    const queued = await competition.enqueue({ account: first.account, region: "br", boardSize: 5 });
    const matched = await competition.enqueue({ account: second.account, region: "br", boardSize: 5 });
    assert.equal(queued.state, "queued");
    assert.equal(matched.state, "matched");
    assert.equal((await competition.status(first.account.id)).role, "host");

    const progression = await identity.recordMatch({
      roomId: matched.match.roomId,
      winnerAccountId: first.account.id,
      loserAccountId: second.account.id,
      reason: "forfeit",
    });
    await competition.recordSeasonMatch({ roomId: matched.match.roomId }, progression);
    const leaderboard = await competition.seasonLeaderboard();
    assert.equal(leaderboard[0].accountId, first.account.id);
    assert.equal(leaderboard[0].wins, 1);
    assert.equal(leaderboard[0].rating, 1000 + progression.match.winnerRatingDelta);
    assert.equal(leaderboard[1].rating, 1000 + progression.match.loserRatingDelta);

    const telemetry = await competition.recordTelemetry({
      accountId: first.account.id,
      sessionId: "mobile-session",
      eventName: "mobile.boot",
      payload: { renderer: "gl_compatibility" },
    });
    assert.equal(telemetry.accepted, true);

    const challenge = await competition.createRecovery(first.account.id);
    await assert.rejects(
      competition.consumeRecovery(first.account.id, "WRONG-CODE"),
      (error) => error.code === "RECOVERY_INVALID",
    );
    const attempts = await competition.pool.query(
      "SELECT attempts FROM recovery_challenges WHERE account_id = $1",
      [first.account.id],
    );
    assert.equal(Number(attempts.rows[0].attempts), 1);

    await competition.consumeRecovery(first.account.id, challenge.recoveryCode);
    const recovered = await identity.resetPassword(first.account.id, "password-recovered");
    assert.equal(recovered.account.id, first.account.id);
    assert.equal((await identity.login({ handle: "pg_alpha", password: "password-recovered" })).account.id, first.account.id);
  } finally {
    await competition.pool.query(`
      TRUNCATE recovery_challenges, telemetry_events, matchmaking_matches, matchmaking_queue,
        season_ratings, competitive_seasons, match_history, account_sessions, accounts CASCADE
    `);
    await competition.close();
    await identity.close();
  }
});
