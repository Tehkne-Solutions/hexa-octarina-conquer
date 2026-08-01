import { describe, expect, it } from "vitest";

import { generateStrategicBalanceReport } from "./strategic-balance-report";

describe("META 10.13A fair strategic balance baseline", () => {
  it("runs and prints a reproducible 5k-match baseline with symmetric per-unit limits", () => {
    const report = generateStrategicBalanceReport(5000, 200000);
    const rateTotal = report.blueWinRate + report.redWinRate + report.unresolvedRate;
    const actionShareTotal = Object.values(report.redActionShare).reduce((sum, value) => sum + value, 0);

    console.log(`HOC_STRATEGIC_BALANCE_FAIR_BASELINE=${JSON.stringify(report)}`);

    expect(report.sampleSize).toBe(5000);
    expect(report.seedOffset).toBe(200000);
    expect(rateTotal).toBeCloseTo(1, 10);
    expect(report.averageRounds).toBeGreaterThan(0);
    expect(report.averageRounds).toBeLessThanOrEqual(24);
    expect(actionShareTotal).toBeCloseTo(1, 10);
  });
});
