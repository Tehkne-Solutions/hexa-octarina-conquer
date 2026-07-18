import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { WebSocket } from "ws";

import { startServer } from "../src/server.js";

function createInbox(socket) {
  const queue = [];
  const waiters = [];
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString("utf8"));
    const waiterIndex = waiters.findIndex((waiter) => waiter.type === message.type);
    if (waiterIndex >= 0) {
      const [waiter] = waiters.splice(waiterIndex, 1);
      waiter.resolve(message);
    } else {
      queue.push(message);
    }
  });
  return {
    next(type) {
      const index = queue.findIndex((message) => message.type === type);
      if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const pendingIndex = waiters.findIndex((waiter) => waiter.resolve === resolve);
          if (pendingIndex >= 0) waiters.splice(pendingIndex, 1);
          reject(new Error(`timeout waiting for ${type}`));
        }, 2_000);
        waiters.push({
          type,
          resolve: (message) => {
            clearTimeout(timer);
            resolve(message);
          },
        });
      });
    },
  };
}

function send(socket, type, payload, requestId) {
  socket.send(JSON.stringify({
    protocolVersion: "1.0",
    type,
    requestId,
    payload,
  }));
}

test("creates, joins and synchronizes a room over WebSocket", async () => {
  const instance = startServer({ port: 0 });
  await once(instance.httpServer, "listening");
  const address = instance.httpServer.address();
  const url = `ws://127.0.0.1:${address.port}/ws`;

  const firstSocket = new WebSocket(url);
  const firstInbox = createInbox(firstSocket);
  await once(firstSocket, "open");
  await firstInbox.next("server.hello");

  send(firstSocket, "room.create", { playerName: "A", boardSize: 3 }, "create-1");
  const firstSession = await firstInbox.next("session.established");
  await firstInbox.next("room.patch");

  const secondSocket = new WebSocket(url);
  const secondInbox = createInbox(secondSocket);
  await once(secondSocket, "open");
  await secondInbox.next("server.hello");
  send(secondSocket, "room.join", {
    roomId: firstSession.payload.roomId,
    playerName: "B",
  }, "join-1");

  const secondSession = await secondInbox.next("session.established");
  const firstJoinPatch = await firstInbox.next("room.patch");
  await secondInbox.next("room.patch");
  assert.equal(firstJoinPatch.payload.state.status, "active");

  send(firstSocket, "action.play_edge", {
    roomId: firstSession.payload.roomId,
    playerId: firstSession.payload.playerId,
    sessionToken: firstSession.payload.sessionToken,
    expectedRevision: firstJoinPatch.payload.revision,
    start: [0, 0],
    end: [1, 0],
  }, "edge-1");

  const accepted = await firstInbox.next("command.accepted");
  const firstEdgePatch = await firstInbox.next("room.patch");
  const secondEdgePatch = await secondInbox.next("room.patch");
  assert.equal(accepted.payload.revision, firstEdgePatch.payload.revision);
  assert.equal(secondEdgePatch.payload.state.board.edges.length, 1);
  assert.equal(secondEdgePatch.payload.state.board.currentPlayerId, secondSession.payload.playerId);

  firstSocket.close();
  secondSocket.close();
  await Promise.all([once(firstSocket, "close"), once(secondSocket, "close")]);
  await instance.close();
});
