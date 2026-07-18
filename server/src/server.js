import { createServer } from "node:http";

import { WebSocket, WebSocketServer } from "ws";

import { ProtocolError, errorMessage, parseClientMessage, serverMessage } from "./protocol.js";
import { RoomManager } from "./room-manager.js";

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function startServer({ port = 8080, manager = new RoomManager() } = {}) {
  const httpServer = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, rooms: manager.rooms.size }));
      return;
    }
    if (request.url === "/rooms") {
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      });
      response.end(JSON.stringify({ rooms: manager.listRooms() }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "not_found" }));
  });

  const websocketServer = new WebSocketServer({ server: httpServer, path: "/ws" });
  const sessionBySocket = new WeakMap();
  const socketsByRoom = new Map();
  const connectedSockets = new Set();

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

  function broadcastLobby() {
    const message = serverMessage("lobby.updated", { rooms: manager.listRooms() });
    for (const socket of connectedSockets) send(socket, message);
  }

  websocketServer.on("connection", (socket) => {
    connectedSockets.add(socket);
    send(socket, serverMessage("server.hello", {
      transport: "websocket",
      commands: [
        "lobby.list",
        "room.create",
        "room.join",
        "room.reconnect",
        "action.play_edge",
        "action.play_card",
        "action.resolve_duel_round",
      ],
    }));

    socket.on("message", (raw) => {
      let requestId;
      try {
        const command = parseClientMessage(raw);
        requestId = command.requestId;

        if (command.type === "ping") {
          send(socket, serverMessage("pong", { at: Date.now() }, requestId));
          return;
        }

        if (command.type === "lobby.list") {
          send(socket, serverMessage("lobby.rooms", {
            rooms: manager.listRooms({ status: command.payload.status }),
          }, requestId));
          return;
        }

        if (command.type === "room.create") {
          const { room, player, patch } = manager.createRoom(command.payload);
          registerSocket(socket, room.id, player.id);
          send(socket, serverMessage("session.established", {
            roomId: room.id,
            playerId: player.id,
            sessionToken: player.sessionToken,
            snapshot: room.snapshot(),
          }, requestId));
          broadcast(room.id, serverMessage("room.patch", patch));
          broadcastLobby();
          return;
        }

        if (command.type === "room.join") {
          const { room, player, patch } = manager.joinRoom(command.payload);
          registerSocket(socket, room.id, player.id);
          send(socket, serverMessage("session.established", {
            roomId: room.id,
            playerId: player.id,
            sessionToken: player.sessionToken,
            snapshot: room.snapshot(),
          }, requestId));
          broadcast(room.id, serverMessage("room.patch", patch));
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
          }, requestId));
          broadcastLobby();
          return;
        }

        const context = sessionBySocket.get(socket);
        if (!context) {
          throw new ProtocolError("SESSION_REQUIRED", "establish or reconnect a room session before sending actions");
        }
        if (context.roomId !== command.payload.roomId || context.playerId !== command.payload.playerId) {
          throw new ProtocolError("SESSION_MISMATCH", "command credentials do not match the socket session");
        }

        const { room, patch } = manager.applyCommand(command);
        send(socket, serverMessage("command.accepted", {
          roomId: room.id,
          revision: patch.revision,
        }, requestId));
        broadcast(room.id, serverMessage("room.patch", patch));
      } catch (error) {
        send(socket, errorMessage(error, requestId));
      }
    });

    socket.on("close", () => {
      connectedSockets.delete(socket);
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
    close: () => new Promise((resolve, reject) => {
      websocketServer.close(() => {
        httpServer.close((error) => error ? reject(error) : resolve());
      });
    }),
  };
}
