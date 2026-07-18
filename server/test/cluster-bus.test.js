import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { MemoryClusterBus } from "../src/cluster-bus.js";

test("memory cluster bus broadcasts durable-style envelopes to every replica", async () => {
  const emitter = new EventEmitter();
  const first = new MemoryClusterBus({ emitter, instanceId: "instance-a" });
  const second = new MemoryClusterBus({ emitter, instanceId: "instance-b" });
  const received = [];
  let resolveDelivery;
  const delivered = new Promise((resolve) => {
    resolveDelivery = resolve;
  });

  function capture(replica, event) {
    received.push([replica, event]);
    if (received.length === 2) resolveDelivery();
  }

  first.subscribe((event) => capture("first", event));
  second.subscribe((event) => capture("second", event));

  try {
    const published = await first.publish("room.update", {
      roomId: "ROOM0001",
      messages: [{ type: "room.patch", payload: { text: "x".repeat(12_000) } }],
    });
    await Promise.race([
      delivered,
      new Promise((_, reject) => setTimeout(() => reject(new Error("cluster event delivery timed out")), 1_000)),
    ]);
    assert.equal(received.length, 2);
    assert.equal(received[0][1].id, published.id);
    assert.equal(received[1][1].originInstanceId, "instance-a");
    assert.equal(received[1][1].payload.messages[0].payload.text.length, 12_000);
  } finally {
    await first.close();
    await second.close();
  }
});
