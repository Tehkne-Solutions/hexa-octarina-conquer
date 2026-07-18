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
    throw new ProtocolError("UNSUPPORTED_PROTOCOL", `expected protocol ${PROTOCOL_VERSION}`, {
      received: protocolVersion,
    });
  }

  if (type === "ping") return { type, requestId, protocolVersion };

  if (type === "lobby.list") {
    const payload = message.payload ?? {};
    assertObject(payload, "payload");
    const status = optionalString(payload.status, "payload.status");
    if (status && !["waiting", "active", "finished"].includes(status)) {
      throw new ProtocolError("INVALID_MESSAGE", "payload.status must be waiting, active or finished");
    }
    return { type, requestId, protocolVersion, payload: { status } };
  }

  assertObject(message.payload, "payload");
  const payload = message.payload;

  switch (type) {
    case "room.create":
      return {
        type,
        requestId,
        protocolVersion,
        payload: {
          playerName: requireString(payload.playerName, "payload.playerName"),
          boardSize: payload.boardSize === undefined
            ? 5
            : requireInteger(payload.boardSize, "payload.boardSize", 3, 19),
        },
      };

    case "room.join":
      return {
        type,
        requestId,
        protocolVersion,
        payload: {
          roomId: requireString(payload.roomId, "payload.roomId"),
          playerName: requireString(payload.playerName, "payload.playerName"),
        },
      };

    case "room.reconnect":
      return {
        type,
        requestId,
        protocolVersion,
        payload: {
          roomId: requireString(payload.roomId, "payload.roomId"),
          playerId: requireString(payload.playerId, "payload.playerId"),
          sessionToken: requireString(payload.sessionToken, "payload.sessionToken"),
          lastRevision: payload.lastRevision === undefined
            ? 0
            : requireInteger(payload.lastRevision, "payload.lastRevision", 0),
        },
      };

    case "action.play_edge":
      return {
        type,
        requestId,
        protocolVersion,
        payload: {
          roomId: requireString(payload.roomId, "payload.roomId"),
          playerId: requireString(payload.playerId, "payload.playerId"),
          sessionToken: requireString(payload.sessionToken, "payload.sessionToken"),
          expectedRevision: requireInteger(payload.expectedRevision, "payload.expectedRevision", 0),
          start: requireCoordinate(payload.start, "payload.start"),
          end: requireCoordinate(payload.end, "payload.end"),
        },
      };

    case "action.play_card":
      return {
        type,
        requestId,
        protocolVersion,
        payload: {
          roomId: requireString(payload.roomId, "payload.roomId"),
          playerId: requireString(payload.playerId, "payload.playerId"),
          sessionToken: requireString(payload.sessionToken, "payload.sessionToken"),
          expectedRevision: requireInteger(payload.expectedRevision, "payload.expectedRevision", 0),
          cardId: requireString(payload.cardId, "payload.cardId"),
          provinceId: optionalString(payload.provinceId, "payload.provinceId"),
          targetPlayerId: optionalString(payload.targetPlayerId, "payload.targetPlayerId"),
          start: payload.start === undefined ? undefined : requireCoordinate(payload.start, "payload.start"),
          end: payload.end === undefined ? undefined : requireCoordinate(payload.end, "payload.end"),
        },
      };

    case "action.resolve_duel_round":
      return {
        type,
        requestId,
        protocolVersion,
        payload: {
          roomId: requireString(payload.roomId, "payload.roomId"),
          playerId: requireString(payload.playerId, "payload.playerId"),
          sessionToken: requireString(payload.sessionToken, "payload.sessionToken"),
          expectedRevision: requireInteger(payload.expectedRevision, "payload.expectedRevision", 0),
          duelId: requireString(payload.duelId, "payload.duelId"),
          cardIds: requireStringArray(payload.cardIds, "payload.cardIds", 6),
        },
      };

    default:
      throw new ProtocolError("UNKNOWN_COMMAND", `unsupported command type: ${type}`);
  }
}

export function serverMessage(type, payload = {}, requestId = undefined) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type,
    ...(requestId ? { requestId } : {}),
    payload,
  };
}

export function errorMessage(error, requestId = undefined) {
  const normalized = error instanceof ProtocolError
    ? error
    : new ProtocolError("INTERNAL_ERROR", error instanceof Error ? error.message : "internal error");
  return serverMessage("error", {
    code: normalized.code,
    message: normalized.message,
    details: normalized.details,
  }, requestId);
}
