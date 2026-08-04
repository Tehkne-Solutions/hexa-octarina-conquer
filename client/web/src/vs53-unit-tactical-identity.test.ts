import { describe, expect, it } from "vitest";

import { strategicRoleIdentityBonus } from "./strategic-ai-global-executor";
import { generateStrategicBalanceReport } from "./strategic-balance-report";
import type { StrategicAiActionCandidate } from "./strategic-ai-global-action";

function action(
  unitId: StrategicAiActionCandidate["unitId"],
  kind: StrategicAiActionCandidate["kind"],
): StrategicAiActionCandidate {
  return { kind, unitId, targetId: "s-1-1", score: 80, reason: "test" };
}

describe("VS53 Rubra unit tactical identity", () => {
  it("gives Varg scouting bias and Brakk champion bias without buffing BUILD", () => {
    expect(strategicRoleIdentityBonus(action("varg", "move"))).toBe(6);
    expect(strategicRoleIdentityBonus(action("varg", "confront"))).toBe(4);
    expect(strategicRoleIdentityBonus(action("varg", "build"))).toBe(0);

    expect(strategicRoleIdentityBonus(action("brakk", "structure"))).toBe(6);
    expect(strategicRoleIdentityBonus(action("brakk", "attack"))).toBe(2);
    expect(strategicRoleIdentityBonus(action("brakk", "build"))).toBe(0);
  });

  it("preserves the balanced opening and VS52 diversity across 5k matches", () => {
    const report = generateStrategicBalanceReport(5000, 280000);
    const buildShare = report.redActionShare.BUILD ?? 0;

    console.log("HOC_VS53_TACTICAL_IDENTITY=" + JSON.stringify({
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
  }, 45000);
});
