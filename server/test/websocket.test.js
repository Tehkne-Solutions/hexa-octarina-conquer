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
      clearTimeout(waiter.timer);
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
        const waiter = { type, resolve, timer: undefined };
        waiter.timer = setTimeout(() => {
          const pendingIndex = waiters.indexOf(waiter);
          if (pendingIndex >= 0) waiters.splice(pendingIndex, 1);
          reject(new Error(`timeout waiting for ${type}`));
        }, 2_000);
        waiters.push(waiter);
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

async function closeSocket(socket) {
  if (!socket || socket.readyState === WebSocket.CLOSED) return;
  const closed = once(socket, "close");
  socket.close();
  await closed;
}

test("creates, joins and synchronizes public and private state over WebSocket", async () => {
  const instance = startServer({ port: 0 });
  let firstSocket;
  let secondSocket;

  try {
    await once(instance.httpServer, "listening");
    const address = instance.httpServer.address();
    const url = `ws://127.0.0.1:${address.port}/ws`;

    firstSocket = new WebSocket(url);
    const firstInbox = createInbox(firstSocket);
    await once(firstSocket, "open");
    await firstInbox.next("server.hello");

    send(firstSocket, "room.create", { playerName: "A", boardSize: 3 }, "create-1");
    const firstSession = await firstInbox.next("session.established");
    assert.equal(firstSession.payload.privateState.hand.length, 8);
    assert.equal(firstSession.payload.privateState.hand[0].name, "Expansão Rúnica");
    const firstCreatedPatch = await firstInbox.next("room.patch");
    assert.equal(JSON.stringify(firstCreatedPatch).includes("Raio Encadeado"), false);
    await firstInbox.next("player.private_state");

    secondSocket = new WebSocket(url);
    const secondInbox = createInbox(secondSocket);
    await once(secondSocket, "open");
    await secondInbox.next("server.hello");
    send(secondSocket, "room.join", {
      roomId: firstSession.payload.roomId,
      playerName: "B",
    }, "join-1");

    const secondSession = await secondInbox.next("session.established");
    assert.equal(secondSession.payload.privateState.playerId, secondSession.payload.playerId);
    const firstJoinPatch = await firstInbox.next("room.patch");
    await secondInbox.next("room.patch");
    await firstInbox.next("player.private_state");
    await secondInbox.next("player.private_state");
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
    const firstPrivate = await firstInbox.next("player.private_state");
    const secondPrivate = await secondInbox.next("player.private_state");
    assert.equal(accepted.payload.revision, firstEdgePatch.payload.revision);
    assert.equal(secondEdgePatch.payload.state.board.edges.length, 1);
    assert.equal(secondEdgePatch.payload.state.board.currentPlayerId, secondSession.payload.playerId);
    assert.equal(firstPrivate.payload.playerId, firstSession.payload.playerId);
    assert.equal(secondPrivate.payload.playerId, secondSession.payload.playerId);
  } finally {
    await Promise.allSettled([closeSocket(firstSocket), closeSocket(secondSocket)]);
    await instance.close();
  }
});

test("publishes a safe lobby over WebSocket and HTTP", async () => {
  const instance = startServer({ port: 0 });
  let socket;

  try {
    await once(instance.httpServer, "listening");
    const address = instance.httpServer.address();
    const wsUrl = `ws://127.0.0.1:${address.port}/ws`;
    const httpUrl = `http://127.0.0.1:${address.port}/rooms`;

    socket = new WebSocket(wsUrl);
    const inbox = createInbox(socket);
    await once(socket, "open");
    await inbox.next("server.hello");

    send(socket, "lobby.list", {}, "lobby-empty");
    const emptyLobby = await inbox.next("lobby.rooms");
    assert.deepEqual(emptyLobby.payload.rooms, []);

    send(socket, "room.create", { playerName: "A", boardSize: 5 }, "create-lobby");
    await inbox.next("session.established");
    await inbox.next("room.patch");
    await inbox.next("player.private_state");
    const lobbyUpdate = await inbox.next("lobby.updated");
    assert.equal(lobbyUpdate.payload.rooms.length, 1);
    assert.equal(JSON.stringify(lobbyUpdate).includes("sessionToken"), false);

    const response = await fetch(httpUrl);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.rooms.length, 1);
    assert.equal(JSON.stringify(body).includes("sessionToken"), false);
  } finally {
    await closeSocket(socket);
    await instance.close();
  }
});
