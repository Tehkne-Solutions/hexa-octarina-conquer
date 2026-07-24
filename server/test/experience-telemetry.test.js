import assert from "node:assert/strict";
import test from "node:test";

import {
  ExperienceTelemetryRegistry,
  sanitizeExperienceEvent,
} from "../src/experience-telemetry.js";

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
