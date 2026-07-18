import { randomBytes, randomUUID } from "node:crypto";

import { hashToken } from "./identity-common.js";
import { ProtocolError } from "./protocol.js";

function recoveryCode() {
  return randomBytes(9).toString("base64url").toUpperCase();
}

export class MemoryCompetitionStore {
  constructor({ clock = () => Date.now(), idFactory = randomUUID } = {}) {
    this.kind = "memory";
    this.clock = clock;
    this.idFactory = idFactory;
    this.seasons = new Map();
    this.seasonRatings = new Map();
    this.queue = new Map();
    this.matches = new Map();
    this.telemetry = [];
    this.recovery = new Map();
    this.ensureCurrentSeason();
  }

  ensureCurrentSeason() {
    const now = this.clock();
    const existing = [...this.seasons.values()].find((season) => season.status === "active");
    if (existing) return existing;
    const season = {
      id: `season-${new Date(now).getUTCFullYear()}-${String(new Date(now).getUTCMonth() + 1).padStart(2, "0")}`,
      name: "Temporada Fundadores",
      startsAt: now,
      endsAt: now + 90 * 24 * 60 * 60 * 1000,
      status: "active",
    };
    this.seasons.set(season.id, season);
    return season;
  }

  async currentSeason() {
    return { ...this.ensureCurrentSeason() };
  }

  async listSeasons() {
    return [...this.seasons.values()].sort((a, b) => b.startsAt - a.startsAt).map((item) => ({ ...item }));
  }

  ratingKey(seasonId, accountId) {
    return `${seasonId}:${accountId}`;
  }

  ensureRating(seasonId, account) {
    const key = this.ratingKey(seasonId, account.id);
    if (!this.seasonRatings.has(key)) {
      this.seasonRatings.set(key, {
        seasonId,
        accountId: account.id,
        handle: account.handle,
        displayName: account.displayName,
        rating: 1000,
        wins: 0,
        losses: 0,
        placementGames: 0,
        updatedAt: this.clock(),
      });
    }
    return this.seasonRatings.get(key);
  }

  async seasonLeaderboard(limit = 50, seasonId = undefined) {
    const resolvedSeason = seasonId ?? (await this.currentSeason()).id;
    return [...this.seasonRatings.values()]
      .filter((entry) => entry.seasonId === resolvedSeason)
      .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.updatedAt - b.updatedAt)
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  async enqueue({ account, region = "global", boardSize = 5 }) {
    const season = await this.currentSeason();
    this.ensureRating(season.id, account);
    const existingMatch = await this.status(account.id);
    if (existingMatch.state === "matched") return existingMatch;

    const now = this.clock();
    const entry = {
      accountId: account.id,
      displayName: account.displayName,
      handle: account.handle,
      rating: account.rating ?? 1000,
      seasonId: season.id,
      region,
      boardSize,
      enqueuedAt: now,
    };
    this.queue.set(account.id, entry);

    const candidate = [...this.queue.values()]
      .filter((item) => item.accountId !== account.id && item.seasonId === season.id && item.region === region && item.boardSize === boardSize)
      .filter((item) => Math.abs(item.rating - entry.rating) <= this.matchWindow(item, entry, now))
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt)[0];

    if (!candidate) return { state: "queued", ticket: { ...entry }, searchWindow: this.matchWindow(entry, entry, now) };

    this.queue.delete(candidate.accountId);
    this.queue.delete(account.id);
    const match = {
      id: `queue-match-${this.idFactory()}`,
      roomId: this.idFactory().replaceAll("-", "").slice(0, 8).toUpperCase(),
      seasonId: season.id,
      hostAccountId: candidate.accountId,
      guestAccountId: account.id,
      region,
      boardSize,
      createdAt: now,
      expiresAt: now + 2 * 60 * 1000,
      accepted: {},
      status: "matched",
    };
    this.matches.set(match.id, match);
    return { state: "matched", match: { ...match }, role: "guest" };
  }

  matchWindow(left, right, now = this.clock()) {
    const waited = Math.max(now - left.enqueuedAt, now - right.enqueuedAt, 0);
    return Math.min(500, 100 + Math.floor(waited / 15_000) * 50);
  }

  async status(accountId) {
    const match = [...this.matches.values()].find((item) =>
      item.status === "matched" && item.expiresAt > this.clock() && [item.hostAccountId, item.guestAccountId].includes(accountId));
    if (match) return { state: "matched", match: { ...match }, role: match.hostAccountId === accountId ? "host" : "guest" };
    const ticket = this.queue.get(accountId);
    if (ticket) return { state: "queued", ticket: { ...ticket }, searchWindow: this.matchWindow(ticket, ticket) };
    return { state: "idle" };
  }

  async accept(accountId, matchId) {
    const match = this.matches.get(matchId);
    if (!match || ![match.hostAccountId, match.guestAccountId].includes(accountId) || match.expiresAt <= this.clock()) {
      throw new ProtocolError("MATCH_NOT_FOUND", "matchmaking assignment is unavailable or expired");
    }
    match.accepted[accountId] = this.clock();
    return { match: { ...match }, role: match.hostAccountId === accountId ? "host" : "guest" };
  }

  async cancel(accountId) {
    const removed = this.queue.delete(accountId);
    return { cancelled: removed };
  }

  async recordSeasonMatch(result, progression) {
    if (!progression?.recorded) return { recorded: false };
    const season = await this.currentSeason();
    const winner = this.ensureRating(season.id, progression.winner);
    const loser = this.ensureRating(season.id, progression.loser);
    winner.rating = Math.max(0, winner.rating + progression.match.winnerRatingDelta);
    winner.wins += 1;
    winner.placementGames += 1;
    winner.updatedAt = this.clock();
    loser.rating = Math.max(0, loser.rating + progression.match.loserRatingDelta);
    loser.losses += 1;
    loser.placementGames += 1;
    loser.updatedAt = this.clock();
    return { recorded: true, seasonId: season.id };
  }

  async recordTelemetry({ accountId = null, sessionId, eventName, payload = {} }) {
    const event = {
      id: `telemetry-${this.idFactory()}`,
      accountId,
      sessionId,
      eventName,
      payload: structuredClone(payload),
      createdAt: this.clock(),
    };
    this.telemetry.push(event);
    this.telemetry = this.telemetry.slice(-10_000);
    return { accepted: true, eventId: event.id };
  }

  async createRecovery(accountId) {
    const code = recoveryCode();
    this.recovery.set(accountId, {
      codeHash: hashToken(code),
      expiresAt: this.clock() + 15 * 60 * 1000,
      attempts: 0,
    });
    return { accepted: true, recoveryCode: code, expiresAt: this.clock() + 15 * 60 * 1000 };
  }

  async consumeRecovery(accountId, code) {
    const challenge = this.recovery.get(accountId);
    if (!challenge || challenge.expiresAt <= this.clock()) {
      throw new ProtocolError("RECOVERY_INVALID", "recovery code is invalid or expired");
    }
    challenge.attempts += 1;
    if (challenge.attempts > 5 || hashToken(code.toUpperCase()) !== challenge.codeHash) {
      throw new ProtocolError("RECOVERY_INVALID", "recovery code is invalid or expired");
    }
    this.recovery.delete(accountId);
    return { verified: true };
  }

  async close() {}
}
