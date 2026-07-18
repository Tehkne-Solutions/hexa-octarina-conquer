import { randomBytes, randomUUID } from "node:crypto";

import pg from "pg";

import { hashToken } from "./identity-common.js";
import { ProtocolError } from "./protocol.js";

const { Pool } = pg;

function recoveryCode() {
  return randomBytes(9).toString("base64url").toUpperCase();
}

function seasonFromRow(row) {
  return row ? {
    id: row.id,
    name: row.name,
    startsAt: Number(row.starts_at),
    endsAt: Number(row.ends_at),
    status: row.status,
  } : null;
}

function matchFromRow(row) {
  return row ? {
    id: row.id,
    roomId: row.room_id,
    seasonId: row.season_id,
    hostAccountId: row.host_account_id,
    guestAccountId: row.guest_account_id,
    region: row.region,
    boardSize: Number(row.board_size),
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    accepted: row.accepted ?? {},
    status: row.status,
  } : null;
}

export class PostgresCompetitionStore {
  constructor({ pool, clock = () => Date.now(), idFactory = randomUUID }) {
    this.kind = "postgres";
    this.pool = pool;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  static async connect({ connectionString = process.env.DATABASE_URL, clock = () => Date.now(), idFactory = randomUUID } = {}) {
    if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL competition storage");
    const pool = new Pool({ connectionString, max: Number(process.env.HEXA_COMPETITION_PG_POOL_SIZE ?? 8) });
    const store = new PostgresCompetitionStore({ pool, clock, idFactory });
    await store.migrate();
    await store.currentSeason();
    return store;
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS competitive_seasons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        starts_at BIGINT NOT NULL,
        ends_at BIGINT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_season
        ON competitive_seasons(status) WHERE status = 'active';
      CREATE TABLE IF NOT EXISTS season_ratings (
        season_id TEXT NOT NULL REFERENCES competitive_seasons(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        handle TEXT NOT NULL,
        display_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        placement_games INTEGER NOT NULL DEFAULT 0,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (season_id, account_id)
      );
      CREATE INDEX IF NOT EXISTS idx_season_ranking
        ON season_ratings(season_id, rating DESC, wins DESC);
      CREATE TABLE IF NOT EXISTS matchmaking_queue (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        season_id TEXT NOT NULL REFERENCES competitive_seasons(id) ON DELETE CASCADE,
        handle TEXT NOT NULL,
        display_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        region TEXT NOT NULL,
        board_size INTEGER NOT NULL,
        enqueued_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_matchmaking_search
        ON matchmaking_queue(season_id, region, board_size, enqueued_at);
      CREATE TABLE IF NOT EXISTS matchmaking_matches (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL UNIQUE,
        season_id TEXT NOT NULL REFERENCES competitive_seasons(id),
        host_account_id TEXT NOT NULL REFERENCES accounts(id),
        guest_account_id TEXT NOT NULL REFERENCES accounts(id),
        region TEXT NOT NULL,
        board_size INTEGER NOT NULL,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        accepted JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'matched'
      );
      CREATE INDEX IF NOT EXISTS idx_matchmaking_host ON matchmaking_matches(host_account_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_matchmaking_guest ON matchmaking_matches(guest_account_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id TEXT PRIMARY KEY,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        session_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_event_time ON telemetry_events(event_name, created_at DESC);
      CREATE TABLE IF NOT EXISTS recovery_challenges (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL
      );
    `);
  }

  async currentSeason() {
    const now = this.clock();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(90202609)");
      let result = await client.query(`
        SELECT * FROM competitive_seasons
        WHERE status = 'active' AND starts_at <= $1 AND ends_at > $1
        ORDER BY starts_at DESC LIMIT 1
      `, [now]);
      if (result.rowCount === 0) {
        await client.query("UPDATE competitive_seasons SET status = 'closed' WHERE status = 'active'");
        const date = new Date(now);
        const id = `season-${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
        result = await client.query(`
          INSERT INTO competitive_seasons (id, name, starts_at, ends_at, status)
          VALUES ($1, $2, $3, $4, 'active')
          ON CONFLICT (id) DO UPDATE SET status = 'active'
          RETURNING *
        `, [id, "Temporada Fundadores", now, now + 90 * 24 * 60 * 60 * 1000]);
      }
      await client.query("COMMIT");
      return seasonFromRow(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listSeasons() {
    const result = await this.pool.query("SELECT * FROM competitive_seasons ORDER BY starts_at DESC");
    return result.rows.map(seasonFromRow);
  }

  async ensureRating(client, seasonId, account) {
    await client.query(`
      INSERT INTO season_ratings (
        season_id, account_id, handle, display_name, rating, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (season_id, account_id) DO UPDATE SET
        handle = excluded.handle,
        display_name = excluded.display_name
    `, [seasonId, account.id, account.handle, account.displayName, account.rating ?? 1000, this.clock()]);
  }

  async seasonLeaderboard(limit = 50, seasonId = undefined) {
    const resolvedSeason = seasonId ?? (await this.currentSeason()).id;
    const result = await this.pool.query(`
      SELECT *, ROW_NUMBER() OVER (ORDER BY rating DESC, wins DESC, updated_at ASC)::integer AS rank
      FROM season_ratings WHERE season_id = $1
      ORDER BY rating DESC, wins DESC, updated_at ASC LIMIT $2
    `, [resolvedSeason, limit]);
    return result.rows.map((row) => ({
      seasonId: row.season_id,
      accountId: row.account_id,
      handle: row.handle,
      displayName: row.display_name,
      rating: Number(row.rating),
      wins: Number(row.wins),
      losses: Number(row.losses),
      placementGames: Number(row.placement_games),
      updatedAt: Number(row.updated_at),
      rank: Number(row.rank),
    }));
  }

  matchWindow(left, right, now = this.clock()) {
    const waited = Math.max(now - Number(left.enqueued_at ?? left.enqueuedAt), now - Number(right.enqueued_at ?? right.enqueuedAt), 0);
    return Math.min(500, 100 + Math.floor(waited / 15_000) * 50);
  }

  async enqueue({ account, region = "global", boardSize = 5 }) {
    const season = await this.currentSeason();
    const previous = await this.status(account.id);
    if (previous.state === "matched") return previous;
    const now = this.clock();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.ensureRating(client, season.id, account);
      await client.query(`
        INSERT INTO matchmaking_queue (
          account_id, season_id, handle, display_name, rating, region, board_size, enqueued_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (account_id) DO UPDATE SET
          season_id = excluded.season_id,
          handle = excluded.handle,
          display_name = excluded.display_name,
          rating = excluded.rating,
          region = excluded.region,
          board_size = excluded.board_size,
          enqueued_at = excluded.enqueued_at
      `, [account.id, season.id, account.handle, account.displayName, account.rating ?? 1000, region, boardSize, now]);

      const candidates = await client.query(`
        SELECT * FROM matchmaking_queue
        WHERE account_id <> $1 AND season_id = $2 AND region = $3 AND board_size = $4
          AND ABS(rating - $5) <= 500
        ORDER BY enqueued_at ASC
        LIMIT 20 FOR UPDATE SKIP LOCKED
      `, [account.id, season.id, region, boardSize, account.rating ?? 1000]);
      const current = { enqueuedAt: now, rating: account.rating ?? 1000 };
      const candidate = candidates.rows.find((item) =>
        Math.abs(Number(item.rating) - current.rating) <= this.matchWindow(item, current, now));

      if (!candidate) {
        await client.query("COMMIT");
        return {
          state: "queued",
          ticket: { accountId: account.id, seasonId: season.id, region, boardSize, rating: current.rating, enqueuedAt: now },
          searchWindow: this.matchWindow(current, current, now),
        };
      }

      const match = {
        id: `queue-match-${this.idFactory()}`,
        roomId: this.idFactory().replaceAll("-", "").slice(0, 8).toUpperCase(),
        seasonId: season.id,
        hostAccountId: candidate.account_id,
        guestAccountId: account.id,
        region,
        boardSize,
        createdAt: now,
        expiresAt: now + 2 * 60 * 1000,
        accepted: {},
        status: "matched",
      };
      await client.query("DELETE FROM matchmaking_queue WHERE account_id = ANY($1::text[])", [[candidate.account_id, account.id]]);
      await client.query(`
        INSERT INTO matchmaking_matches (
          id, room_id, season_id, host_account_id, guest_account_id,
          region, board_size, created_at, expires_at, accepted, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '{}'::jsonb, 'matched')
      `, [match.id, match.roomId, match.seasonId, match.hostAccountId, match.guestAccountId, region, boardSize, now, match.expiresAt]);
      await client.query("COMMIT");
      return { state: "matched", match, role: "guest" };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async status(accountId) {
    const matchResult = await this.pool.query(`
      SELECT * FROM matchmaking_matches
      WHERE status = 'matched' AND expires_at > $2
        AND (host_account_id = $1 OR guest_account_id = $1)
      ORDER BY created_at DESC LIMIT 1
    `, [accountId, this.clock()]);
    if (matchResult.rows[0]) {
      const match = matchFromRow(matchResult.rows[0]);
      return { state: "matched", match, role: match.hostAccountId === accountId ? "host" : "guest" };
    }
    const queueResult = await this.pool.query("SELECT * FROM matchmaking_queue WHERE account_id = $1", [accountId]);
    const row = queueResult.rows[0];
    if (!row) return { state: "idle" };
    return {
      state: "queued",
      ticket: {
        accountId: row.account_id,
        seasonId: row.season_id,
        handle: row.handle,
        displayName: row.display_name,
        rating: Number(row.rating),
        region: row.region,
        boardSize: Number(row.board_size),
        enqueuedAt: Number(row.enqueued_at),
      },
      searchWindow: this.matchWindow(row, row),
    };
  }

  async accept(accountId, matchId) {
    const result = await this.pool.query(`
      UPDATE matchmaking_matches
      SET accepted = accepted || jsonb_build_object($2::text, $3::bigint)
      WHERE id = $1 AND status = 'matched' AND expires_at > $3
        AND (host_account_id = $2 OR guest_account_id = $2)
      RETURNING *
    `, [matchId, accountId, this.clock()]);
    if (!result.rows[0]) throw new ProtocolError("MATCH_NOT_FOUND", "matchmaking assignment is unavailable or expired");
    const match = matchFromRow(result.rows[0]);
    return { match, role: match.hostAccountId === accountId ? "host" : "guest" };
  }

  async cancel(accountId) {
    const result = await this.pool.query("DELETE FROM matchmaking_queue WHERE account_id = $1", [accountId]);
    return { cancelled: result.rowCount > 0 };
  }

  async recordSeasonMatch(result, progression) {
    if (!progression?.recorded) return { recorded: false };
    const season = await this.currentSeason();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.ensureRating(client, season.id, progression.winner);
      await this.ensureRating(client, season.id, progression.loser);
      await client.query(`
        UPDATE season_ratings SET
          rating = GREATEST(0, rating + $3), wins = wins + 1,
          placement_games = placement_games + 1, updated_at = $4
        WHERE season_id = $1 AND account_id = $2
      `, [season.id, progression.winner.id, progression.match.winnerRatingDelta, this.clock()]);
      await client.query(`
        UPDATE season_ratings SET
          rating = GREATEST(0, rating + $3), losses = losses + 1,
          placement_games = placement_games + 1, updated_at = $4
        WHERE season_id = $1 AND account_id = $2
      `, [season.id, progression.loser.id, progression.match.loserRatingDelta, this.clock()]);
      await client.query("UPDATE matchmaking_matches SET status = 'completed' WHERE room_id = $1", [result.roomId]);
      await client.query("COMMIT");
      return { recorded: true, seasonId: season.id };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordTelemetry({ accountId = null, sessionId, eventName, payload = {} }) {
    const id = `telemetry-${this.idFactory()}`;
    await this.pool.query(`
      INSERT INTO telemetry_events (id, account_id, session_id, event_name, payload, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    `, [id, accountId, sessionId, eventName, JSON.stringify(payload), this.clock()]);
    return { accepted: true, eventId: id };
  }

  async createRecovery(accountId) {
    const code = recoveryCode();
    const now = this.clock();
    const expiresAt = now + 15 * 60 * 1000;
    await this.pool.query(`
      INSERT INTO recovery_challenges (account_id, code_hash, expires_at, attempts, created_at)
      VALUES ($1, $2, $3, 0, $4)
      ON CONFLICT (account_id) DO UPDATE SET
        code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        created_at = excluded.created_at
    `, [accountId, hashToken(code), expiresAt, now]);
    return { accepted: true, recoveryCode: code, expiresAt };
  }

  async consumeRecovery(accountId, code) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT * FROM recovery_challenges WHERE account_id = $1 FOR UPDATE", [accountId]);
      const challenge = result.rows[0];
      if (!challenge || Number(challenge.expires_at) <= this.clock() || Number(challenge.attempts) >= 5) {
        throw new ProtocolError("RECOVERY_INVALID", "recovery code is invalid or expired");
      }
      await client.query("UPDATE recovery_challenges SET attempts = attempts + 1 WHERE account_id = $1", [accountId]);
      if (hashToken(code.toUpperCase()) !== challenge.code_hash) {
        throw new ProtocolError("RECOVERY_INVALID", "recovery code is invalid or expired");
      }
      await client.query("DELETE FROM recovery_challenges WHERE account_id = $1", [accountId]);
      await client.query("COMMIT");
      return { verified: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}
