import { describe, expect, it } from "vitest";

import { generateStrategicBalanceReport } from "./strategic-balance-report";

describe("VS51 fair strategic balance baseline", () => {
  it("keeps the canonical mirrored opening near 50/50 across paired initiative", () => {
    const report = generateStrategicBalanceReport(5000, 200000);
    const rateTotal = report.blueWinRate + report.redWinRate + report.unresolvedRate;
    const actionShareTotal = Object.values(report.redActionShare).reduce((sum, value) => sum + value, 0);

    console.log(`HOC_STRATEGIC_BALANCE_FAIR_BASELINE=${JSON.stringify(report)}`);

    expect(report.sampleSize).toBe(5000);
    expect(report.seedOffset).toBe(200000);
    expect(rateTotal).toBeCloseTo(1, 10);
    expect(report.blueWinRate).toBeGreaterThanOrEqual(0.45);
    expect(report.blueWinRate).toBeLessThanOrEqual(0.55);
    expect(report.redWinRate).toBeGreaterThanOrEqual(0.45);
    expect(report.redWinRate).toBeLessThanOrEqual(0.55);
    expect(report.unresolvedRate).toBeLessThanOrEqual(0.05);
    expect(report.health).toBe("balanced");
    expect(report.averageRounds).toBeGreaterThan(0);
    expect(report.averageRounds).toBeLessThanOrEqual(24);
    expect(actionShareTotal).toBeCloseTo(1, 10);
  }, 45_000);
});
