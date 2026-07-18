import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  assertValidSession,
  createAccountRecord,
  hashToken,
  levelForXp,
  normalizeHandle,
  progressionForResult,
  publicProfile,
  sessionRecord,
  verifyPassword,
} from "./identity-common.js";
import { ProtocolError } from "./protocol.js";

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

export class SqliteIdentityStore {
  constructor({ filename = process.env.HEXA_IDENTITY_DB_PATH ?? resolve(process.cwd(), ".data", "hexa-identity.sqlite"), clock = () => Date.now(), idFactory = randomUUID } = {}) {
    this.kind = "sqlite";
    this.filename = filename;
    this.clock = clock;
    this.idFactory = idFactory;
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename, { timeout: 5_000 });
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
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
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS account_sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS match_history (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL UNIQUE,
        winner_account_id TEXT NOT NULL,
        loser_account_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        winner_xp INTEGER NOT NULL,
        loser_xp INTEGER NOT NULL,
        winner_rating_delta INTEGER NOT NULL,
        loser_rating_delta INTEGER NOT NULL,
        finished_at INTEGER NOT NULL,
        FOREIGN KEY (winner_account_id) REFERENCES accounts(id),
        FOREIGN KEY (loser_account_id) REFERENCES accounts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_ranking ON accounts(rating DESC, xp DESC);
      CREATE INDEX IF NOT EXISTS idx_match_winner ON match_history(winner_account_id, finished_at DESC);
      CREATE INDEX IF NOT EXISTS idx_match_loser ON match_history(loser_account_id, finished_at DESC);
    `);
    this.findByHandle = this.database.prepare("SELECT * FROM accounts WHERE handle = ?");
    this.findById = this.database.prepare("SELECT * FROM accounts WHERE id = ?");
    this.findSession = this.database.prepare("SELECT account_id AS accountId, expires_at AS expiresAt FROM account_sessions WHERE token_hash = ?");
  }

  async register(input) {
    const account = createAccountRecord({ ...input, clock: this.clock, idFactory: this.idFactory });
    if (this.findByHandle.get(account.handle)) throw new ProtocolError("ACCOUNT_EXISTS", "an account already uses this handle");
    this.database.prepare(`
      INSERT INTO accounts (
        id, handle, display_name, password_hash, password_salt,
        xp, level, rating, wins, losses, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      account.id, account.handle, account.displayName, account.passwordHash, account.passwordSalt,
      account.xp, account.level, account.rating, account.wins, account.losses, account.createdAt, account.updatedAt,
    );
    return this.#issueSession(account);
  }

  async login({ handle, password }) {
    const account = accountFromRow(this.findByHandle.get(normalizeHandle(handle)));
    if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      throw new ProtocolError("INVALID_LOGIN", "handle or password is invalid");
    }
    return this.#issueSession(account);
  }

  async authenticate(accountId, accessToken) {
    const session = this.findSession.get(hashToken(accessToken));
    assertValidSession(session, accountId, this.clock);
    const account = accountFromRow(this.findById.get(accountId));
    if (!account) throw new ProtocolError("ACCOUNT_NOT_FOUND", "account does not exist");
    return account;
  }

  async getProfile(accountId) {
    const row = this.database.prepare(`
      SELECT a.*, 1 + (
        SELECT COUNT(*) FROM accounts higher
        WHERE higher.rating > a.rating OR (higher.rating = a.rating AND higher.xp > a.xp)
      ) AS rank
      FROM accounts a WHERE a.id = ?
    `).get(accountId);
    if (!row) throw new ProtocolError("ACCOUNT_NOT_FOUND", "account does not exist");
    return publicProfile(accountFromRow(row), Number(row.rank));
  }

  async leaderboard(limit = 50) {
    return this.database.prepare(`
      SELECT * FROM accounts
      ORDER BY rating DESC, xp DESC, created_at ASC
      LIMIT ?
    `).all(limit).map((row, index) => publicProfile(accountFromRow(row), index + 1));
  }

  async history(accountId, limit = 25) {
    return this.database.prepare(`
      SELECT m.*,
        winner.display_name AS winner_name,
        loser.display_name AS loser_name
      FROM match_history m
      JOIN accounts winner ON winner.id = m.winner_account_id
      JOIN accounts loser ON loser.id = m.loser_account_id
      WHERE m.winner_account_id = ? OR m.loser_account_id = ?
      ORDER BY m.finished_at DESC
      LIMIT ?
    `).all(accountId, accountId, limit).map((row) => ({
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

  async recordMatch(result) {
    if (!result?.roomId || !result.winnerAccountId || !result.loserAccountId) return { recorded: false };
    if (this.database.prepare("SELECT 1 FROM match_history WHERE room_id = ?").get(result.roomId)) return { recorded: false };
    const winner = accountFromRow(this.findById.get(result.winnerAccountId));
    const loser = accountFromRow(this.findById.get(result.loserAccountId));
    if (!winner || !loser || winner.id === loser.id) return { recorded: false };
    const progression = progressionForResult({ winnerRating: winner.rating, loserRating: loser.rating });
    const finishedAt = result.finishedAt ?? this.clock();
    const matchId = `match-${this.idFactory()}`;

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const inserted = this.database.prepare(`
        INSERT OR IGNORE INTO match_history (
          id, room_id, winner_account_id, loser_account_id, reason,
          winner_xp, loser_xp, winner_rating_delta, loser_rating_delta, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        matchId, result.roomId, winner.id, loser.id, result.reason ?? "completed",
        progression.winnerXp, progression.loserXp,
        progression.winnerRatingDelta, progression.loserRatingDelta, finishedAt,
      );
      if (inserted.changes === 0) {
        this.database.exec("ROLLBACK");
        return { recorded: false };
      }
      this.#updateAccount(winner, progression.winnerXp, progression.winnerRatingDelta, 1, 0);
      this.#updateAccount(loser, progression.loserXp, progression.loserRatingDelta, 0, 1);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    return {
      recorded: true,
      match: (await this.history(winner.id, 1))[0],
      winner: await this.getProfile(winner.id),
      loser: await this.getProfile(loser.id),
    };
  }

  #updateAccount(account, xpDelta, ratingDelta, winsDelta, lossesDelta) {
    const xp = account.xp + xpDelta;
    const rating = Math.max(0, account.rating + ratingDelta);
    this.database.prepare(`
      UPDATE accounts SET xp = ?, level = ?, rating = ?, wins = wins + ?, losses = losses + ?, updated_at = ?
      WHERE id = ?
    `).run(xp, levelForXp(xp), rating, winsDelta, lossesDelta, this.clock(), account.id);
  }

  #issueSession(account) {
    const session = sessionRecord(account.id, this.clock);
    this.database.prepare(`
      INSERT INTO account_sessions (token_hash, account_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(session.tokenHash, session.accountId, session.createdAt, session.expiresAt);
    return { account: publicProfile(account), accessToken: session.token, expiresAt: session.expiresAt };
  }

  async close() {
    if (this.database.isOpen) this.database.close();
  }
}
