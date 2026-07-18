import { timingSafeEqual } from "node:crypto";

import { WebSocket, WebSocketServer } from "ws";

import { renderAdminPanel } from "./admin-panel.js";
import { MemoryResilienceStore } from "./resilience-store.js";
import { errorMessage, serverMessage } from "./protocol.js";
import { startServer as startClusterServer } from "./server-cluster.js";

const SERVER_VERSION = "0.7.0";
const DEFAULT_MAINTENANCE_MS = 5_000;

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function json(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function adminAuthorized(request) {
  const expected = process.env.HEXA_ADMIN_TOKEN ?? "";
  if (!expected) return false;
  const header = request.headers.authorization ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function publicPresence(entries) {
  return entries.map((entry) => ({
    playerId: entry.playerId,
    online: entry.online,
    lastSeen: entry.lastSeen,
    instances: entry.instances.length,
  }));
}

function parseNumber(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function decorateManager({ manager, resilience, eventBus, presence, logger }) {
  if (manager.__sprint11Decorated) return;
  manager.__sprint11Decorated = true;

  for (const methodName of ["createRoom", "joinRoom", "applyCommand"]) {
    const original = manager[methodName].bind(manager);
    manager[methodName] = async (...args) => {
      const result = await original(...args);
      if (result?.room && result?.patch) await resilience.appendReplay(result.room, result.patch);
      return result;
    };
  }

  const originalReconnect = manager.reconnect.bind(manager);
  manager.reconnect = async (payload) => {
    const result = await originalReconnect(payload);
    const cancelled = await resilience.cancelDisconnect(result.room.id, result.player.id);
    if (result.connectionPatch) await resilience.appendReplay(result.room, result.connectionPatch);
    if (cancelled.cancelled) {
      await eventBus.publish("room.update", {
        roomId: result.room.id,
        messages: [serverMessage("player.reconnect_restored", {
          roomId: result.room.id,
          playerId: result.player.id,
          restoredAt: Date.now(),
        })],
        refreshPrivate: false,
      });
    }
    return result;
  };

  const originalDisconnect = manager.disconnect.bind(manager);
  manager.disconnectImmediately = originalDisconnect;
  manager.disconnect = async (roomId, playerId) => {
    try {
      const room = await manager.getRoom(roomId);
      const player = room.players.find((item) => item.id === playerId);
      if (!player || room.status === "finished") return null;
      const lease = await resilience.scheduleDisconnect({
        roomId,
        playerId,
        accountId: player.accountId ?? null,
        sourceInstanceId: eventBus.instanceId,
      });
      await eventBus.publish("room.update", {
        roomId,
        messages: [serverMessage("player.reconnect_grace", {
          roomId,
          playerId,
          deadlineAt: lease.deadlineAt,
        })],
        refreshPrivate: false,
      });
      return null;
    } catch (error) {
      logger.warn("reconnect lease scheduling failed", { roomId, playerId, error });
      return originalDisconnect(roomId, playerId);
    }
  };
}

async function finishExpiredDisconnect({ lease, manager, resilience, eventBus, presence, identity, competition, governance, metrics, logger }) {
  const online = await presence.listRoom(lease.roomId);
  if (online.some((entry) => entry.playerId === lease.playerId && entry.online)) return null;

  let result;
  try {
    result = await manager.expireDisconnect(lease.roomId, lease.playerId);
  } catch (error) {
    if (["ROOM_NOT_FOUND", "ROOM_WRITE_CONFLICT", "MATCH_NOT_ACTIVE"].includes(error.code)) return null;
    throw error;
  }
  if (!result) return null;

  const { room, patch } = result;
  await resilience.appendReplay(room, patch);
  const messages = [serverMessage("room.patch", patch)];

  if (patch.event.type === "match.finished") {
    const progression = await identity.recordMatch(room.matchResult);
    if (progression.recorded) {
      await competition.recordSeasonMatch(room.matchResult, progression);
      messages.unshift(serverMessage("match.progression", {
        ...progression,
        season: await competition.currentSeason(),
      }));
    }
    if (lease.accountId) {
      const penalty = await governance.penalize({
        accountId: lease.accountId,
        kind: "match_abandonment",
        points: 2,
        durationMs: Number(process.env.HEXA_ABANDONMENT_COOLDOWN_MS ?? 10 * 60 * 1000),
        reason: "match abandoned after reconnect grace expired",
        sourceId: room.id,
      });
      await eventBus.publish("penalty.updated", { accountId: lease.accountId, penalty });
    }
    metrics.inc("hexa_matches_completed_total", { reason: "abandonment" });
    metrics.inc("hexa_matchmaking_penalties_total", { kind: "match_abandonment" });
  }

  await eventBus.publish("room.update", { roomId: room.id, messages, refreshPrivate: true });
  await eventBus.publish("lobby.invalidate", {});
  logger.info("expired reconnect lease finalized", {
    roomId: room.id,
    playerId: lease.playerId,
    eventType: patch.event.type,
  });
  return result;
}

export function startServer({
  resilience = new MemoryResilienceStore(),
  ...options
} = {}) {
  decorateManager({
    manager: options.manager,
    resilience,
    eventBus: options.eventBus,
    presence: options.presence,
    logger: options.logger,
  });

  const instance = startClusterServer(options);
  const {
    httpServer,
    manager,
    identity,
    competition,
    governance,
    eventBus,
    presence,
    metrics,
    logger = options.logger,
  } = instance;
  const spectators = new Set();
  const spectatorRoom = new WeakMap();
  const spectatorServer = new WebSocketServer({ noServer: true });

  const baseRequestHandlers = httpServer.listeners("request");
  httpServer.removeAllListeners("request");
  httpServer.on("request", async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (url.pathname === "/admin" && request.method === "GET") {
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
        });
        response.end(renderAdminPanel());
        return;
      }
      if (url.pathname === "/admin/overview" && request.method === "GET") {
        if (!adminAuthorized(request)) {
          json(response, 401, { ok: false, error: "unauthorized" });
          return;
        }
        const health = {
          ok: true,
          version: SERVER_VERSION,
          instanceId: eventBus.instanceId,
          spectators: spectators.size,
          resilienceStore: resilience.kind,
          ...(await presence.summary()),
        };
        json(response, 200, {
          health,
          disconnects: await resilience.listDisconnects(),
          replays: await resilience.listReplays({ limit: 100 }),
          penalties: await governance.listPenalties(),
          currentSeason: await competition.currentSeason(),
          seasons: await competition.listSeasons(),
          signature: "Tehkné Solutions",
        });
        return;
      }
      if (url.pathname === "/replays" && request.method === "GET") {
        json(response, 200, {
          replays: await resilience.listReplays({
            limit: parseNumber(url.searchParams.get("limit"), 50, 1, 200),
            status: url.searchParams.get("status") ?? undefined,
          }),
        });
        return;
      }
      if (url.pathname.startsWith("/replays/") && request.method === "GET") {
        const roomId = decodeURIComponent(url.pathname.slice("/replays/".length));
        const replay = await resilience.getReplay(roomId, {
          afterRevision: parseNumber(url.searchParams.get("afterRevision"), 0, 0),
          limit: parseNumber(url.searchParams.get("limit"), 500, 1, 2_000),
        });
        if (!replay) {
          json(response, 404, { ok: false, error: "replay_not_found" });
          return;
        }
        json(response, 200, replay);
        return;
      }
      if (url.pathname === "/admin/disconnects" && request.method === "GET") {
        if (!adminAuthorized(request)) {
          json(response, 401, { ok: false, error: "unauthorized" });
          return;
        }
        json(response, 200, { disconnects: await resilience.listDisconnects(url.searchParams.get("roomId") ?? undefined) });
        return;
      }
      if (url.pathname === "/health" && request.method === "GET") {
        json(response, 200, {
          ok: true,
          version: SERVER_VERSION,
          instanceId: eventBus.instanceId,
          roomStore: manager.store?.kind ?? "memory",
          identityStore: identity.kind ?? "memory",
          competitionStore: competition.kind ?? "memory",
          governanceStore: governance.kind ?? "memory",
          clusterBus: eventBus.kind ?? "memory",
          presenceStore: presence.kind ?? "memory",
          resilienceStore: resilience.kind,
          spectators: spectators.size,
          ...(await presence.summary()),
          signature: "Tehkné Solutions",
        });
        return;
      }
      for (const handler of baseRequestHandlers) handler.call(httpServer, request, response);
    } catch (error) {
      logger?.error?.("sprint 11 http request failed", { path: url.pathname, error });
      if (!response.headersSent) json(response, 500, { ok: false, error: error.code ?? "internal_error", message: error.message });
      else response.end();
    }
  });

  const baseUpgradeHandlers = httpServer.listeners("upgrade");
  httpServer.removeAllListeners("upgrade");
  httpServer.on("upgrade", (request, socket, head) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (path === "/spectator") {
      spectatorServer.handleUpgrade(request, socket, head, (websocket) => {
        spectatorServer.emit("connection", websocket, request);
      });
      return;
    }
    for (const handler of baseUpgradeHandlers) handler.call(httpServer, request, socket, head);
  });

  spectatorServer.on("connection", async (socket, request) => {
    spectators.add(socket);
    try {
      const url = new URL(request.url ?? "/spectator", "http://127.0.0.1");
      const roomId = url.searchParams.get("roomId") ?? "";
      if (!roomId) throw Object.assign(new Error("roomId is required"), { code: "ROOM_REQUIRED" });
      const room = await manager.getRoom(roomId);
      spectatorRoom.set(socket, roomId);
      send(socket, serverMessage("server.hello", {
        transport: "websocket",
        role: "spectator",
        instanceId: eventBus.instanceId,
        commands: ["ping", "replay.get"],
        publicEvents: ["room.patch", "presence.updated", "match.progression", "player.reconnect_grace", "player.reconnect_restored"],
      }));
      send(socket, serverMessage("spectator.established", {
        roomId,
        snapshot: room.snapshot(),
        presence: publicPresence(await presence.listRoom(roomId)),
        replay: await resilience.getReplay(roomId, { afterRevision: Math.max(0, room.revision - 100) }),
        signature: "Tehkné Solutions",
      }));
      metrics.inc("hexa_spectators_opened_total");
    } catch (error) {
      send(socket, errorMessage(error));
      socket.close(1008, "spectator session rejected");
    }

    socket.on("message", async (raw) => {
      try {
        const message = JSON.parse(raw.toString("utf8"));
        if (message.type === "ping") {
          send(socket, serverMessage("pong", { at: Date.now(), instanceId: eventBus.instanceId }, message.requestId));
          return;
        }
        if (message.type === "replay.get") {
          const roomId = spectatorRoom.get(socket);
          send(socket, serverMessage("replay.data", await resilience.getReplay(roomId, {
            afterRevision: Number(message.payload?.afterRevision ?? 0),
            limit: Number(message.payload?.limit ?? 500),
          }), message.requestId));
          return;
        }
        throw Object.assign(new Error("unsupported spectator command"), { code: "UNKNOWN_COMMAND" });
      } catch (error) {
        send(socket, errorMessage(error));
      }
    });

    socket.on("close", () => spectators.delete(socket));
  });

  const unsubscribeSpectators = eventBus.subscribe(async (event) => {
    if (event.topic === "room.update") {
      for (const socket of spectators) {
        if (spectatorRoom.get(socket) !== event.payload.roomId) continue;
        for (const message of event.payload.messages ?? []) send(socket, message);
      }
    }
    if (event.topic === "presence.invalidate") {
      for (const socket of spectators) {
        if (spectatorRoom.get(socket) !== event.payload.roomId) continue;
        send(socket, serverMessage("presence.updated", {
          roomId: event.payload.roomId,
          players: publicPresence(await presence.listRoom(event.payload.roomId)),
        }));
      }
    }
  });

  const maintenanceMs = Number(process.env.HEXA_RESILIENCE_MAINTENANCE_MS ?? DEFAULT_MAINTENANCE_MS);
  const resilienceTimer = setInterval(async () => {
    try {
      const leases = await resilience.claimExpiredDisconnects(50);
      for (const lease of leases) {
        await finishExpiredDisconnect({
          lease,
          manager,
          resilience,
          eventBus,
          presence,
          identity,
          competition,
          governance,
          metrics,
          logger,
        });
      }
    } catch (error) {
      logger?.warn?.("resilience maintenance failed", { error, instanceId: eventBus.instanceId });
      metrics.inc("hexa_resilience_maintenance_errors_total");
    }
  }, Math.max(1_000, maintenanceMs));
  resilienceTimer.unref?.();

  const baseClose = instance.close.bind(instance);
  instance.resilience = resilience;
  instance.spectatorServer = spectatorServer;
  instance.close = async () => {
    clearInterval(resilienceTimer);
    unsubscribeSpectators();
    for (const socket of spectators) socket.terminate();
    await new Promise((resolve) => spectatorServer.close(() => resolve()));
    await resilience.close?.();
    await baseClose();
  };
  return instance;
}
