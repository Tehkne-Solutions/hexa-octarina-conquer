import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import { ProtocolError } from "./protocol.js";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeHandle(value) {
  if (typeof value !== "string") throw new ProtocolError("INVALID_HANDLE", "handle must be a string");
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (normalized.length < 3 || normalized.length > 24) {
    throw new ProtocolError("INVALID_HANDLE", "handle must contain 3 to 24 letters, numbers or underscores");
  }
  return normalized;
}

export function normalizeDisplayName(value) {
  if (typeof value !== "string") throw new ProtocolError("INVALID_DISPLAY_NAME", "display name must be a string");
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 32) {
    throw new ProtocolError("INVALID_DISPLAY_NAME", "display name must contain 2 to 32 characters");
  }
  return normalized;
}

export function validatePassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new ProtocolError("INVALID_PASSWORD", "password must contain 8 to 128 characters");
  }
  return value;
}

export function createPasswordRecord(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  validatePassword(password);
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAccountRecord({ handle, displayName, password, clock = () => Date.now(), idFactory = randomUUID }) {
  const passwordRecord = createPasswordRecord(password);
  const now = clock();
  return {
    id: `account-${idFactory()}`,
    handle: normalizeHandle(handle),
    displayName: normalizeDisplayName(displayName),
    passwordHash: passwordRecord.hash,
    passwordSalt: passwordRecord.salt,
    xp: 0,
    level: 1,
    rating: 1000,
    wins: 0,
    losses: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function publicProfile(account, rank = undefined) {
  if (!account) return null;
  return {
    id: account.id,
    handle: account.handle,
    displayName: account.displayName,
    xp: Number(account.xp ?? 0),
    level: Number(account.level ?? 1),
    rating: Number(account.rating ?? 1000),
    wins: Number(account.wins ?? 0),
    losses: Number(account.losses ?? 0),
    ...(rank === undefined ? {} : { rank }),
    createdAt: Number(account.createdAt ?? account.created_at ?? 0),
    updatedAt: Number(account.updatedAt ?? account.updated_at ?? 0),
  };
}

export function levelForXp(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
}

export function progressionForResult({ winnerRating, loserRating }) {
  const expectedWinner = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const winnerDelta = Math.max(12, Math.round(32 * (1 - expectedWinner)));
  const loserDelta = -Math.max(8, Math.round(24 * expectedWinner));
  return {
    winnerXp: 120,
    loserXp: 45,
    winnerRatingDelta: winnerDelta,
    loserRatingDelta: loserDelta,
  };
}

export function sessionRecord(accountId, clock = () => Date.now()) {
  const token = createAccessToken();
  const createdAt = clock();
  return {
    token,
    tokenHash: hashToken(token),
    accountId,
    createdAt,
    expiresAt: createdAt + SESSION_TTL_MS,
  };
}

export function assertValidSession(session, accountId, clock = () => Date.now()) {
  if (!session || session.accountId !== accountId || Number(session.expiresAt) <= clock()) {
    throw new ProtocolError("INVALID_ACCOUNT_SESSION", "account credentials are invalid or expired");
  }
}
