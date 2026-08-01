import { describe, expect, it } from "vitest";

import { generateStrategicBalanceReport } from "./strategic-balance-report";

const SAMPLE_SIZE = 5000;
const SEED_OFFSET = 100000;

describe("META 10.12C official strategic balance baseline", () => {
  it("runs and prints a reproducible 5k-match baseline", () => {
    const report = generateStrategicBalanceReport(SAMPLE_SIZE, SEED_OFFSET);

    console.info("HOC_STRATEGIC_BALANCE_BASELINE=" + JSON.stringify(report));

    expect(report.sampleSize).toBe(SAMPLE_SIZE);
    expect(report.seedOffset).toBe(SEED_OFFSET);
    expect(report.blueWinRate + report.redWinRate + report.unresolvedRate).toBeCloseTo(1, 10);
    expect(report.averageRounds).toBeGreaterThan(0);
    expect(report.averageRounds).toBeLessThanOrEqual(24);
    expect(report.notes.length).toBeGreaterThan(0);

    const actionShare = Object.values(report.redActionShare).reduce((sum, value) => sum + value, 0);
    expect(actionShare === 0 || Math.abs(actionShare - 1) < 1e-10).toBe(true);
  });
});
