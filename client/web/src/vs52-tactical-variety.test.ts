import { describe, expect, it } from "vitest";

import { generateStrategicBalanceReport } from "./strategic-balance-report";

describe("VS52 tactical variety baseline", () => {
  it("reduces repetitive Rubra BUILD usage without breaking the balanced opening", () => {
    const report = generateStrategicBalanceReport(5000, 240000);
    const buildShare = report.redActionShare.BUILD ?? 0;

    console.log("HOC_VS52_TACTICAL_VARIETY=" + JSON.stringify({
      sampleSize: report.sampleSize,
      blueWinRate: report.blueWinRate,
      redWinRate: report.redWinRate,
      unresolvedRate: report.unresolvedRate,
      buildShare,
      redActionShare: report.redActionShare,
      health: report.health,
    }));

    expect(report.blueWinRate).toBeGreaterThanOrEqual(0.45);
    expect(report.blueWinRate).toBeLessThanOrEqual(0.55);
    expect(report.redWinRate).toBeGreaterThanOrEqual(0.45);
    expect(report.redWinRate).toBeLessThanOrEqual(0.55);
    expect(report.unresolvedRate).toBeLessThanOrEqual(0.05);
    expect(report.health).toBe("balanced");
    expect(buildShare).toBeLessThan(0.55);
  });
});
