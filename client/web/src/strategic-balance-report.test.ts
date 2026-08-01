import { describe, expect, it } from "vitest";

import { generateStrategicBalanceReport } from "./strategic-balance-report";

describe("META 10.12B strategic balance report", () => {
  it("aggregates a reproducible seeded sample with valid rates", () => {
    const first = generateStrategicBalanceReport(120, 5000);
    const second = generateStrategicBalanceReport(120, 5000);

    expect(second).toEqual(first);
    expect(first.sampleSize).toBe(120);
    expect(first.blueWinRate + first.redWinRate + first.unresolvedRate).toBeCloseTo(1, 10);
    expect(first.averageRounds).toBeGreaterThan(0);
    expect(first.averageRounds).toBeLessThanOrEqual(24);
  });

  it("tracks scorer action share without losing observations", () => {
    const report = generateStrategicBalanceReport(80, 9000);
    const actionTotal = Object.values(report.summary.redActionCounts).reduce((sum, value) => sum + value, 0);
    const shareTotal = Object.values(report.redActionShare).reduce((sum, value) => sum + value, 0);

    expect(actionTotal).toBeGreaterThan(0);
    expect(report.dominantRedAction).not.toBeNull();
    expect(shareTotal).toBeCloseTo(1, 10);
    expect(report.notes.length).toBeGreaterThan(0);
    expect(["blue-favored", "red-favored", "balanced", "inconclusive"]).toContain(report.health);
  });
});
