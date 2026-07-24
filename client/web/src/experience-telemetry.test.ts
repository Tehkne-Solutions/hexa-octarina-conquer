import { describe, expect, it } from "vitest";

import {
  EXPERIENCE_TELEMETRY_KEY,
  buildExperienceEvent,
  setTelemetryEnabled,
  telemetryEnabled,
} from "./experience-telemetry";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    snapshot: () => Object.fromEntries(values),
  };
}

describe("experience telemetry", () => {
  it("creates a bounded operational event without personal fields", () => {
    const event = buildExperienceEvent("screen_view", {
      screen: "campaign-map",
      realm: "online",
      value: "opened by player name@example.com",
      durationMs: 9_999_999,
    }, {
      device: "mobile",
      release: "0.12.0+abcdef",
      occurredAt: 123,
    });

    expect(event).toEqual({
      event: "screen_view",
      screen: "campaign-map",
      device: "mobile",
      realm: "online",
      release: "0.12.0-abcdef",
      value: "opened-by-player-name-example.com",
      durationMs: 3_600_000,
      occurredAt: 123,
    });
    expect(event).not.toHaveProperty("accountId");
    expect(event).not.toHaveProperty("email");
  });

  it("allows the player to disable operational telemetry", () => {
    const storage = memoryStorage();
    expect(telemetryEnabled(storage)).toBe(true);
    setTelemetryEnabled(false, storage);
    expect(storage.snapshot()[EXPERIENCE_TELEMETRY_KEY]).toBe("false");
    expect(telemetryEnabled(storage)).toBe(false);
  });
});
