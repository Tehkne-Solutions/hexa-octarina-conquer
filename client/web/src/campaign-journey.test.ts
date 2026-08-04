import { describe, expect, it } from "vitest";

import {
  campaignTotals,
  createCampaignJourney,
  recommendedCampaignMission,
} from "./campaign-journey";
import type { CampaignCatalog } from "./protocol";
import type { LivingCampaignProgress } from "./unified-progress";

const progress: LivingCampaignProgress = {
  missionId: "bridge-of-ashes",
  title: "A Ponte das Cinzas",
  status: "active",
  percent: 48,
  completedObjectives: 2,
  totalObjectives: 5,
  attempts: 2,
  bestTurn: null,
  lastTurn: 3,
  startedAt: 1,
  lastPlayedAt: 2,
  completedAt: null,
  building: null,
  rewards: [],
};

const catalog: CampaignCatalog = {
  chapters: [{ id: "chapter-1", order: 1, title: "Fundamentos Rúnicos", subtitle: "Aprenda a controlar a rede." }],
  missions: [
    {
      id: "c1-m1",
      chapterId: "chapter-1",
      order: 1,
      title: "Primeiro Selo",
      briefing: "Feche a primeira célula.",
      boardSize: 4,
      difficulty: "novice",
      aiName: "Aprendiz",
      rewardXp: 100,
      primary: { type: "cells", target: 1, label: "Fechar uma célula" },
      bonus: [{ type: "turns", target: 5, label: "Terminar em cinco rodadas" }],
      failure: { turnLimit: 10 },
      unlocked: true,
      progress: { stars: 2, attempts: 1 },
    },
    {
      id: "c1-m2",
      chapterId: "chapter-1",
      order: 2,
      title: "Linha de Vigília",
      briefing: "Proteja duas fronteiras.",
      boardSize: 5,
      difficulty: "adept",
      aiName: "Sentinela",
      rewardXp: 150,
      primary: { type: "fortifications", target: 2, label: "Criar duas fortalezas" },
      bonus: [],
      failure: { turnLimit: 12 },
      unlocked: true,
      progress: null,
    },
  ],
  achievements: [],
  totals: { stars: 2, cells: 1, duelsWon: 0, fortifications: 0, attempts: 1, completed: 1 },
};

describe("campaign journey", () => {
  it("keeps the living prologue as the first chapter and preserves its progress", () => {
    const chapters = createCampaignJourney(catalog, progress);
    expect(chapters[0].id).toBe("living-prologue");
    expect(chapters[0].missions[0].progressPercent).toBe(48);
    expect(chapters[1].missions).toHaveLength(2);
  });

  it("keeps authoritative chapters locked until the living prologue is won", () => {
    const chapters = createCampaignJourney(catalog, progress);
    expect(chapters[1].missions.every((mission) => mission.unlocked === false)).toBe(true);
  });

  it("recommends the active living mission before server missions", () => {
    const recommended = recommendedCampaignMission(createCampaignJourney(catalog, progress));
    expect(recommended?.id).toBe("bridge-of-ashes");
  });

  it("restores server unlocks and moves recommendation after the prologue victory", () => {
    const completedProgress = { ...progress, status: "victory" as const, percent: 100 };
    const chapters = createCampaignJourney(catalog, completedProgress);
    expect(chapters[1].missions.every((mission) => mission.unlocked)).toBe(true);
    const recommended = recommendedCampaignMission(chapters);
    expect(recommended?.id).toBe("c1-m2");
  });

  it("calculates totals across the living and authoritative campaigns", () => {
    const completedProgress = { ...progress, status: "victory" as const, percent: 100 };
    const totals = campaignTotals(createCampaignJourney(catalog, completedProgress));
    expect(totals).toEqual({ completed: 2, missions: 3, stars: 5, availableStars: 9 });
  });
});
