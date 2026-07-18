import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { WebSocket } from "ws";

import { MemoryResilienceStore } from "../src/resilience-store.js";
import { startServer } from "../src/server.js";

function createInbox(socket) {
  const queue = [];
  const waiters = [];
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString("utf8"));
    const index = waiters.findIndex((waiter) => waiter.type === message.type);
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else queue.push(message);
  });
  return {
    next(type, timeoutMs = 4_000) {
      const index = queue.findIndex((message) => message.type === type);
      if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { type, resolve, timer: undefined };
        waiter.timer = setTimeout(() => {
          const pending = waiters.indexOf(waiter);
          if (pending >= 0) waiters.splice(pending, 1);
          reject(new Error(`timeout waiting for ${type}`));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
  };
}

function send(socket, type, payload, requestId) {
  socket.send(JSON.stringify({ protocolVersion: "1.0", type, payload, requestId }));
}

async function connect(url) {
  const socket = new WebSocket(url);
  const inbox = createInbox(socket);
  await once(socket, "open");
  return { socket, inbox };
}

async function closeSocket(socket) {
  if (!socket || socket.readyState === WebSocket.CLOSED) return;
  const closed = once(socket, "close");
  socket.close(1000, "test complete");
  await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 500))]);
  if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
}

test("spectators receive public patches and can retrieve replay history", { timeout: 15_000 }, async () => {
  const resilience = new MemoryResilienceStore();
  const instance = startServer({ port: 0, resilience });
  let first;
  let second;
  let spectator;
  try {
    await once(instance.httpServer, "listening");
    const port = instance.httpServer.address().port;
    first = await connect(`ws://127.0.0.1:${port}/ws`);
    second = await connect(`ws://127.0.0.1:${port}/ws`);
    await Promise.all([first.inbox.next("server.hello"), second.inbox.next("server.hello")]);

    send(first.socket, "room.create", { playerName: "Alpha", boardSize: 3 }, "create");
    const firstSession = await first.inbox.next("session.established");
    await first.inbox.next("room.patch");
    await first.inbox.next("player.private_state");

    send(second.socket, "room.join", { roomId: firstSession.payload.roomId, playerName: "Beta" }, "join");
    const secondSession = await second.inbox.next("session.established");
    const activePatch = await first.inbox.next("room.patch");
    await second.inbox.next("room.patch");
    await first.inbox.next("player.private_state");
    await second.inbox.next("player.private_state");

    spectator = await connect(`ws://127.0.0.1:${port}/spectator?roomId=${firstSession.payload.roomId}`);
    const hello = await spectator.inbox.next("server.hello");
    assert.equal(hello.payload.role, "spectator");
    const established = await spectator.inbox.next("spectator.established");
    assert.equal(established.payload.snapshot.status, "active");
    assert.equal(established.payload.replay.events.length, 2);
    assert.equal(JSON.stringify(established).includes("sessionToken"), false);

    send(first.socket, "action.play_edge", {
      roomId: firstSession.payload.roomId,
      playerId: firstSession.payload.playerId,
      sessionToken: firstSession.payload.sessionToken,
      expectedRevision: activePatch.payload.revision,
      start: [0, 0],
      end: [1, 0],
    }, "edge");
    await first.inbox.next("command.accepted");
    const spectatorPatch = await spectator.inbox.next("room.patch");
    assert.equal(spectatorPatch.payload.state.board.edges.length, 1);
    assert.equal(spectatorPatch.payload.state.board.currentPlayerId, secondSession.payload.playerId);

    const response = await fetch(`http://127.0.0.1:${port}/replays/${firstSession.payload.roomId}`);
    const replay = await response.json();
    assert.equal(response.status, 200);
    assert.equal(replay.latestRevision, spectatorPatch.payload.revision);
    assert.equal(replay.events.at(-1).eventType, "edge.played");
  } finally {
    await Promise.allSettled([closeSocket(first?.socket), closeSocket(second?.socket), closeSocket(spectator?.socket)]);
    await instance.close();
  }
});

test("disconnect starts a grace lease and reconnect cancels it", { timeout: 15_000 }, async () => {
  const resilience = new MemoryResilienceStore({ reconnectGraceMs: 5_000 });
  const instance = startServer({ port: 0, resilience });
  let first;
  let second;
  let reconnected;
  try {
    await once(instance.httpServer, "listening");
    const port = instance.httpServer.address().port;
    first = await connect(`ws://127.0.0.1:${port}/ws`);
    second = await connect(`ws://127.0.0.1:${port}/ws`);
    await Promise.all([first.inbox.next("server.hello"), second.inbox.next("server.hello")]);

    send(first.socket, "room.create", { playerName: "Alpha", boardSize: 3 }, "create");
    const firstSession = await first.inbox.next("session.established");
    await first.inbox.next("room.patch");
    await first.inbox.next("player.private_state");

    send(second.socket, "room.join", { roomId: firstSession.payload.roomId, playerName: "Beta" }, "join");
    await second.inbox.next("session.established");
    const activePatch = await first.inbox.next("room.patch");
    await second.inbox.next("room.patch");
    await first.inbox.next("player.private_state");
    await second.inbox.next("player.private_state");

    await closeSocket(first.socket);
    const grace = await second.inbox.next("player.reconnect_grace");
    assert.equal(grace.payload.playerId, firstSession.payload.playerId);
    assert.equal((await resilience.listDisconnects(firstSession.payload.roomId)).length, 1);

    reconnected = await connect(`ws://127.0.0.1:${port}/ws`);
    await reconnected.inbox.next("server.hello");
    send(reconnected.socket, "room.reconnect", {
      roomId: firstSession.payload.roomId,
      playerId: firstSession.payload.playerId,
      sessionToken: firstSession.payload.sessionToken,
      lastRevision: activePatch.payload.revision,
    }, "reconnect");
    const session = await reconnected.inbox.next("session.reconnected");
    assert.equal(session.payload.roomId, firstSession.payload.roomId);
    const restored = await second.inbox.next("player.reconnect_restored");
    assert.equal(restored.payload.playerId, firstSession.payload.playerId);
    assert.equal((await resilience.listDisconnects(firstSession.payload.roomId)).length, 0);
  } finally {
    await Promise.allSettled([closeSocket(first?.socket), closeSocket(second?.socket), closeSocket(reconnected?.socket)]);
    await instance.close();
  }
});
