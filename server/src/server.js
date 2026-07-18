import { createServer } from "node:http";

import { WebSocket, WebSocketServer } from "ws";

import { MemoryIdentityStore } from "./identity-memory.js";
import { createLogger } from "./logger.js";
import { MetricsRegistry } from "./metrics.js";
import { ProtocolError, errorMessage, parseClientMessage, serverMessage } from "./protocol.js";
import { RoomManager } from "./room-manager.js";

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

export function startServer({
  port = 8080,
  manager = new RoomManager(),
  identity = new MemoryIdentityStore(),
  metrics = new MetricsRegistry(),
  logger = createLogger(),
} = {}) {
  const startedAt = Date.now();
  const connectedSockets = new Set();

  const httpServer = createServer(async (request, response) => {
    const requestStartedAt = Date.now();
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (url.pathname === "/health") {
        json(response, 200, {
          ok: true,
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
          rooms: manager.rooms.size,
          roomStore: manager.store?.kind ?? "memory",
          identityStore: identity.kind ?? "memory",
          version: "0.4.0",
          signature: "Tehkné Solutions",
        });
        return;
      }
      if (url.pathname === "/rooms") {
        json(response, 200, { rooms: manager.listRooms() });
        return;
      }
      if (url.pathname === "/leaderboard") {
        const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25));
        json(response, 200, { leaderboard: await identity.leaderboard(limit) });
        return;
      }
      if (url.pathname === "/metrics") {
        response.writeHead(200, { "content-type": "text/plain; version=0.0.4; charset=utf-8", "cache-control": "no-store" });
        response.end(metrics.render({ roomCount: manager.rooms.size, socketCount: connectedSockets.size }));
        return;
      }
      json(response, 404, { ok: false, error: "not_found" });
    } catch (error) {
      metrics.inc("hexa_http_errors_total", { path: url.pathname });
      logger.error("http request failed", { path: url.pathname, error });
      json(response, 500, { ok: false, error: "internal_error" });
    } finally {
      metrics.inc("hexa_http_requests_total", { method: request.method ?? "GET", path: url.pathname });
      metrics.observeDuration("hexa_http_request_duration", requestStartedAt, { path: url.pathname });
    }
  });

  const websocketServer = new WebSocketServer({ server: httpServer, path: "/ws" });
  const sessionBySocket = new WeakMap();
  const socketsByRoom = new Map();

  function registerSocket(socket, roomId, playerId) {
    const previous = sessionBySocket.get(socket);
    if (previous) socketsByRoom.get(previous.roomId)?.delete(socket);
    sessionBySocket.set(socket, { roomId, playerId });
    if (!socketsByRoom.has(roomId)) socketsByRoom.set(roomId, new Set());
    socketsByRoom.get(roomId).add(socket);
  }

  function broadcast(roomId, message) {
    for (const socket of socketsByRoom.get(roomId) ?? []) send(socket, message);
  }

  function broadcastExcept(roomId, message, excludedSocket) {
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

  function broadcastLobby() {
    const message = serverMessage("lobby.updated", { rooms: manager.listRooms() });
    for (const socket of connectedSockets) send(socket, message);
  }

  async function authenticatedRoomPayload(payload) {
    if (!payload.accountId) return { ...payload, accountId: null, playerName: payload.playerName };
    const account = await identity.authenticate(payload.accountId, payload.accessToken);
    return { ...payload, accountId: account.id, playerName: account.displayName };
  }

  websocketServer.on("connection", (socket, request) => {
    connectedSockets.add(socket);
    metrics.inc("hexa_websocket_opened_total");
    logger.info("websocket connected", { remoteAddress: request.socket.remoteAddress });
    send(socket, serverMessage("server.hello", {
      transport: "websocket",
      commands: [
        "account.register", "account.login", "account.profile", "account.history",
        "leaderboard.list", "lobby.list",
        "room.create", "room.join", "room.reconnect",
        "action.play_edge", "action.play_card", "action.resolve_duel_round", "match.forfeit",
      ],
      privateEvents: ["player.private_state", "account.session", "account.profile", "account.history"],
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

        if (command.type === "ping") {
          send(socket, serverMessage("pong", { at: Date.now() }, requestId));
          return;
        }
        if (command.type === "account.register") {
          const session = await identity.register(command.payload);
          metrics.inc("hexa_accounts_registered_total");
          send(socket, serverMessage("account.session", session, requestId));
          return;
        }
        if (command.type === "account.login") {
          const session = await identity.login(command.payload);
          metrics.inc("hexa_account_logins_total");
          send(socket, serverMessage("account.session", session, requestId));
          return;
        }
        if (command.type === "account.profile") {
          await identity.authenticate(command.payload.accountId, command.payload.accessToken);
          send(socket, serverMessage("account.profile", await identity.getProfile(command.payload.accountId), requestId));
          return;
        }
        if (command.type === "account.history") {
          await identity.authenticate(command.payload.accountId, command.payload.accessToken);
          send(socket, serverMessage("account.history", {
            matches: await identity.history(command.payload.accountId, command.payload.limit),
          }, requestId));
          return;
        }
        if (command.type === "leaderboard.list") {
          send(socket, serverMessage("leaderboard.data", {
            leaderboard: await identity.leaderboard(command.payload.limit),
          }, requestId));
          return;
        }
        if (command.type === "lobby.list") {
          send(socket, serverMessage("lobby.rooms", { rooms: manager.listRooms({ status: command.payload.status }) }, requestId));
          return;
        }

        if (command.type === "room.create") {
          const { room, player, patch } = manager.createRoom(await authenticatedRoomPayload(command.payload));
          registerSocket(socket, room.id, player.id);
          send(socket, serverMessage("session.established", {
            roomId: room.id,
            playerId: player.id,
            sessionToken: player.sessionToken,
            snapshot: room.snapshot(),
            privateState: room.privateStateFor(player.id),
          }, requestId));
          broadcast(room.id, serverMessage("room.patch", patch));
          broadcastPrivateStates(room);
          broadcastLobby();
          return;
        }

        if (command.type === "room.join") {
          const { room, player, patch } = manager.joinRoom(await authenticatedRoomPayload(command.payload));
          registerSocket(socket, room.id, player.id);
          send(socket, serverMessage("session.established", {
            roomId: room.id,
            playerId: player.id,
            sessionToken: player.sessionToken,
            snapshot: room.snapshot(),
            privateState: room.privateStateFor(player.id),
          }, requestId));
          broadcast(room.id, serverMessage("room.patch", patch));
          broadcastPrivateStates(room);
          broadcastLobby();
          return;
        }

        if (command.type === "room.reconnect") {
          const result = manager.reconnect(command.payload);
          registerSocket(socket, result.room.id, result.player.id);
          send(socket, serverMessage("session.reconnected", {
            roomId: result.room.id,
            playerId: result.player.id,
            sessionToken: result.player.sessionToken,
            mode: result.mode,
            snapshot: result.snapshot,
            patches: result.patches,
            privateState: result.privateState,
          }, requestId));
          if (result.connectionPatch) broadcastExcept(result.room.id, serverMessage("room.patch", result.connectionPatch), socket);
          broadcastPrivateStates(result.room);
          broadcastLobby();
          return;
        }

        const context = sessionBySocket.get(socket);
        if (!context) throw new ProtocolError("SESSION_REQUIRED", "establish or reconnect a room session before sending actions");
        if (context.roomId !== command.payload.roomId || context.playerId !== command.payload.playerId) {
          throw new ProtocolError("SESSION_MISMATCH", "command credentials do not match the socket session");
        }

        const { room, patch } = manager.applyCommand(command);
        let progression;
        if (patch.event.type === "match.finished") {
          progression = await identity.recordMatch(room.matchResult);
          if (progression.recorded) {
            metrics.inc("hexa_matches_completed_total", { reason: room.matchResult.reason });
            broadcast(room.id, serverMessage("match.progression", progression));
          }
        }
        send(socket, serverMessage("command.accepted", { roomId: room.id, revision: patch.revision }, requestId));
        broadcast(room.id, serverMessage("room.patch", patch));
        broadcastPrivateStates(room);
        if (room.status === "finished") broadcastLobby();
      } catch (error) {
        metrics.inc("hexa_websocket_errors_total", { type: commandType, code: error.code ?? "INTERNAL_ERROR" });
        logger.warn("websocket command failed", { type: commandType, requestId, error });
        send(socket, errorMessage(error, requestId));
      } finally {
        metrics.observeDuration("hexa_websocket_message_duration", messageStartedAt, { type: commandType });
      }
    });

    socket.on("close", () => {
      connectedSockets.delete(socket);
      metrics.inc("hexa_websocket_closed_total");
      const session = sessionBySocket.get(socket);
      if (!session) return;
      socketsByRoom.get(session.roomId)?.delete(socket);
      const result = manager.disconnect(session.roomId, session.playerId);
      if (result) {
        broadcast(session.roomId, serverMessage("room.patch", result.patch));
        broadcastLobby();
      }
    });
  });

  httpServer.listen(port);
  return {
    httpServer,
    websocketServer,
    manager,
    identity,
    metrics,
    close: () => new Promise((resolve, reject) => {
      websocketServer.close(() => {
        httpServer.close(async (error) => {
          if (error) reject(error);
          else {
            await manager.store?.close?.();
            await identity.close?.();
            resolve();
          }
        });
      });
    }),
  };
}
