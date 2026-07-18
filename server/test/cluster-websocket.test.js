import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import test from "node:test";

import { WebSocket } from "ws";

import { MemoryClusterBus } from "../src/cluster-bus.js";
import { MemoryPresenceStore } from "../src/presence-store.js";
import { RoomManager } from "../src/room-manager.js";
import { MemoryRoomStore } from "../src/room-store.js";
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
    next(type, timeoutMs = 3_000) {
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
  socket.send(JSON.stringify({ protocolVersion: "1.0", type, requestId, payload }));
}

async function connect(instance) {
  await once(instance.httpServer, "listening");
  const address = instance.httpServer.address();
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
  const inbox = createInbox(socket);
  await Promise.race([
    once(socket, "open"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("socket open timed out")), 2_000)),
  ]);
  await inbox.next("server.hello");
  return { socket, inbox };
}

async function closeSocket(socket) {
  if (!socket || socket.readyState === WebSocket.CLOSED) return;
  const closed = once(socket, "close");
  socket.close(1000, "test complete");
  await Promise.race([
    closed,
    new Promise((resolve) => setTimeout(() => {
      socket.terminate();
      resolve();
    }, 300)),
  ]);
}

async function closeInstance(instance) {
  for (const client of instance.websocketServer.clients) client.terminate();
  await Promise.race([
    instance.close(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("server shutdown timed out")), 2_000)),
  ]);
}

test("two replicas synchronize room patches, private state and presence", { timeout: 12_000 }, async () => {
  const emitter = new EventEmitter();
  const manager = new RoomManager({ store: new MemoryRoomStore() });
  const presence = new MemoryPresenceStore({ instanceId: "shared-memory-presence" });
  presence.close = async () => {};
  const first = startServer({
    port: 0,
    manager,
    eventBus: new MemoryClusterBus({ emitter, instanceId: "replica-a" }),
    presence,
  });
  const second = startServer({
    port: 0,
    manager,
    eventBus: new MemoryClusterBus({ emitter, instanceId: "replica-b" }),
    presence,
  });
  let firstClient;
  let secondClient;

  try {
    firstClient = await connect(first);
    secondClient = await connect(second);

    send(firstClient.socket, "room.create", { playerName: "Alpha", boardSize: 3 }, "create");
    const firstSession = await firstClient.inbox.next("session.established");
    await firstClient.inbox.next("room.patch");
    await firstClient.inbox.next("player.private_state");

    send(secondClient.socket, "room.join", {
      roomId: firstSession.payload.roomId,
      playerName: "Beta",
    }, "join");
    const secondSession = await secondClient.inbox.next("session.established");
    const firstJoinPatch = await firstClient.inbox.next("room.patch");
    await secondClient.inbox.next("room.patch");
    await firstClient.inbox.next("player.private_state");
    await secondClient.inbox.next("player.private_state");

    let presenceUpdate;
    do {
      presenceUpdate = await firstClient.inbox.next("presence.updated");
    } while (presenceUpdate.payload.players.length < 2);
    assert.equal(presenceUpdate.payload.players.length, 2);

    send(firstClient.socket, "action.play_edge", {
      roomId: firstSession.payload.roomId,
      playerId: firstSession.payload.playerId,
      sessionToken: firstSession.payload.sessionToken,
      expectedRevision: firstJoinPatch.payload.revision,
      start: [0, 0],
      end: [1, 0],
    }, "edge");

    await firstClient.inbox.next("command.accepted");
    const remotePatch = await secondClient.inbox.next("room.patch");
    assert.equal(remotePatch.payload.state.board.edges.length, 1);
    assert.equal(remotePatch.payload.state.board.currentPlayerId, secondSession.payload.playerId);
    assert.equal((await secondClient.inbox.next("player.private_state")).payload.playerId, secondSession.payload.playerId);
  } finally {
    await Promise.allSettled([closeSocket(firstClient?.socket), closeSocket(secondClient?.socket)]);
    await Promise.allSettled([closeInstance(first), closeInstance(second)]);
  }
});
