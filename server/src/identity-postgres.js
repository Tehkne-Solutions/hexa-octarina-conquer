import { randomUUID } from "node:crypto";

import pg from "pg";

import {
  assertValidSession,
  createAccountRecord,
  createPasswordRecord,
  hashToken,
  levelForXp,
  normalizeHandle,
  progressionForResult,
  publicProfile,
  sessionRecord,
  verifyPassword,
} from "./identity-common.js";
import { ProtocolError } from "./protocol.js";

const { Pool } = pg;

function accountFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    xp: Number(row.xp),
    level: Number(row.level),
    rating: Number(row.rating),
    wins: Number(row.wins),
    losses: Number(row.losses),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export class PostgresIdentityStore {
  constructor({ pool, clock = () => Date.now(), idFactory = randomUUID }) {
    this.kind = "postgres";
    this.pool = pool;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  static async connect({ connectionString = process.env.DATABASE_URL, clock = () => Date.now(), idFactory = randomUUID } = {}) {
    if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL identity storage");
    const pool = new Pool({ connectionString, max: Number(process.env.HEXA_PG_POOL_SIZE ?? 10) });
    const store = new PostgresIdentityStore({ pool, clock, idFactory });
    await store.migrate();
    return store;
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        handle TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        rating INTEGER NOT NULL DEFAULT 1000,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS account_sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS match_history (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL UNIQUE,
        winner_account_id TEXT NOT NULL REFERENCES accounts(id),
        loser_account_id TEXT NOT NULL REFERENCES accounts(id),
        reason TEXT NOT NULL,
        winner_xp INTEGER NOT NULL,
        loser_xp INTEGER NOT NULL,
        winner_rating_delta INTEGER NOT NULL,
        loser_rating_delta INTEGER NOT NULL,
        finished_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_ranking ON accounts(rating DESC, xp DESC);
      CREATE INDEX IF NOT EXISTS idx_match_winner ON match_history(winner_account_id, finished_at DESC);
      CREATE INDEX IF NOT EXISTS idx_match_loser ON match_history(loser_account_id, finished_at DESC);
    `);
  }

  async register(input) {
    const account = createAccountRecord({ ...input, clock: this.clock, idFactory: this.idFactory });
    try {
      await this.pool.query(`
        INSERT INTO accounts (
          id, handle, display_name, password_hash, password_salt,
          xp, level, rating, wins, losses, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        account.id, account.handle, account.displayName, account.passwordHash, account.passwordSalt,
        account.xp, account.level, account.rating, account.wins, account.losses, account.createdAt, account.updatedAt,
      ]);
    } catch (error) {
      if (error?.code === "23505") throw new ProtocolError("ACCOUNT_EXISTS", "an account already uses this handle");
      throw error;
    }
    return this.#issueSession(account);
  }

  async login({ handle, password }) {
    const result = await this.pool.query("SELECT * FROM accounts WHERE handle = $1", [normalizeHandle(handle)]);
    const account = accountFromRow(result.rows[0]);
    if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      throw new ProtocolError("INVALID_LOGIN", "handle or password is invalid");
    }
    return this.#issueSession(account);
  }

  async authenticate(accountId, accessToken) {
    const result = await this.pool.query(`
      SELECT account_id AS "accountId", expires_at AS "expiresAt"
      FROM account_sessions WHERE token_hash = $1
    `, [hashToken(accessToken)]);
    assertValidSession(result.rows[0], accountId, this.clock);
    const accountResult = await this.pool.query("SELECT * FROM accounts WHERE id = $1", [accountId]);
    const account = accountFromRow(accountResult.rows[0]);
    if (!account) throw new ProtocolError("ACCOUNT_NOT_FOUND", "account does not exist");
    return account;
  }

  async findAccountIdByHandle(handle) {
    const result = await this.pool.query("SELECT id FROM accounts WHERE handle = $1", [normalizeHandle(handle)]);
    return result.rows[0]?.id ?? null;
  }

  async resetPassword(accountId, newPassword) {
    const password = createPasswordRecord(newPassword);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(`
        UPDATE accounts SET password_hash = $2, password_salt = $3, updated_at = $4
        WHERE id = $1 RETURNING *
      `, [accountId, password.hash, password.salt, this.clock()]);
      if (!updated.rows[0]) throw new ProtocolError("ACCOUNT_NOT_FOUND", "account does not exist");
      await client.query("DELETE FROM account_sessions WHERE account_id = $1", [accountId]);
      await client.query("COMMIT");
      return this.#issueSession(accountFromRow(updated.rows[0]));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getProfile(accountId) {
    const result = await this.pool.query(`
      SELECT a.*, 1 + (
        SELECT COUNT(*) FROM accounts higher
        WHERE higher.rating > a.rating OR (higher.rating = a.rating AND higher.xp > a.xp)
      ) AS rank
      FROM accounts a WHERE a.id = $1
    `, [accountId]);
    if (!result.rows[0]) throw new ProtocolError("ACCOUNT_NOT_FOUND", "account does not exist");
    return publicProfile(accountFromRow(result.rows[0]), Number(result.rows[0].rank));
  }

  async leaderboard(limit = 50) {
    const result = await this.pool.query(`
      SELECT * FROM accounts
      ORDER BY rating DESC, xp DESC, created_at ASC
      LIMIT $1
    `, [limit]);
    return result.rows.map((row, index) => publicProfile(accountFromRow(row), index + 1));
  }

  async history(accountId, limit = 25) {
    const result = await this.pool.query(`
      SELECT m.*, winner.display_name AS winner_name, loser.display_name AS loser_name
      FROM match_history m
      JOIN accounts winner ON winner.id = m.winner_account_id
      JOIN accounts loser ON loser.id = m.loser_account_id
      WHERE m.winner_account_id = $1 OR m.loser_account_id = $1
      ORDER BY m.finished_at DESC LIMIT $2
    `, [accountId, limit]);
    return result.rows.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      winnerAccountId: row.winner_account_id,
      winnerName: row.winner_name,
      loserAccountId: row.loser_account_id,
      loserName: row.loser_name,
      reason: row.reason,
      winnerXp: Number(row.winner_xp),
      loserXp: Number(row.loser_xp),
      winnerRatingDelta: Number(row.winner_rating_delta),
      loserRatingDelta: Number(row.loser_rating_delta),
      finishedAt: Number(row.finished_at),
    }));
  }

  async awardCampaignXp({ roomId, accountId, xp }) {
    if (!roomId || !accountId || !Number.isFinite(xp) || xp <= 0) return { recorded: false };
    const amount = Math.max(0, Math.floor(xp));
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`campaign-reward:${roomId}`]);
      const inserted = await client.query(`
        INSERT INTO campaign_rewards (room_id, account_id, xp, awarded_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (room_id) DO NOTHING
        RETURNING room_id
      `, [roomId, accountId, amount, this.clock()]);
      if (inserted.rowCount === 0) {
        await client.query("ROLLBACK");
        return { recorded: false, xpAwarded: 0, profile: await this.getProfile(accountId) };
      }
      const accountResult = await client.query("SELECT * FROM accounts WHERE id = $1 FOR UPDATE", [accountId]);
      const account = accountFromRow(accountResult.rows[0]);
      if (!account) throw new ProtocolError("ACCOUNT_NOT_FOUND", "account does not exist");
      const nextXp = account.xp + amount;
      await client.query(`
        UPDATE accounts SET xp = $2, level = $3, updated_at = $4 WHERE id = $1
      `, [accountId, nextXp, levelForXp(nextXp), this.clock()]);
      await client.query("COMMIT");
      return { recorded: true, xpAwarded: amount, profile: await this.getProfile(accountId) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordMatch(result) {
    if (!result?.roomId || !result.winnerAccountId || !result.loserAccountId) return { recorded: false };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT id FROM match_history WHERE room_id = $1 FOR UPDATE", [result.roomId]);
      if (existing.rowCount > 0) {
        await client.query("ROLLBACK");
        return { recorded: false };
      }
      const accounts = await client.query("SELECT * FROM accounts WHERE id = ANY($1::text[]) FOR UPDATE", [[result.winnerAccountId, result.loserAccountId]]);
      const winner = accountFromRow(accounts.rows.find((row) => row.id === result.winnerAccountId));
      const loser = accountFromRow(accounts.rows.find((row) => row.id === result.loserAccountId));
      if (!winner || !loser || winner.id === loser.id) {
        await client.query("ROLLBACK");
        return { recorded: false };
      }
      const progression = progressionForResult({ winnerRating: winner.rating, loserRating: loser.rating });
      const finishedAt = result.finishedAt ?? this.clock();
      const matchId = `match-${this.idFactory()}`;
      await client.query(`
        INSERT INTO match_history (
          id, room_id, winner_account_id, loser_account_id, reason,
          winner_xp, loser_xp, winner_rating_delta, loser_rating_delta, finished_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        matchId, result.roomId, winner.id, loser.id, result.reason ?? "completed",
        progression.winnerXp, progression.loserXp,
        progression.winnerRatingDelta, progression.loserRatingDelta, finishedAt,
      ]);
      await this.#updateAccount(client, winner, progression.winnerXp, progression.winnerRatingDelta, 1, 0);
      await this.#updateAccount(client, loser, progression.loserXp, progression.loserRatingDelta, 0, 1);
      await client.query("COMMIT");
      return {
        recorded: true,
        match: (await this.history(winner.id, 1))[0],
        winner: await this.getProfile(winner.id),
        loser: await this.getProfile(loser.id),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async #updateAccount(client, account, xpDelta, ratingDelta, winsDelta, lossesDelta) {
    const xp = account.xp + xpDelta;
    const rating = Math.max(0, account.rating + ratingDelta);
    await client.query(`
      UPDATE accounts SET xp = $1, level = $2, rating = $3,
        wins = wins + $4, losses = losses + $5, updated_at = $6
      WHERE id = $7
    `, [xp, levelForXp(xp), rating, winsDelta, lossesDelta, this.clock(), account.id]);
  }

  async #issueSession(account) {
    const session = sessionRecord(account.id, this.clock);
    await this.pool.query(`
      INSERT INTO account_sessions (token_hash, account_id, created_at, expires_at)
      VALUES ($1, $2, $3, $4)
    `, [session.tokenHash, session.accountId, session.createdAt, session.expiresAt]);
    return { account: publicProfile(account), accessToken: session.token, expiresAt: session.expiresAt };
  }

  async close() {
    await this.pool.end();
  }
}
