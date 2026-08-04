import { describe, expect, it } from "vitest";

import { campaignCompletionSummary } from "./campaign-completion";
import type { CampaignCatalog } from "./protocol";

function catalog(completed: number, legendUnlocked = false): CampaignCatalog {
  const missions = Array.from({ length: 12 }, (_, index) => ({
    id: `m-${index + 1}`,
    chapterId: `chapter-${Math.floor(index / 4) + 1}`,
    order: index + 1,
    title: `Missão ${index + 1}`,
    briefing: "Teste",
    boardSize: 4,
    difficulty: "novice" as const,
    aiName: "Rival",
    rewardXp: 100,
    primary: { type: "cells", target: 1, label: "Conquiste 1 célula" },
    bonus: [],
    failure: {},
    unlocked: true,
    progress: index < completed ? { stars: index < 6 ? 3 : 2, attempts: 1 } : null,
  }));

  return {
    chapters: [
      { id: "chapter-1", order: 1, title: "I", subtitle: "I" },
      { id: "chapter-2", order: 2, title: "II", subtitle: "II" },
      { id: "chapter-3", order: 3, title: "III", subtitle: "III" },
    ],
    missions,
    achievements: [{
      id: "legend",
      title: "Lenda da Octarina",
      description: "Conclua todas as missões.",
      icon: "⬡",
      unlockedAt: legendUnlocked ? 123 : null,
    }],
    totals: { stars: missions.reduce((sum, mission) => sum + (mission.progress?.stars ?? 0), 0), cells: 0, duelsWon: 0, fortifications: 0, attempts: completed, completed },
  };
}

describe("VS70 campaign completion epilogue", () => {
  it("does not close the campaign before all 12 authoritative missions are complete", () => {
    const summary = campaignCompletionSummary(catalog(11, false));
    expect(summary.complete).toBe(false);
    expect(summary.completed).toBe(11);
    expect(summary.total).toBe(12);
    expect(summary.legend).toBeNull();
  });

  it("closes the campaign at 12/12 and counts mastery from three-star mission progress", () => {
    const summary = campaignCompletionSummary(catalog(12, true));
    expect(summary.complete).toBe(true);
    expect(summary.mastered).toBe(6);
    expect(summary.legend).toEqual({ title: "Lenda da Octarina", icon: "⬡" });
  });

  it("never synthesizes the legend achievement when the catalog has not unlocked it", () => {
    const summary = campaignCompletionSummary(catalog(12, false));
    expect(summary.complete).toBe(true);
    expect(summary.legend).toBeNull();
  });
});
