import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import {
  ExperienceTelemetryRegistry,
  sanitizeExperienceEvent,
} from "../src/experience-telemetry.js";
import { startServer } from "../src/server.js";

test("sanitizes operational telemetry without accepting personal fields", () => {
  const event = sanitizeExperienceEvent({
    event: "screen_view",
    screen: "home",
    device: "mobile",
    realm: "online",
    release: "0.12.0+abc123",
    value: "opened",
    accountId: "must-not-survive",
    email: "must-not-survive@example.com",
    url: "https://example.com/private/path",
  }, 1_000);

  assert.deepEqual(event, {
    event: "screen_view",
    screen: "home",
    device: "mobile",
    realm: "online",
    release: "0.12.0-abc123",
    value: "opened",
    durationMs: null,
    occurredAt: 1_000,
  });
  assert.equal("accountId" in event, false);
  assert.equal("email" in event, false);
  assert.equal("url" in event, false);
});

test("rejects unknown events and bounds duration values", () => {
  assert.equal(sanitizeExperienceEvent({ event: "player_secret" }), null);
  const event = sanitizeExperienceEvent({ event: "performance", durationMs: 9_999_999 }, 5_000);
  assert.equal(event.durationMs, 3_600_000);
});

test("aggregates low-cardinality experience groups", () => {
  let now = 10_000;
  const registry = new ExperienceTelemetryRegistry({ clock: () => now });
  registry.record({ event: "screen_view", screen: "home", device: "desktop", realm: "online", release: "0.12.0" });
  now += 20;
  registry.record({ event: "screen_view", screen: "home", device: "desktop", realm: "online", release: "0.12.0" });
  registry.record({ event: "performance", screen: "home", device: "desktop", realm: "online", release: "0.12.0", value: "load", durationMs: 800 });

  const summary = registry.summary();
  assert.equal(summary.total, 3);
  assert.equal(summary.rejected, 0);
  assert.equal(summary.groups[0].count, 2);
  assert.equal(summary.groups[1].durationMsAverage, 800);
  assert.equal(summary.signature, "Tehkné Solutions");
});

test("release, health and telemetry endpoints complete the browser-to-metrics flow", async () => {
  const instance = startServer({ port: 0 });
  try {
    await once(instance.httpServer, "listening");
    const port = instance.httpServer.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.version, "0.12.0");
    assert.equal(health.design, "3.0");
    assert.equal(health.experienceEvents, 0);
    assert.equal(health.signature, "Tehkné Solutions");

    const release = await fetch(`${baseUrl}/release`).then((response) => response.json());
    assert.equal(release.ok, true);
    assert.equal(release.version, "0.12.0");
    assert.equal(release.design, "3.0");
    assert.equal(release.signature, "Tehkné Solutions");

    const result = await fetch(`${baseUrl}/experience/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        events: [
          { event: "screen_view", screen: "home", device: "mobile", realm: "online", release: "0.12.0", value: "opened" },
          { event: "private_message", email: "never@example.com" },
        ],
      }),
    });
    assert.equal(result.status, 202);
    const payload = await result.json();
    assert.equal(payload.accepted, 1);
    assert.equal(payload.rejected, 1);
    assert.equal(instance.experienceTelemetry.summary().total, 1);

    const updatedHealth = await fetch(`${baseUrl}/health`).then((response) => response.json());
    assert.equal(updatedHealth.experienceEvents, 1);

    const metrics = await fetch(`${baseUrl}/metrics`).then((response) => response.text());
    assert.match(metrics, /hexa_client_experience_events_total/);
  } finally {
    await instance.close();
  }
});
