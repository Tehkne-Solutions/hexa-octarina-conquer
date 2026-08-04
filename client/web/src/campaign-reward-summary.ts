import type { CampaignCatalog, CampaignResult } from "./protocol";

export interface CampaignRewardSummary {
  xp: number;
  stars: number;
  nextMission: { id: string; title: string } | null;
  nextChapter: { id: string; title: string } | null;
  achievements: string[];
}

export function deriveCampaignRewardSummary(
  result: CampaignResult,
  previousCatalog: CampaignCatalog | null,
  updatedCatalog: CampaignCatalog | null,
  unlockedAchievements: string[] = [],
): CampaignRewardSummary {
  const previousMissionIds = new Set(
    previousCatalog?.missions.filter((mission) => mission.unlocked).map((mission) => mission.id) ?? [],
  );
  const newlyUnlocked = updatedCatalog?.missions.filter((mission) => mission.unlocked && !previousMissionIds.has(mission.id)) ?? [];
  const nextMission = newlyUnlocked.sort((left, right) => left.order - right.order)[0] ?? null;
  const previousChapterIds = new Set(
    previousCatalog?.missions.filter((mission) => mission.unlocked).map((mission) => mission.chapterId) ?? [],
  );
  const nextChapterId = nextMission && !previousChapterIds.has(nextMission.chapterId) ? nextMission.chapterId : null;
  const nextChapter = nextChapterId
    ? updatedCatalog?.chapters.find((chapter) => chapter.id === nextChapterId) ?? null
    : null;

  return {
    xp: result.success ? result.rewardXp : 0,
    stars: result.stars,
    nextMission: nextMission ? { id: nextMission.id, title: nextMission.title } : null,
    nextChapter: nextChapter ? { id: nextChapter.id, title: nextChapter.title } : null,
    achievements: unlockedAchievements,
  };
}
