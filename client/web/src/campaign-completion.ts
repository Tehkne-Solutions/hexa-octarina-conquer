import type { CampaignCatalog } from "./protocol";

export interface CampaignCompletionSummary {
  complete: boolean;
  completed: number;
  total: number;
  stars: number;
  mastered: number;
  legend: { title: string; icon: string } | null;
}

export function campaignCompletionSummary(catalog: CampaignCatalog): CampaignCompletionSummary {
  const total = catalog.missions.length;
  const completed = Math.min(catalog.totals.completed, total);
  const mastered = catalog.missions.filter((mission) => (mission.progress?.stars ?? 0) >= 3).length;
  const legendAchievement = catalog.achievements.find((achievement) => achievement.id === "legend" && achievement.unlockedAt);

  return {
    complete: total > 0 && completed === total,
    completed,
    total,
    stars: catalog.totals.stars,
    mastered,
    legend: legendAchievement ? { title: legendAchievement.title, icon: legendAchievement.icon } : null,
  };
}
