export const PROTOCOL_VERSION = "1.0";

export class ProtocolError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
    this.details = details;
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProtocolError("INVALID_MESSAGE", `${label} must be an object`);
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProtocolError("INVALID_MESSAGE", `${label} must be a non-empty string`);
  }
  return value;
}

function optionalString(value, label) {
  if (value === undefined || value === null) return undefined;
  return requireString(value, label);
}

function requireInteger(value, label, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ProtocolError("INVALID_MESSAGE", `${label} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function requireCoordinate(value, label) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ProtocolError("INVALID_MESSAGE", `${label} must be [x, y]`);
  }
  return [
    requireInteger(value[0], `${label}[0]`, 0, 64),
    requireInteger(value[1], `${label}[1]`, 0, 64),
  ];
}

function requireStringArray(value, label, max = 8) {
  if (!Array.isArray(value) || value.length > max) {
    throw new ProtocolError("INVALID_MESSAGE", `${label} must be an array with at most ${max} entries`);
  }
  return value.map((item, index) => requireString(item, `${label}[${index}]`));
}

function optionalObject(value, label, maxBytes = 8_192) {
  if (value === undefined || value === null) return {};
  assertObject(value, label);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > maxBytes) {
    throw new ProtocolError("INVALID_MESSAGE", `${label} is too large`);
  }
  return value;
}

function accountCredentials(payload) {
  const accountId = optionalString(payload.accountId, "payload.accountId");
  const accessToken = optionalString(payload.accessToken, "payload.accessToken");
  if ((accountId && !accessToken) || (!accountId && accessToken)) {
    throw new ProtocolError("INVALID_MESSAGE", "accountId and accessToken must be supplied together");
  }
  return { accountId, accessToken };
}

function requiredAccountCredentials(payload) {
  return {
    accountId: requireString(payload.accountId, "payload.accountId"),
    accessToken: requireString(payload.accessToken, "payload.accessToken"),
  };
}

function roomSession(payload) {
  return {
    roomId: requireString(payload.roomId, "payload.roomId"),
    playerId: requireString(payload.playerId, "payload.playerId"),
    sessionToken: requireString(payload.sessionToken, "payload.sessionToken"),
    expectedRevision: requireInteger(payload.expectedRevision, "payload.expectedRevision", 0),
  };
}

export function parseClientMessage(raw) {
  let message;
  try {
    message = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(raw.toString("utf8"));
  } catch {
    throw new ProtocolError("INVALID_JSON", "message is not valid JSON");
  }

  assertObject(message, "message");
  const type = requireString(message.type, "type");
  const requestId = optionalString(message.requestId, "requestId") ?? crypto.randomUUID();
  const protocolVersion = requireString(message.protocolVersion, "protocolVersion");
  if (protocolVersion !== PROTOCOL_VERSION) {
    throw new ProtocolError("UNSUPPORTED_PROTOCOL", `expected protocol ${PROTOCOL_VERSION}`, { received: protocolVersion });
  }
  if (type === "ping") return { type, requestId, protocolVersion };

  const optionalPayload = message.payload ?? {};
  assertObject(optionalPayload, "payload");

  if (type === "lobby.list") {
    const status = optionalString(optionalPayload.status, "payload.status");
    if (status && !["waiting", "active", "finished"].includes(status)) {
      throw new ProtocolError("INVALID_MESSAGE", "payload.status must be waiting, active or finished");
    }
    return { type, requestId, protocolVersion, payload: { status } };
  }

  if (["leaderboard.list", "season.leaderboard"].includes(type)) {
    return {
      type, requestId, protocolVersion,
      payload: {
        limit: optionalPayload.limit === undefined ? 25 : requireInteger(optionalPayload.limit, "payload.limit", 1, 100),
        ...(type === "season.leaderboard" ? { seasonId: optionalString(optionalPayload.seasonId, "payload.seasonId") } : {}),
      },
    };
  }

  if (type === "season.list") return { type, requestId, protocolVersion, payload: {} };

  if (type === "campaign.catalog") {
    return { type, requestId, protocolVersion, payload: accountCredentials(optionalPayload) };
  }

  if (type === "campaign.progress") {
    return { type, requestId, protocolVersion, payload: requiredAccountCredentials(optionalPayload) };
  }

  if (type === "campaign.start") {
    const credentials = accountCredentials(optionalPayload);
    const playerName = optionalString(optionalPayload.playerName, "payload.playerName");
    if (!playerName && !credentials.accountId) throw new ProtocolError("INVALID_MESSAGE", "playerName or account credentials are required");
    return {
      type, requestId, protocolVersion,
      payload: {
        missionId: requireString(optionalPayload.missionId, "payload.missionId"),
        playerName,
        ...credentials,
      },
    };
  }

  if (type === "account.register") {
    return {
      type, requestId, protocolVersion,
      payload: {
        handle: requireString(optionalPayload.handle, "payload.handle"),
        displayName: requireString(optionalPayload.displayName, "payload.displayName"),
        password: requireString(optionalPayload.password, "payload.password"),
      },
    };
  }

  if (type === "account.login") {
    return {
      type, requestId, protocolVersion,
      payload: {
        handle: requireString(optionalPayload.handle, "payload.handle"),
        password: requireString(optionalPayload.password, "payload.password"),
      },
    };
  }

  if (type === "account.recovery.request") {
    return {
      type, requestId, protocolVersion,
      payload: { handle: requireString(optionalPayload.handle, "payload.handle") },
    };
  }

  if (type === "account.recovery.confirm") {
    return {
      type, requestId, protocolVersion,
      payload: {
        handle: requireString(optionalPayload.handle, "payload.handle"),
        recoveryCode: requireString(optionalPayload.recoveryCode, "payload.recoveryCode"),
        newPassword: requireString(optionalPayload.newPassword, "payload.newPassword"),
      },
    };
  }

  if (["account.profile", "account.history"].includes(type)) {
    return {
      type, requestId, protocolVersion,
      payload: {
        ...requiredAccountCredentials(optionalPayload),
        ...(type === "account.history" ? {
          limit: optionalPayload.limit === undefined ? 25 : requireInteger(optionalPayload.limit, "payload.limit", 1, 100),
        } : {}),
      },
    };
  }

  if (["matchmaking.enqueue", "matchmaking.status", "matchmaking.cancel", "matchmaking.accept"].includes(type)) {
    return {
      type, requestId, protocolVersion,
      payload: {
        ...requiredAccountCredentials(optionalPayload),
        ...(type === "matchmaking.enqueue" ? {
          region: optionalString(optionalPayload.region, "payload.region") ?? "global",
          boardSize: optionalPayload.boardSize === undefined ? 5 : requireInteger(optionalPayload.boardSize, "payload.boardSize", 3, 19),
        } : {}),
        ...(type === "matchmaking.accept" ? {
          matchId: requireString(optionalPayload.matchId, "payload.matchId"),
        } : {}),
      },
    };
  }

  if (type === "telemetry.track") {
    return {
      type, requestId, protocolVersion,
      payload: {
        ...accountCredentials(optionalPayload),
        sessionId: requireString(optionalPayload.sessionId, "payload.sessionId"),
        eventName: requireString(optionalPayload.eventName, "payload.eventName"),
        data: optionalObject(optionalPayload.data, "payload.data"),
      },
    };
  }

  const payload = optionalPayload;
  switch (type) {
    case "room.create": {
      const credentials = accountCredentials(payload);
      const playerName = optionalString(payload.playerName, "payload.playerName");
      if (!playerName && !credentials.accountId) throw new ProtocolError("INVALID_MESSAGE", "playerName or account credentials are required");
      return {
        type, requestId, protocolVersion,
        payload: {
          playerName,
          ...credentials,
          roomId: optionalString(payload.roomId, "payload.roomId"),
          boardSize: payload.boardSize === undefined ? 5 : requireInteger(payload.boardSize, "payload.boardSize", 3, 19),
        },
      };
    }

    case "room.join": {
      const credentials = accountCredentials(payload);
      const playerName = optionalString(payload.playerName, "payload.playerName");
      if (!playerName && !credentials.accountId) throw new ProtocolError("INVALID_MESSAGE", "playerName or account credentials are required");
      return {
        type, requestId, protocolVersion,
        payload: {
          roomId: requireString(payload.roomId, "payload.roomId"),
          playerName,
          ...credentials,
        },
      };
    }

    case "room.reconnect":
      return {
        type, requestId, protocolVersion,
        payload: {
          roomId: requireString(payload.roomId, "payload.roomId"),
          playerId: requireString(payload.playerId, "payload.playerId"),
          sessionToken: requireString(payload.sessionToken, "payload.sessionToken"),
          lastRevision: payload.lastRevision === undefined ? 0 : requireInteger(payload.lastRevision, "payload.lastRevision", 0),
        },
      };

    case "action.play_edge":
      return {
        type, requestId, protocolVersion,
        payload: { ...roomSession(payload), start: requireCoordinate(payload.start, "payload.start"), end: requireCoordinate(payload.end, "payload.end") },
      };

    case "action.play_card":
      return {
        type, requestId, protocolVersion,
        payload: {
          ...roomSession(payload),
          cardId: requireString(payload.cardId, "payload.cardId"),
          provinceId: optionalString(payload.provinceId, "payload.provinceId"),
          targetPlayerId: optionalString(payload.targetPlayerId, "payload.targetPlayerId"),
          start: payload.start === undefined ? undefined : requireCoordinate(payload.start, "payload.start"),
          end: payload.end === undefined ? undefined : requireCoordinate(payload.end, "payload.end"),
        },
      };

    case "action.resolve_duel_round":
      return {
        type, requestId, protocolVersion,
        payload: { ...roomSession(payload), duelId: requireString(payload.duelId, "payload.duelId"), cardIds: requireStringArray(payload.cardIds, "payload.cardIds", 6) },
      };

    case "match.forfeit":
      return { type, requestId, protocolVersion, payload: roomSession(payload) };

    default:
      throw new ProtocolError("UNKNOWN_COMMAND", `unsupported command type: ${type}`);
  }
}

export function serverMessage(type, payload = {}, requestId = undefined) {
  return { protocolVersion: PROTOCOL_VERSION, type, ...(requestId ? { requestId } : {}), payload };
}

export function errorMessage(error, requestId = undefined) {
  const normalized = error instanceof ProtocolError
    ? error
    : new ProtocolError("INTERNAL_ERROR", error instanceof Error ? error.message : "internal error");
  return serverMessage("error", { code: normalized.code, message: normalized.message, details: normalized.details }, requestId);
}
