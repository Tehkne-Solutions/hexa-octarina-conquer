import { randomUUID } from "node:crypto";

import pg from "pg";

import { ProtocolError } from "./protocol.js";

const { Pool } = pg;
const DEFAULT_DODGE_COOLDOWN_MS = 2 * 60 * 1000;

function validateSeasonInput({ id, name, startsAt, endsAt }) {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{2,48}$/.test(id)) {
    throw new ProtocolError("INVALID_SEASON", "season id must contain 3 to 49 lowercase letters, numbers or hyphens");
  }
  if (typeof name !== "string" || name.trim().length < 3 || name.trim().length > 80) {
    throw new ProtocolError("INVALID_SEASON", "season name must contain 3 to 80 characters");
  }
  if (!Number.isInteger(startsAt) || !Number.isInteger(endsAt) || endsAt <= startsAt) {
    throw new ProtocolError("INVALID_SEASON", "season dates are invalid");
  }
  return { id, name: name.trim(), startsAt, endsAt };
}

function penaltyPayload(penalty) {
  return {
    id: penalty.id,
    accountId: penalty.accountId,
    kind: penalty.kind,
    points: Number(penalty.points ?? 1),
    reason: penalty.reason,
    sourceId: penalty.sourceId ?? null,
    startsAt: Number(penalty.startsAt),
    expiresAt: Number(penalty.expiresAt),
  };
}

export class MemoryGovernanceStore {
  constructor({ competition, clock = () => Date.now(), idFactory = randomUUID } = {}) {
    this.kind = "memory";
    this.competition = competition;
    this.clock = clock;
    this.idFactory = idFactory;
    this.penalties = new Map();
  }

  async assertEligible(accountId) {
    const penalty = (await this.listPenalties(accountId)).find((item) => item.expiresAt > this.clock());
    if (penalty) {
      throw new ProtocolError("MATCHMAKING_COOLDOWN", "competitive matchmaking is temporarily unavailable", {
        retryAt: penalty.expiresAt,
        kind: penalty.kind,
        points: penalty.points,
      });
    }
  }

  async penalize({ accountId, kind = "queue_dodge", points = 1, durationMs = DEFAULT_DODGE_COOLDOWN_MS, reason = "competitive absence", sourceId = null }) {
    const now = this.clock();
    const existing = [...this.penalties.values()].find((item) => item.accountId === accountId && item.kind === kind && item.sourceId === sourceId && sourceId);
    if (existing) return penaltyPayload(existing);
    const penalty = {
      id: `penalty-${this.idFactory()}`,
      accountId,
      kind,
      points,
      reason,
      sourceId,
      startsAt: now,
      expiresAt: now + Math.max(1_000, durationMs),
    };
    this.penalties.set(penalty.id, penalty);
    return penaltyPayload(penalty);
  }

  async listPenalties(accountId = undefined) {
    return [...this.penalties.values()]
      .filter((item) => !accountId || item.accountId === accountId)
      .sort((left, right) => right.startsAt - left.startsAt)
      .map(penaltyPayload);
  }

  async clearPenalties(accountId) {
    let removed = 0;
    for (const [id, item] of this.penalties) {
      if (item.accountId === accountId) {
        this.penalties.delete(id);
        removed += 1;
      }
    }
    return { removed };
  }

  async expireAssignments() {
    if (!this.competition?.matches) return [];
    const expired = [];
    for (const match of this.competition.matches.values()) {
      if (match.status !== "matched" || match.expiresAt > this.clock()) continue;
      match.status = "expired";
      for (const accountId of [match.hostAccountId, match.guestAccountId]) {
        if (match.accepted?.[accountId]) continue;
        const penalty = await this.penalize({
          accountId,
          kind: "match_accept_timeout",
          points: 1,
          durationMs: DEFAULT_DODGE_COOLDOWN_MS,
          reason: "match assignment expired without acceptance",
          sourceId: match.id,
        });
        expired.push({ matchId: match.id, accountId, penalty });
      }
    }
    return expired;
  }

  async declineAssignment(accountId, matchId) {
    const match = this.competition?.matches?.get(matchId);
    if (!match || match.status !== "matched" || ![match.hostAccountId, match.guestAccountId].includes(accountId)) {
      throw new ProtocolError("MATCH_NOT_FOUND", "matchmaking assignment is unavailable");
    }
    match.status = "declined";
    return this.penalize({
      accountId,
      kind: "match_declined",
      points: 1,
      durationMs: DEFAULT_DODGE_COOLDOWN_MS,
      reason: "competitive assignment declined",
      sourceId: match.id,
    });
  }

  async createSeason(input) {
    const season = { ...validateSeasonInput(input), status: "planned" };
    if (!this.competition?.seasons) throw new ProtocolError("ADMIN_UNAVAILABLE", "season administration is unavailable");
    if (this.competition.seasons.has(season.id)) throw new ProtocolError("SEASON_EXISTS", "season already exists");
    this.competition.seasons.set(season.id, season);
    return { ...season };
  }

  async activateSeason(seasonId) {
    const season = this.competition?.seasons?.get(seasonId);
    if (!season) throw new ProtocolError("SEASON_NOT_FOUND", "season does not exist");
    for (const item of this.competition.seasons.values()) {
      if (item.status === "active") item.status = "closed";
    }
    season.status = "active";
    return { ...season };
  }

  async closeSeason(seasonId) {
    const season = this.competition?.seasons?.get(seasonId);
    if (!season) throw new ProtocolError("SEASON_NOT_FOUND", "season does not exist");
    season.status = "closed";
    return { ...season };
  }

  async close() {}
}

export class PostgresGovernanceStore {
  constructor({ pool, clock = () => Date.now(), idFactory = randomUUID }) {
    this.kind = "postgres";
    this.pool = pool;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  static async connect({ connectionString = process.env.DATABASE_URL, clock = () => Date.now(), idFactory = randomUUID } = {}) {
    if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL governance storage");
    const pool = new Pool({ connectionString, max: Number(process.env.HEXA_GOVERNANCE_PG_POOL_SIZE ?? 4) });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS competitive_penalties (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 1,
        reason TEXT NOT NULL,
        source_id TEXT,
        starts_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_competitive_penalties_account_expiry
        ON competitive_penalties(account_id, expires_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_competitive_penalties_source
        ON competitive_penalties(account_id, kind, source_id) WHERE source_id IS NOT NULL;
    `);
    return new PostgresGovernanceStore({ pool, clock, idFactory });
  }

  async assertEligible(accountId) {
    const result = await this.pool.query(`
      SELECT * FROM competitive_penalties
      WHERE account_id = $1 AND expires_at > $2
      ORDER BY expires_at DESC LIMIT 1
    `, [accountId, this.clock()]);
    const row = result.rows[0];
    if (row) {
      throw new ProtocolError("MATCHMAKING_COOLDOWN", "competitive matchmaking is temporarily unavailable", {
        retryAt: Number(row.expires_at),
        kind: row.kind,
        points: Number(row.points),
      });
    }
  }

  async penalize({ accountId, kind = "queue_dodge", points = 1, durationMs = DEFAULT_DODGE_COOLDOWN_MS, reason = "competitive absence", sourceId = null }) {
    const now = this.clock();
    const penalty = {
      id: `penalty-${this.idFactory()}`,
      accountId,
      kind,
      points,
      reason,
      sourceId,
      startsAt: now,
      expiresAt: now + Math.max(1_000, durationMs),
    };
    const result = await this.pool.query(`
      INSERT INTO competitive_penalties (
        id, account_id, kind, points, reason, source_id, starts_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (account_id, kind, source_id) WHERE source_id IS NOT NULL
      DO UPDATE SET expires_at = GREATEST(competitive_penalties.expires_at, excluded.expires_at)
      RETURNING *
    `, [penalty.id, penalty.accountId, penalty.kind, penalty.points, penalty.reason, penalty.sourceId, penalty.startsAt, penalty.expiresAt]);
    const row = result.rows[0];
    return penaltyPayload({
      id: row.id,
      accountId: row.account_id,
      kind: row.kind,
      points: row.points,
      reason: row.reason,
      sourceId: row.source_id,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
    });
  }

  async listPenalties(accountId = undefined) {
    const result = accountId
      ? await this.pool.query("SELECT * FROM competitive_penalties WHERE account_id = $1 ORDER BY starts_at DESC", [accountId])
      : await this.pool.query("SELECT * FROM competitive_penalties ORDER BY starts_at DESC LIMIT 500");
    return result.rows.map((row) => penaltyPayload({
      id: row.id,
      accountId: row.account_id,
      kind: row.kind,
      points: row.points,
      reason: row.reason,
      sourceId: row.source_id,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
    }));
  }

  async clearPenalties(accountId) {
    const result = await this.pool.query("DELETE FROM competitive_penalties WHERE account_id = $1", [accountId]);
    return { removed: result.rowCount };
  }

  async expireAssignments() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(`
        SELECT * FROM matchmaking_matches
        WHERE status = 'matched' AND expires_at <= $1
        FOR UPDATE SKIP LOCKED
      `, [this.clock()]);
      const expired = [];
      for (const row of result.rows) {
        const accepted = row.accepted ?? {};
        for (const accountId of [row.host_account_id, row.guest_account_id]) {
          if (accepted[accountId]) continue;
          const now = this.clock();
          const penaltyId = `penalty-${this.idFactory()}`;
          const expiresAt = now + DEFAULT_DODGE_COOLDOWN_MS;
          const inserted = await client.query(`
            INSERT INTO competitive_penalties (
              id, account_id, kind, points, reason, source_id, starts_at, expires_at
            ) VALUES ($1, $2, 'match_accept_timeout', 1, $3, $4, $5, $6)
            ON CONFLICT (account_id, kind, source_id) WHERE source_id IS NOT NULL
            DO UPDATE SET expires_at = GREATEST(competitive_penalties.expires_at, excluded.expires_at)
            RETURNING *
          `, [penaltyId, accountId, "match assignment expired without acceptance", row.id, now, expiresAt]);
          expired.push({ matchId: row.id, accountId, penaltyId: inserted.rows[0].id, retryAt: Number(inserted.rows[0].expires_at) });
        }
        await client.query("UPDATE matchmaking_matches SET status = 'expired' WHERE id = $1", [row.id]);
      }
      await client.query("COMMIT");
      return expired;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async declineAssignment(accountId, matchId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const match = await client.query(`
        UPDATE matchmaking_matches SET status = 'declined'
        WHERE id = $1 AND status = 'matched' AND (host_account_id = $2 OR guest_account_id = $2)
        RETURNING id
      `, [matchId, accountId]);
      if (!match.rows[0]) throw new ProtocolError("MATCH_NOT_FOUND", "matchmaking assignment is unavailable");
      await client.query("COMMIT");
      return this.penalize({
        accountId,
        kind: "match_declined",
        points: 1,
        durationMs: DEFAULT_DODGE_COOLDOWN_MS,
        reason: "competitive assignment declined",
        sourceId: matchId,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createSeason(input) {
    const season = validateSeasonInput(input);
    try {
      const result = await this.pool.query(`
        INSERT INTO competitive_seasons (id, name, starts_at, ends_at, status)
        VALUES ($1, $2, $3, $4, 'planned') RETURNING *
      `, [season.id, season.name, season.startsAt, season.endsAt]);
      const row = result.rows[0];
      return { id: row.id, name: row.name, startsAt: Number(row.starts_at), endsAt: Number(row.ends_at), status: row.status };
    } catch (error) {
      if (error?.code === "23505") throw new ProtocolError("SEASON_EXISTS", "season already exists");
      throw error;
    }
  }

  async activateSeason(seasonId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(90202610)");
      const exists = await client.query("SELECT * FROM competitive_seasons WHERE id = $1 FOR UPDATE", [seasonId]);
      if (!exists.rows[0]) throw new ProtocolError("SEASON_NOT_FOUND", "season does not exist");
      await client.query("UPDATE competitive_seasons SET status = 'closed' WHERE status = 'active'");
      const result = await client.query("UPDATE competitive_seasons SET status = 'active' WHERE id = $1 RETURNING *", [seasonId]);
      await client.query("COMMIT");
      const row = result.rows[0];
      return { id: row.id, name: row.name, startsAt: Number(row.starts_at), endsAt: Number(row.ends_at), status: row.status };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async closeSeason(seasonId) {
    const result = await this.pool.query("UPDATE competitive_seasons SET status = 'closed' WHERE id = $1 RETURNING *", [seasonId]);
    if (!result.rows[0]) throw new ProtocolError("SEASON_NOT_FOUND", "season does not exist");
    const row = result.rows[0];
    return { id: row.id, name: row.name, startsAt: Number(row.starts_at), endsAt: Number(row.ends_at), status: row.status };
  }

  async close() {
    await this.pool.end();
  }
}

export async function createGovernanceStore({
  mode = process.env.HEXA_GOVERNANCE_STORE ?? (process.env.DATABASE_URL ? "postgres" : "memory"),
  competition,
} = {}) {
  if (mode === "memory") return new MemoryGovernanceStore({ competition });
  if (mode === "postgres") return PostgresGovernanceStore.connect();
  throw new Error(`Unsupported HEXA_GOVERNANCE_STORE mode: ${mode}`);
}
