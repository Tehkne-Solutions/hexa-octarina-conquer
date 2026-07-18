import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { MemoryIdentityStore } from "../src/identity-memory.js";
import { createLogger } from "../src/logger.js";
import { MetricsRegistry } from "../src/metrics.js";
import { startServer } from "../src/server.js";


test("health, leaderboard and Prometheus metrics expose operational state", async () => {
  const identity = new MemoryIdentityStore();
  await identity.register({ handle: "metricas", displayName: "Métricas", password: "senha-metricas" });
  const metrics = new MetricsRegistry();
  const instance = startServer({ port: 0, identity, metrics });
  try {
    await once(instance.httpServer, "listening");
    const port = instance.httpServer.address().port;

    const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.identityStore, "memory");
    assert.equal(health.signature, "Tehkné Solutions");

    const leaderboard = await fetch(`http://127.0.0.1:${port}/leaderboard`).then((response) => response.json());
    assert.equal(leaderboard.leaderboard[0].handle, "metricas");

    const rendered = await fetch(`http://127.0.0.1:${port}/metrics`).then((response) => response.text());
    assert.match(rendered, /hexa_http_requests_total/);
    assert.match(rendered, /hexa_rooms 0/);
  } finally {
    await instance.close();
  }
});

test("structured logger emits JSON with Tehkné signature", () => {
  const lines = [];
  const logger = createLogger({
    output: {
      log: (line) => lines.push(line),
      warn: (line) => lines.push(line),
      error: (line) => lines.push(line),
    },
  });
  logger.info("test message", { roomId: "ROOM" });
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.message, "test message");
  assert.equal(entry.roomId, "ROOM");
  assert.equal(entry.signature, "Tehkné Solutions");
});
