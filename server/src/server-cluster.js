import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

import { WebSocket, WebSocketServer } from "ws";

import { MemoryClusterBus } from "./cluster-bus.js";
import { MemoryCompetitionStore } from "./competition-memory.js";
import { MemoryGovernanceStore } from "./governance-store.js";
import { MemoryIdentityStore } from "./identity-memory.js";
import { createLogger } from "./logger.js";
import { MetricsRegistry } from "./metrics.js";
import { MemoryPresenceStore } from "./presence-store.js";
import { ProtocolError, errorMessage, parseClientMessage, serverMessage } from "./protocol.js";
import { createRecoveryProvider } from "./recovery-provider.js";
import { RoomManager } from "./room-manager.js";

const SERVER_VERSION = "0.6.0";
const HEARTBEAT_INTERVAL_MS = 15_000;

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

async function readJsonBody(request, maxBytes = 32_768) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new ProtocolError("PAYLOAD_TOO_LARGE", "request body is too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ProtocolError("INVALID_JSON", "request body is not valid JSON");
  }
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

export function startServer({
  port = 8080,
  manager = new RoomManager(),
  identity = new MemoryIdentityStore(),
  competition = new MemoryCompetitionStore(),
  eventBus = new MemoryClusterBus(),
  presence = new MemoryPresenceStore({ instanceId: eventBus.instanceId }),
  governance = new MemoryGovernanceStore({ competition }),
  recoveryProvider = createRecoveryProvider(),
  metrics = new MetricsRegistry(),
  logger = createLogger(),
} = {}) {
  const startedAt = Date.now();
  const instanceId = eventBus.instanceId;
  const connectedSockets = new Set();
  const sessionBySocket = new WeakMap();
  const accountBySocket = new WeakMap();
  const socketsByRoom = new Map();
  let maintenanceCycles = 0;

  function localBroadcast(roomId, message) {
    for (const socket of socketsByRoom.get(roomId) ?? []) send(socket, message);
  }

  function localBroadcastExcept(roomId, message, excludedSocket) {
    for (const socket of socketsByRoom.get(roomId) ?? []) {
      if (socket !== excludedSocket) send(socket, message);
    }
  }

  function sendPrivateState(socket, room, playerId) {
    send(socket, serverMessage("player.private_state", room.privateStateFor(playerId)));
  }

  function broadcastPrivateStates(room) {
    for (const socket of socketsByRoom.get(room.id) ?? []) {
      const session = sessionBySocket.get(socket);
      if (session?.playerId) sendPrivateState(socket, room, session.playerId);
    }
  }

  async function clusterRoomUpdate(roomId, messages = [], { refreshPrivate = true } = {}) {
    await eventBus.publish("room.update", { roomId, messages, refreshPrivate });
  }

  async function invalidateLobby() {
    await eventBus.publish("lobby.invalidate", {});
  }

  async function invalidatePresence(roomId) {
    await eventBus.publish("presence.invalidate", { roomId });
  }

  async function registerSocket(socket, room, player) {
    const previous = sessionBySocket.get(socket);
    if (previous) {
      socketsByRoom.get(previous.roomId)?.delete(socket);
      await presence.markOffline(previous);
      await invalidatePresence(previous.roomId);
    }
    const session = {
      roomId: room.id,
      playerId: player.id,
      accountId: player.accountId ?? null,
    };
    sessionBySocket.set(socket, session);
    if (player.accountId) accountBySocket.set(socket, player.accountId);
    if (!socketsByRoom.has(room.id)) socketsByRoom.set(room.id, new Set());
    socketsByRoom.get(room.id).add(socket);
    await presence.markOnline(session);
    await invalidatePresence(room.id);
  }

  const unsubscribeCluster = eventBus.subscribe(async (event) => {
    try {
      if (event.topic === "room.update") {
        const { roomId, messages = [], refreshPrivate = true } = event.payload;
        for (const message of messages) localBroadcast(roomId, message);
        if (refreshPrivate && (socketsByRoom.get(roomId)?.size ?? 0) > 0) {
          try {
            const room = await manager.getRoom(roomId);
            broadcastPrivateStates(room);
          } catch (error) {
            if (error.code !== "ROOM_NOT_FOUND") throw error;
          }
        }
        return;
      }
      if (event.topic === "lobby.invalidate") {
        const message = serverMessage("lobby.updated", { rooms: await manager.listRooms() });
        for (const socket of connectedSockets) send(socket, message);
        return;
      }
      if (event.topic === "presence.invalidate") {
        const roomId = event.payload.roomId;
        localBroadcast(roomId, serverMessage("presence.updated", {
          roomId,
          players: publicPresence(await presence.listRoom(roomId)),
        }));
        return;
      }
      if (event.topic === "season.invalidate") {
        const message = serverMessage("season.data", {
          current: await competition.currentSeason(),
          seasons: await competition.listSeasons(),
        });
        for (const socket of connectedSockets) send(socket, message);
        return;
      }
      if (event.topic === "penalty.updated") {
        for (const socket of connectedSockets) {
          if (accountBySocket.get(socket) === event.payload.accountId) {
            send(socket, serverMessage("matchmaking.penalty", event.payload));
          }
        }
      }
    } catch (error) {
      logger.warn("cluster event handling failed", { topic: event.topic, eventId: event.id, error });
      metrics.inc("hexa_cluster_event_errors_total", { topic: event.topic });
    }
  });

  async function authenticatedRoomPayload(payload) {
    if (!payload.accountId) return { ...payload, accountId: null, playerName: payload.playerName };
    const account = await identity.authenticate(payload.accountId, payload.accessToken);
    return { ...payload, accountId: account.id, playerName: account.displayName };
  }

  async function sendEstablishedSession(socket, requestId, room, player, patch = null, extra = {}) {
    await registerSocket(socket, room, player);
    send(socket, serverMessage("session.established", {
      roomId: room.id,
      playerId: player.id,
      sessionToken: player.sessionToken,
      snapshot: room.snapshot(),
      privateState: room.privateStateFor(player.id),
      presence: publicPresence(await presence.listRoom(room.id)),
      ...extra,
    }, requestId));
    await clusterRoomUpdate(room.id, patch ? [serverMessage("room.patch", patch)] : [], { refreshPrivate: true });
    await invalidateLobby();
  }

  async function claimMatch(socket, requestId, account, assignment) {
    const { match, role } = assignment;
    let room;
    try {
      room = await manager.getRoom(match.roomId);
    } catch (error) {
      if (error.code !== "ROOM_NOT_FOUND") throw error;
      if (role !== "host") {
        throw new ProtocolError("MATCH_HOST_PENDING", "the host has not created the assigned room yet", {
          matchId: match.id,
          roomId: match.roomId,
        });
      }
    }

    let player = room?.players.find((item) => item.accountId === account.id);
    let patch = null;
    if (!room) {
      const created = await manager.createRoom({
        roomId: match.roomId,
        boardSize: match.boardSize,
        playerName: account.displayName,
        accountId: account.id,
      });
      room = created.room;
      player = created.player;
      patch = created.patch;
    } else if (!player) {
      const joined = await manager.joinRoom({
        roomId: match.roomId,
        playerName: account.displayName,
        accountId: account.id,
      });
      room = joined.room;
      player = joined.player;
      patch = joined.patch;
    }

    await sendEstablishedSession(socket, requestId, room, player, patch, {
      matchmaking: { matchId: match.id, seasonId: match.seasonId, role },
    });
    return { room, player };
  }

  const httpServer = createServer(async (request, response) => {
    const requestStartedAt = Date.now();
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (url.pathname === "/health") {
        const presenceSummary = await presence.summary();
        json(response, 200, {
          ok: true,
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
          rooms: manager.rooms?.size ?? 0,
          roomStore: manager.store?.kind ?? "memory",
          identityStore: identity.kind ?? "memory",
          competitionStore: competition.kind ?? "memory",
          governanceStore: governance.kind ?? "memory",
          clusterBus: eventBus.kind ?? "memory",
          presenceStore: presence.kind ?? "memory",
          recoveryProvider: recoveryProvider.kind ?? "none",
          instanceId,
          ...presenceSummary,
          version: SERVER_VERSION,
          signature: "Tehkné Solutions",
        });
        return;
      }
      if (url.pathname === "/rooms") {
        json(response, 200, { rooms: await manager.listRooms() });
        return;
      }
      if (url.pathname === "/presence") {
        const roomId = url.searchParams.get("roomId");
        if (!roomId) {
          json(response, 200, await presence.summary());
        } else {
          json(response, 200, { roomId, players: publicPresence(await presence.listRoom(roomId)) });
        }
        return;
      }
      if (url.pathname === "/leaderboard") {
        const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25));
        json(response, 200, { leaderboard: await identity.leaderboard(limit) });
        return;
      }
      if (url.pathname === "/seasons") {
        json(response, 200, { current: await competition.currentSeason(), seasons: await competition.listSeasons() });
        return;
      }
      if (url.pathname === "/season-leaderboard") {
        const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25));
        const seasonId = url.searchParams.get("seasonId") ?? undefined;
        json(response, 200, {
          season: seasonId ?? (await competition.currentSeason()).id,
          leaderboard: await competition.seasonLeaderboard(limit, seasonId),
        });
        return;
      }
      if (url.pathname.startsWith("/admin/")) {
        if (!adminAuthorized(request)) {
          json(response, 401, { ok: false, error: "unauthorized" });
          return;
        }
        if (url.pathname === "/admin/seasons" && request.method === "GET") {
          json(response, 200, { current: await competition.currentSeason(), seasons: await competition.listSeasons() });
          return;
        }
        if (url.pathname === "/admin/seasons" && request.method === "POST") {
          const body = await readJsonBody(request);
          let season;
          if (body.action === "create") season = await governance.createSeason(body);
          else if (body.action === "activate") season = await governance.activateSeason(body.seasonId);
          else if (body.action === "close") season = await governance.closeSeason(body.seasonId);
          else throw new ProtocolError("INVALID_ADMIN_ACTION", "unsupported season administration action");
          await eventBus.publish("season.invalidate", { seasonId: season.id, action: body.action });
          json(response, 200, { ok: true, season });
          return;
        }
        if (url.pathname === "/admin/penalties" && request.method === "GET") {
          json(response, 200, { penalties: await governance.listPenalties(url.searchParams.get("accountId") ?? undefined) });
          return;
        }
        if (url.pathname === "/admin/penalties" && request.method === "POST") {
          const body = await readJsonBody(request);
          if (body.action === "clear") {
            json(response, 200, { ok: true, ...(await governance.clearPenalties(body.accountId)) });
            return;
          }
          const penalty = await governance.penalize({
            accountId: body.accountId,
            kind: body.kind ?? "admin",
            points: Number(body.points ?? 1),
            durationMs: Number(body.durationMs ?? 60_000),
            reason: body.reason ?? "administrative penalty",
            sourceId: body.sourceId ?? null,
          });
          await eventBus.publish("penalty.updated", { accountId: body.accountId, penalty });
          json(response, 200, { ok: true, penalty });
          return;
        }
        json(response, 404, { ok: false, error: "admin_not_found" });
        return;
      }
      if (url.pathname === "/metrics") {
        response.writeHead(200, { "content-type": "text/plain; version=0.0.4; charset=utf-8", "cache-control": "no-store" });
        response.end(metrics.render({ roomCount: manager.rooms?.size ?? 0, socketCount: connectedSockets.size }));
        return;
      }
      json(response, 404, { ok: false, error: "not_found" });
    } catch (error) {
      const status = error instanceof ProtocolError ? 400 : 500;
      metrics.inc("hexa_http_errors_total", { path: url.pathname, code: error.code ?? "INTERNAL_ERROR" });
      logger.error("http request failed", { path: url.pathname, error });
      json(response, status, { ok: false, error: error.code ?? "internal_error", message: error.message });
    } finally {
      metrics.inc("hexa_http_requests_total", { method: request.method ?? "GET", path: url.pathname });
      metrics.observeDuration("hexa_http_request_duration", requestStartedAt, { path: url.pathname });
    }
  });

  const websocketServer = new WebSocketServer({ server: httpServer, path: "/ws" });

  websocketServer.on("connection", (socket, request) => {
    connectedSockets.add(socket);
    metrics.inc("hexa_websocket_opened_total");
    logger.info("websocket connected", { remoteAddress: request.socket.remoteAddress, instanceId });
    send(socket, serverMessage("server.hello", {
      transport: "websocket",
      instanceId,
      commands: [
        "account.register", "account.login", "account.profile", "account.history",
        "account.recovery.request", "account.recovery.confirm",
        "leaderboard.list", "season.list", "season.leaderboard", "lobby.list",
        "matchmaking.enqueue", "matchmaking.status", "matchmaking.cancel", "matchmaking.accept",
        "telemetry.track", "room.create", "room.join", "room.reconnect",
        "action.play_edge", "action.play_card", "action.resolve_duel_round", "match.forfeit",
      ],
      privateEvents: [
        "player.private_state", "account.session", "account.profile", "account.history",
        "account.recovery.requested", "matchmaking.state", "matchmaking.penalty",
      ],
      publicEvents: ["room.patch", "presence.updated", "lobby.updated", "season.data"],
    }));

    socket.on("message", async (raw) => {
      const messageStartedAt = Date.now();
      let requestId;
      let commandType = "unknown";
      try {
        const command = parseClientMessage(raw);
        requestId = command.requestId;
        commandType = command.type;
        metrics.inc("hexa_websocket_messages_total", { type: command.type });
        const currentSession = sessionBySocket.get(socket);
        if (currentSession) await presence.heartbeatPlayer(currentSession);

        if (command.type === "ping") {
          send(socket, serverMessage("pong", { at: Date.now(), instanceId }, requestId));
          return;
        }
        if (command.type === "account.register") {
          const session = await identity.register(command.payload);
          accountBySocket.set(socket, session.account.id);
          metrics.inc("hexa_accounts_registered_total");
          send(socket, serverMessage("account.session", session, requestId));
          return;
        }
        if (command.type === "account.login") {
          const session = await identity.login(command.payload);
          accountBySocket.set(socket, session.account.id);
          metrics.inc("hexa_account_logins_total");
          send(socket, serverMessage("account.session", session, requestId));
          return;
        }
        if (command.type === "account.recovery.request") {
          const fallbackExpiry = Date.now() + 15 * 60 * 1000;
          const accountId = await identity.findAccountIdByHandle(command.payload.handle);
          let challenge = null;
          if (accountId) {
            challenge = await competition.createRecovery(accountId);
            try {
              const account = await identity.getProfile(accountId);
              const delivery = await recoveryProvider.deliver({
                account,
                recoveryCode: challenge.recoveryCode,
                expiresAt: challenge.expiresAt,
              });
              metrics.inc("hexa_recovery_delivery_total", { provider: delivery.provider, delivered: String(delivery.delivered) });
            } catch (error) {
              logger.error("recovery delivery failed", { accountId, provider: recoveryProvider.kind, error });
              metrics.inc("hexa_recovery_delivery_errors_total", { provider: recoveryProvider.kind });
            }
          }
          const exposeCode = recoveryProvider.kind === "console" && (process.env.NODE_ENV !== "production" || process.env.HEXA_RECOVERY_EXPOSE_CODE === "true");
          metrics.inc("hexa_recovery_requested_total");
          send(socket, serverMessage("account.recovery.requested", {
            accepted: true,
            expiresAt: challenge?.expiresAt ?? fallbackExpiry,
            ...(challenge && exposeCode ? { recoveryCode: challenge.recoveryCode } : {}),
          }, requestId));
          return;
        }
        if (command.type === "account.recovery.confirm") {
          const accountId = await identity.findAccountIdByHandle(command.payload.handle);
          if (!accountId) throw new ProtocolError("RECOVERY_INVALID", "recovery code is invalid or expired");
          await competition.consumeRecovery(accountId, command.payload.recoveryCode);
          const session = await identity.resetPassword(accountId, command.payload.newPassword);
          accountBySocket.set(socket, session.account.id);
          metrics.inc("hexa_recovery_completed_total");
          send(socket, serverMessage("account.session", session, requestId));
          return;
        }
        if (command.type === "account.profile") {
          const account = await identity.authenticate(command.payload.accountId, command.payload.accessToken);
          accountBySocket.set(socket, account.id);
          send(socket, serverMessage("account.profile", await identity.getProfile(command.payload.accountId), requestId));
          return;
        }
        if (command.type === "account.history") {
          const account = await identity.authenticate(command.payload.accountId, command.payload.accessToken);
          accountBySocket.set(socket, account.id);
          send(socket, serverMessage("account.history", { matches: await identity.history(command.payload.accountId, command.payload.limit) }, requestId));
          return;
        }
        if (command.type === "leaderboard.list") {
          send(socket, serverMessage("leaderboard.data", { leaderboard: await identity.leaderboard(command.payload.limit) }, requestId));
          return;
        }
        if (command.type === "season.list") {
          send(socket, serverMessage("season.data", { current: await competition.currentSeason(), seasons: await competition.listSeasons() }, requestId));
          return;
        }
        if (command.type === "season.leaderboard") {
          send(socket, serverMessage("season.leaderboard", {
            seasonId: command.payload.seasonId ?? (await competition.currentSeason()).id,
            leaderboard: await competition.seasonLeaderboard(command.payload.limit, command.payload.seasonId),
          }, requestId));
          return;
        }
        if (command.type.startsWith("matchmaking.")) {
          const account = await identity.authenticate(command.payload.accountId, command.payload.accessToken);
          accountBySocket.set(socket, account.id);
          if (command.type === "matchmaking.enqueue") {
            await governance.assertEligible(account.id);
            const state = await competition.enqueue({ account, region: command.payload.region, boardSize: command.payload.boardSize });
            metrics.inc("hexa_matchmaking_enqueued_total", { state: state.state });
            send(socket, serverMessage("matchmaking.state", state, requestId));
            return;
          }
          if (command.type === "matchmaking.status") {
            send(socket, serverMessage("matchmaking.state", await competition.status(account.id), requestId));
            return;
          }
          if (command.type === "matchmaking.cancel") {
            send(socket, serverMessage("matchmaking.state", { state: "idle", ...(await competition.cancel(account.id)) }, requestId));
            return;
          }
          if (command.type === "matchmaking.accept") {
            const assignment = await competition.accept(account.id, command.payload.matchId);
            await claimMatch(socket, requestId, account, assignment);
            metrics.inc("hexa_matchmaking_accepted_total", { role: assignment.role });
            return;
          }
        }
        if (command.type === "telemetry.track") {
          let accountId = null;
          if (command.payload.accountId) {
            const account = await identity.authenticate(command.payload.accountId, command.payload.accessToken);
            accountId = account.id;
            accountBySocket.set(socket, account.id);
          }
          const result = await competition.recordTelemetry({
            accountId,
            sessionId: command.payload.sessionId,
            eventName: command.payload.eventName,
            payload: command.payload.data,
          });
          metrics.inc("hexa_telemetry_events_total", { event: command.payload.eventName });
          send(socket, serverMessage("telemetry.accepted", result, requestId));
          return;
        }
        if (command.type === "lobby.list") {
          send(socket, serverMessage("lobby.rooms", { rooms: await manager.listRooms({ status: command.payload.status }) }, requestId));
          return;
        }
        if (command.type === "room.create") {
          const { room, player, patch } = await manager.createRoom(await authenticatedRoomPayload(command.payload));
          await sendEstablishedSession(socket, requestId, room, player, patch);
          return;
        }
        if (command.type === "room.join") {
          const { room, player, patch } = await manager.joinRoom(await authenticatedRoomPayload(command.payload));
          await sendEstablishedSession(socket, requestId, room, player, patch);
          return;
        }
        if (command.type === "room.reconnect") {
          const result = await manager.reconnect(command.payload);
          await registerSocket(socket, result.room, result.player);
          send(socket, serverMessage("session.reconnected", {
            roomId: result.room.id,
            playerId: result.player.id,
            sessionToken: result.player.sessionToken,
            mode: result.mode,
            snapshot: result.snapshot,
            patches: result.patches,
            privateState: result.privateState,
            presence: publicPresence(await presence.listRoom(result.room.id)),
          }, requestId));
          if (result.connectionPatch) {
            await clusterRoomUpdate(result.room.id, [serverMessage("room.patch", result.connectionPatch)], { refreshPrivate: true });
          } else {
            await clusterRoomUpdate(result.room.id, [], { refreshPrivate: true });
          }
          await invalidateLobby();
          return;
        }

        const context = sessionBySocket.get(socket);
        if (!context) throw new ProtocolError("SESSION_REQUIRED", "establish or reconnect a room session before sending actions");
        if (context.roomId !== command.payload.roomId || context.playerId !== command.payload.playerId) {
          throw new ProtocolError("SESSION_MISMATCH", "command credentials do not match the socket session");
        }

        const { room, patch } = await manager.applyCommand(command);
        const messages = [serverMessage("room.patch", patch)];
        if (patch.event.type === "match.finished") {
          const progression = await identity.recordMatch(room.matchResult);
          if (progression.recorded) {
            await competition.recordSeasonMatch(room.matchResult, progression);
            metrics.inc("hexa_matches_completed_total", { reason: room.matchResult.reason });
            messages.unshift(serverMessage("match.progression", {
              ...progression,
              season: await competition.currentSeason(),
            }));
          }
        }
        send(socket, serverMessage("command.accepted", { roomId: room.id, revision: patch.revision }, requestId));
        await clusterRoomUpdate(room.id, messages, { refreshPrivate: true });
        if (room.status === "finished") await invalidateLobby();
      } catch (error) {
        metrics.inc("hexa_websocket_errors_total", { type: commandType, code: error.code ?? "INTERNAL_ERROR" });
        logger.warn("websocket command failed", { type: commandType, requestId, error });
        send(socket, errorMessage(error, requestId));
      } finally {
        metrics.observeDuration("hexa_websocket_message_duration", messageStartedAt, { type: commandType });
      }
    });

    socket.on("close", async () => {
      connectedSockets.delete(socket);
      metrics.inc("hexa_websocket_closed_total");
      const session = sessionBySocket.get(socket);
      if (!session) return;
      socketsByRoom.get(session.roomId)?.delete(socket);
      try {
        await presence.markOffline(session);
        await invalidatePresence(session.roomId);
        const remaining = await presence.listRoom(session.roomId);
        if (remaining.some((item) => item.playerId === session.playerId)) return;
        const result = await manager.disconnect(session.roomId, session.playerId);
        if (result) {
          await clusterRoomUpdate(session.roomId, [serverMessage("room.patch", result.patch)], { refreshPrivate: false });
          await invalidateLobby();
        }
      } catch (error) {
        logger.warn("disconnect persistence failed", { roomId: session.roomId, playerId: session.playerId, error });
      }
    });
  });

  const maintenanceTimer = setInterval(async () => {
    try {
      maintenanceCycles += 1;
      await presence.heartbeatInstance({ version: SERVER_VERSION, sockets: connectedSockets.size });
      for (const socket of connectedSockets) {
        const session = sessionBySocket.get(socket);
        if (session) await presence.heartbeatPlayer(session);
      }
      await presence.prune();
      const expired = await governance.expireAssignments();
      for (const item of expired) {
        metrics.inc("hexa_matchmaking_penalties_total", { kind: "match_accept_timeout" });
        await eventBus.publish("penalty.updated", {
          accountId: item.accountId,
          penalty: item.penalty ?? { kind: "match_accept_timeout", retryAt: item.retryAt },
        });
      }
      if (expired.length > 0) await invalidateLobby();
      if (maintenanceCycles % 240 === 0) await eventBus.prune();
    } catch (error) {
      logger.warn("cluster maintenance failed", { error, instanceId });
      metrics.inc("hexa_cluster_maintenance_errors_total");
    }
  }, HEARTBEAT_INTERVAL_MS);
  maintenanceTimer.unref?.();
  presence.heartbeatInstance({ version: SERVER_VERSION, sockets: 0 }).catch(() => {});

  httpServer.listen(port);
  return {
    httpServer,
    websocketServer,
    manager,
    identity,
    competition,
    governance,
    eventBus,
    presence,
    metrics,
    instanceId,
    close: () => new Promise((resolve, reject) => {
      clearInterval(maintenanceTimer);
      unsubscribeCluster();
      websocketServer.close(() => {
        httpServer.close(async (error) => {
          if (error) reject(error);
          else {
            await recoveryProvider.close?.();
            await presence.close?.();
            await eventBus.close?.();
            await governance.close?.();
            await manager.store?.close?.();
            await identity.close?.();
            await competition.close?.();
            resolve();
          }
        });
      });
    }),
  };
}
