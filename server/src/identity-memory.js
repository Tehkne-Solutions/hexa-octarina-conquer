import { randomUUID } from "node:crypto";

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

export class MemoryIdentityStore {
  constructor({ clock = () => Date.now(), idFactory = randomUUID } = {}) {
    this.kind = "memory";
    this.clock = clock;
    this.idFactory = idFactory;
    this.accounts = new Map();
    this.accountIdByHandle = new Map();
    this.sessions = new Map();
    this.matches = new Map();
  }

  async register(input) {
    const account = createAccountRecord({ ...input, clock: this.clock, idFactory: this.idFactory });
    if (this.accountIdByHandle.has(account.handle)) {
      throw new ProtocolError("ACCOUNT_EXISTS", "an account already uses this handle");
    }
    this.accounts.set(account.id, account);
    this.accountIdByHandle.set(account.handle, account.id);
    return this.#issueSession(account);
  }

  async login({ handle, password }) {
    const account = this.accounts.get(this.accountIdByHandle.get(normalizeHandle(handle)));
    if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      throw new ProtocolError("INVALID_LOGIN", "handle or password is invalid");
    }
    return this.#issueSession(account);
  }

  async authenticate(accountId, accessToken) {
    const session = this.sessions.get(hashToken(accessToken));
    assertValidSession(session, accountId, this.clock);
    const account = this.accounts.get(accountId);
    if (!account) throw new ProtocolError("ACCOUNT_NOT_FOUND", "account does not exist");
    return account;
  }

  async getProfile(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) throw new ProtocolError("ACCOUNT_NOT_FOUND", "account does not exist");
    const leaderboard = await this.leaderboard(10_000);
    const rank = leaderboard.findIndex((item) => item.id === accountId) + 1;
    return publicProfile(account, rank || undefined);
  }

  async leaderboard(limit = 50) {
    return [...this.accounts.values()]
      .sort((left, right) => right.rating - left.rating || right.xp - left.xp || left.createdAt - right.createdAt)
      .slice(0, limit)
      .map((account, index) => publicProfile(account, index + 1));
  }

  async history(accountId, limit = 25) {
    return [...this.matches.values()]
      .filter((match) => match.winnerAccountId === accountId || match.loserAccountId === accountId)
      .sort((left, right) => right.finishedAt - left.finishedAt)
      .slice(0, limit)
      .map((match) => ({ ...match }));
  }

  async recordMatch(result) {
    if (!result?.roomId || this.matches.has(result.roomId)) return { recorded: false };
    const winner = this.accounts.get(result.winnerAccountId);
    const loser = this.accounts.get(result.loserAccountId);
    if (!winner || !loser || winner.id === loser.id) return { recorded: false };

    const progression = progressionForResult({ winnerRating: winner.rating, loserRating: loser.rating });
    winner.xp += progression.winnerXp;
    winner.rating += progression.winnerRatingDelta;
    winner.wins += 1;
    winner.level = levelForXp(winner.xp);
    winner.updatedAt = this.clock();

    loser.xp += progression.loserXp;
    loser.rating = Math.max(0, loser.rating + progression.loserRatingDelta);
    loser.losses += 1;
    loser.level = levelForXp(loser.xp);
    loser.updatedAt = this.clock();

    const match = {
      id: `match-${this.idFactory()}`,
      roomId: result.roomId,
      winnerAccountId: winner.id,
      loserAccountId: loser.id,
      reason: result.reason ?? "completed",
      winnerXp: progression.winnerXp,
      loserXp: progression.loserXp,
      winnerRatingDelta: progression.winnerRatingDelta,
      loserRatingDelta: progression.loserRatingDelta,
      finishedAt: result.finishedAt ?? this.clock(),
    };
    this.matches.set(match.roomId, match);
    return {
      recorded: true,
      match,
      winner: publicProfile(winner),
      loser: publicProfile(loser),
    };
  }

  #issueSession(account) {
    const session = sessionRecord(account.id, this.clock);
    this.sessions.set(session.tokenHash, session);
    return { account: publicProfile(account), accessToken: session.token, expiresAt: session.expiresAt };
  }

  async close() {}
}
