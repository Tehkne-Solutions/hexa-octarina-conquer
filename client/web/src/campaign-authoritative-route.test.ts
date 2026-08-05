import { describe, expect, it } from "vitest";

import { createCampaignJourney, flattenCampaignJourney, LIVING_MISSION_ID } from "./campaign-journey";
import type { CampaignCatalog } from "./protocol";
import type { LivingCampaignProgress } from "./unified-progress";

const livingProgress: LivingCampaignProgress = {
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
};

function catalog(): CampaignCatalog {
  return {
    chapters: [
      { id: "c1", order: 1, title: "Capítulo I", subtitle: "Primeiro arco" },
      { id: "c2", order: 2, title: "Capítulo II", subtitle: "Segundo arco" },
      { id: "c3", order: 3, title: "Capítulo III", subtitle: "Terceiro arco" },
    ],
    missions: Array.from({ length: 12 }, (_, index) => ({
      id: `c${Math.floor(index / 4) + 1}-m${(index % 4) + 1}`,
      chapterId: `c${Math.floor(index / 4) + 1}`,
      order: index + 1,
      title: `Missão ${index + 1}`,
      briefing: "Combate autoritativo",
      boardSize: 4 + Math.floor(index / 4),
      difficulty: index < 4 ? "novice" : index < 8 ? "adept" : "master",
      aiName: "IA Octarina",
      rewardXp: 100,
      primary: { type: "captures", target: 1, label: "Capturar" },
      bonus: [],
      failure: {},
      unlocked: index === 0,
      progress: null,
    })),
    achievements: [],
    totals: { stars: 0, cells: 0, duelsWon: 0, fortifications: 0, attempts: 0, completed: 0 },
  };
}

describe("authoritative campaign routing", () => {
  it("uses exactly the 12 server missions when the authoritative catalog is available", () => {
    const missions = flattenCampaignJourney(createCampaignJourney(catalog(), livingProgress));
    expect(missions).toHaveLength(12);
    expect(missions.every((mission) => mission.source === "server")).toBe(true);
    expect(missions.some((mission) => mission.id === LIVING_MISSION_ID)).toBe(false);
  });

  it("does not gate server mission unlocks behind completion of the local living prologue", () => {
    const missions = flattenCampaignJourney(createCampaignJourney(catalog(), livingProgress));
    expect(missions[0].unlocked).toBe(true);
    expect(missions[0].source).toBe("server");
  });

  it("keeps the living prologue only as an offline/no-catalog fallback", () => {
    const missions = flattenCampaignJourney(createCampaignJourney(null, livingProgress));
    expect(missions).toHaveLength(1);
    expect(missions[0].id).toBe(LIVING_MISSION_ID);
    expect(missions[0].source).toBe("living");
  });
});
