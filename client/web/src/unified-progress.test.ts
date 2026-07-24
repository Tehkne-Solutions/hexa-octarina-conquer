import { describe, expect, it } from "vitest";

import type { AccountSession, CampaignCatalog } from "./protocol";
import {
  deriveProfileSummary,
  type LivingCampaignProgress,
  unlockedCardIds,
  unlockedUnitIds,
} from "./unified-progress";

const emptyCatalog: CampaignCatalog = {
  chapters: [],
  missions: [],
  achievements: [],
  totals: { stars: 0, cells: 0, duelsWon: 0, fortifications: 0, attempts: 0, completed: 0 },
};

function progress(overrides: Partial<LivingCampaignProgress> = {}): LivingCampaignProgress {
  return {
    missionId: "bridge-of-ashes",
    title: "A Ponte das Cinzas",
    status: "not-started",
    percent: 0,
    completedObjectives: 0,
    totalObjectives: 5,
    attempts: 0,
    bestTurn: null,
    lastTurn: 0,
    startedAt: null,
    lastPlayedAt: null,
    completedAt: null,
    building: null,
    rewards: [],
    ...overrides,
  };
}

describe("unified UI progression", () => {
  it("unlocks collection entries according to campaign objectives", () => {
    const midCampaign = progress({ status: "active", percent: 60, completedObjectives: 3 });
    const cards = unlockedCardIds(midCampaign, emptyCatalog);
    const units = unlockedUnitIds(midCampaign, emptyCatalog);

    expect(cards.has("kael-contra-selo")).toBe(true);
    expect(cards.has("raider-salto")).toBe(true);
    expect(cards.has("lyra-chuva-prismatica")).toBe(false);
    expect(units.has("lyra")).toBe(true);
    expect(units.has("raider-bridge")).toBe(true);
    expect(units.has("raider-mill")).toBe(false);
  });

  it("unlocks legendary rewards after the living mission victory", () => {
    const victory = progress({ status: "victory", percent: 100, completedObjectives: 5 });
    expect(unlockedCardIds(victory, emptyCatalog).has("lyra-chuva-prismatica")).toBe(true);
    expect(unlockedUnitIds(victory, emptyCatalog).has("raider-mill")).toBe(true);
  });

  it("uses authoritative account and campaign values in profile summaries", () => {
    const account: AccountSession = {
      accessToken: "token",
      account: { id: "account-1", handle: "kael", displayName: "Kael", level: 7, xp: 2450, rating: 1320 },
    };
    const catalog: CampaignCatalog = {
      ...emptyCatalog,
      missions: [
        {
          id: "m1", chapterId: "c1", order: 1, title: "Missão", briefing: "",
          boardSize: 5, difficulty: "novice", aiName: "Bot", rewardXp: 100,
          primary: { type: "cells", target: 1, label: "Fechar célula" }, bonus: [], failure: {},
          unlocked: true, progress: { stars: 2, attempts: 1 },
        },
      ],
      achievements: [{ id: "first", title: "Primeira", description: "", icon: "✦", unlockedAt: 1 }],
      totals: { stars: 2, cells: 3, duelsWon: 1, fortifications: 0, attempts: 1, completed: 1 },
    };

    const summary = deriveProfileSummary(account, catalog, progress({ percent: 45 }));
    expect(summary.displayName).toBe("Kael");
    expect(summary.level).toBe(7);
    expect(summary.xp).toBe(2450);
    expect(summary.rating).toBe(1320);
    expect(summary.completedMissions).toBe(1);
    expect(summary.achievementsUnlocked).toBe(1);
  });
});
