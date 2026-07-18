import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { WebSocket } from "ws";

import { startServer } from "../src/server.js";

function inbox(socket) {
  const messages = [];
  const waiters = [];
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString("utf8"));
    const index = waiters.findIndex((waiter) => waiter.type === message.type);
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else messages.push(message);
  });
  return {
    next(type) {
      const index = messages.findIndex((message) => message.type === type);
      if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { type, resolve, timer: undefined };
        waiter.timer = setTimeout(() => {
          const pending = waiters.indexOf(waiter);
          if (pending >= 0) waiters.splice(pending, 1);
          reject(new Error(`timeout waiting for ${type}`));
        }, 3_000);
        waiters.push(waiter);
      });
    },
  };
}

function send(socket, type, payload, requestId) {
  socket.send(JSON.stringify({ protocolVersion: "1.0", type, payload, requestId }));
}

async function closeSocket(socket) {
  if (!socket || socket.readyState === WebSocket.CLOSED) return;
  const closed = once(socket, "close");
  socket.close();
  await closed;
}

test("matches authenticated accounts and claims one shared room", async () => {
  const instance = startServer({ port: 0 });
  let hostSocket;
  let guestSocket;
  try {
    await once(instance.httpServer, "listening");
    const port = instance.httpServer.address().port;
    hostSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    guestSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const hostInbox = inbox(hostSocket);
    const guestInbox = inbox(guestSocket);
    await Promise.all([once(hostSocket, "open"), once(guestSocket, "open")]);
    await Promise.all([hostInbox.next("server.hello"), guestInbox.next("server.hello")]);

    send(hostSocket, "account.register", { handle: "host_09", displayName: "Host 09", password: "password-host" }, "register-host");
    send(guestSocket, "account.register", { handle: "guest_09", displayName: "Guest 09", password: "password-guest" }, "register-guest");
    const hostAccount = (await hostInbox.next("account.session")).payload;
    const guestAccount = (await guestInbox.next("account.session")).payload;

    send(hostSocket, "matchmaking.enqueue", {
      accountId: hostAccount.account.id,
      accessToken: hostAccount.accessToken,
      region: "br",
      boardSize: 3,
    }, "queue-host");
    assert.equal((await hostInbox.next("matchmaking.state")).payload.state, "queued");

    send(guestSocket, "matchmaking.enqueue", {
      accountId: guestAccount.account.id,
      accessToken: guestAccount.accessToken,
      region: "br",
      boardSize: 3,
    }, "queue-guest");
    const guestMatch = (await guestInbox.next("matchmaking.state")).payload;
    assert.equal(guestMatch.state, "matched");

    send(hostSocket, "matchmaking.status", {
      accountId: hostAccount.account.id,
      accessToken: hostAccount.accessToken,
    }, "status-host");
    const hostMatch = (await hostInbox.next("matchmaking.state")).payload;
    assert.equal(hostMatch.role, "host");
    assert.equal(hostMatch.match.id, guestMatch.match.id);

    send(hostSocket, "matchmaking.accept", {
      accountId: hostAccount.account.id,
      accessToken: hostAccount.accessToken,
      matchId: hostMatch.match.id,
    }, "accept-host");
    const hostSession = (await hostInbox.next("session.established")).payload;
    await hostInbox.next("room.patch");
    await hostInbox.next("player.private_state");

    send(guestSocket, "matchmaking.accept", {
      accountId: guestAccount.account.id,
      accessToken: guestAccount.accessToken,
      matchId: guestMatch.match.id,
    }, "accept-guest");
    const guestSession = (await guestInbox.next("session.established")).payload;
    assert.equal(guestSession.roomId, hostSession.roomId);
    assert.equal(guestSession.snapshot.status, "active");

    send(hostSocket, "season.list", {}, "seasons");
    const seasons = (await hostInbox.next("season.data")).payload;
    assert.equal(seasons.current.status, "active");

    send(hostSocket, "telemetry.track", {
      accountId: hostAccount.account.id,
      accessToken: hostAccount.accessToken,
      sessionId: "android-session",
      eventName: "mobile.matchmaking.claimed",
      data: { roomId: hostSession.roomId },
    }, "telemetry");
    assert.equal((await hostInbox.next("telemetry.accepted")).payload.accepted, true);
  } finally {
    await Promise.allSettled([closeSocket(hostSocket), closeSocket(guestSocket)]);
    await instance.close();
  }
});

test("requests and confirms password recovery over WebSocket", async () => {
  const instance = startServer({ port: 0 });
  let socket;
  try {
    await once(instance.httpServer, "listening");
    const port = instance.httpServer.address().port;
    socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages = inbox(socket);
    await once(socket, "open");
    await messages.next("server.hello");

    send(socket, "account.register", { handle: "recover_09", displayName: "Recover 09", password: "password-old" }, "register");
    await messages.next("account.session");
    send(socket, "account.recovery.request", { handle: "recover_09" }, "recover-request");
    const challenge = (await messages.next("account.recovery.requested")).payload;
    assert.ok(challenge.recoveryCode);

    send(socket, "account.recovery.confirm", {
      handle: "recover_09",
      recoveryCode: challenge.recoveryCode,
      newPassword: "password-new",
    }, "recover-confirm");
    const recovered = (await messages.next("account.session")).payload;
    assert.equal(recovered.account.handle, "recover_09");
  } finally {
    await closeSocket(socket);
    await instance.close();
  }
});
