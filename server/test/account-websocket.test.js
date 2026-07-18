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
    const index = waiters.findIndex((waiter) => waiter.type === message.type);
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else queue.push(message);
  });
  return {
    next(type) {
      const index = queue.findIndex((message) => message.type === type);
      if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { type, resolve, timer: null };
        waiter.timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), 3_000);
        waiters.push(waiter);
      });
    },
  };
}

function send(socket, type, payload, requestId) {
  socket.send(JSON.stringify({ protocolVersion: "1.0", type, requestId, payload }));
}

async function connect(url) {
  const socket = new WebSocket(url);
  const inbox = createInbox(socket);
  await once(socket, "open");
  await inbox.next("server.hello");
  return { socket, inbox };
}

async function closeSocket(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  const closed = once(socket, "close");
  socket.close();
  await closed;
}

test("registered accounts earn XP and rating after an authoritative forfeit", async () => {
  const instance = startServer({ port: 0 });
  let first;
  let second;
  try {
    await once(instance.httpServer, "listening");
    const url = `ws://127.0.0.1:${instance.httpServer.address().port}/ws`;
    first = await connect(url);
    second = await connect(url);

    send(first.socket, "account.register", {
      handle: "winner_ws",
      displayName: "Vencedor",
      password: "senha-websocket-1",
    }, "register-a");
    const firstAccount = await first.inbox.next("account.session");

    send(second.socket, "account.register", {
      handle: "loser_ws",
      displayName: "Desafiante",
      password: "senha-websocket-2",
    }, "register-b");
    const secondAccount = await second.inbox.next("account.session");

    send(first.socket, "room.create", {
      accountId: firstAccount.payload.account.id,
      accessToken: firstAccount.payload.accessToken,
      boardSize: 3,
    }, "create");
    const firstSession = await first.inbox.next("session.established");
    await first.inbox.next("room.patch");
    await first.inbox.next("player.private_state");

    send(second.socket, "room.join", {
      roomId: firstSession.payload.roomId,
      accountId: secondAccount.payload.account.id,
      accessToken: secondAccount.payload.accessToken,
    }, "join");
    const secondSession = await second.inbox.next("session.established");
    const activePatch = await first.inbox.next("room.patch");
    await second.inbox.next("room.patch");

    send(second.socket, "match.forfeit", {
      roomId: firstSession.payload.roomId,
      playerId: secondSession.payload.playerId,
      sessionToken: secondSession.payload.sessionToken,
      expectedRevision: activePatch.payload.revision,
    }, "forfeit");

    const progression = await first.inbox.next("match.progression");
    const finished = await first.inbox.next("room.patch");
    assert.equal(progression.payload.recorded, true);
    assert.equal(finished.payload.state.status, "finished");
    assert.equal(progression.payload.winner.wins, 1);

    send(first.socket, "leaderboard.list", { limit: 10 }, "ranking");
    const leaderboard = await first.inbox.next("leaderboard.data");
    assert.equal(leaderboard.payload.leaderboard[0].handle, "winner_ws");

    send(first.socket, "account.history", {
      accountId: firstAccount.payload.account.id,
      accessToken: firstAccount.payload.accessToken,
      limit: 10,
    }, "history");
    const history = await first.inbox.next("account.history");
    assert.equal(history.payload.matches[0].reason, "forfeit");
  } finally {
    await Promise.allSettled([first && closeSocket(first.socket), second && closeSocket(second.socket)]);
    await instance.close();
  }
});
