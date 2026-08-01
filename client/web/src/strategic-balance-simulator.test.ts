import { describe, expect, it } from "vitest";

import { simulateStrategicBalance, simulateStrategicMatch } from "./strategic-balance-simulator";

describe("META 10.12A strategic balance simulator", () => {
  it("is deterministic for the same seed", () => {
    expect(simulateStrategicMatch(17)).toEqual(simulateStrategicMatch(17));
  });

  it("aggregates a batch without losing any match", () => {
    const summary = simulateStrategicBalance(40, 100);

    expect(summary.matches).toBe(40);
    expect(summary.victories + summary.defeats + summary.unresolved).toBe(40);
    expect(summary.averageRounds).toBeGreaterThan(0);
    expect(summary.averageRounds).toBeLessThanOrEqual(24);
    expect(summary.averageBlueCells).toBeGreaterThanOrEqual(0);
    expect(summary.averageRedCells).toBeGreaterThanOrEqual(0);
  });

  it("produces multiple seeded match samples for balance inspection", () => {
    const samples = Array.from({ length: 12 }, (_, index) => simulateStrategicMatch(index + 1));

    expect(samples).toHaveLength(12);
    expect(samples.every((match) => match.rounds > 0)).toBe(true);
    expect(samples.every((match) => match.blueStructures >= 0 && match.redStructures >= 0)).toBe(true);
  });
});
