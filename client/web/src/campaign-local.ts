import type { CampaignCatalog, CampaignResult } from "./protocol";

const KEY = "hexa.web.guest-campaign.v1";

interface GuestCampaignProgress {
  missionStars: Record<string, number>;
  attempts: Record<string, number>;
  achievements: Record<string, number>;
  totals: CampaignCatalog["totals"];
}

function emptyProgress(): GuestCampaignProgress {
  return {
    missionStars: {},
    attempts: {},
    achievements: {},
    totals: { stars: 0, cells: 0, duelsWon: 0, fortifications: 0, attempts: 0, completed: 0 },
  };
}

export function readGuestCampaignProgress(): GuestCampaignProgress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyProgress(), ...JSON.parse(raw) } : emptyProgress();
  } catch {
    localStorage.removeItem(KEY);
    return emptyProgress();
  }
}

function save(progress: GuestCampaignProgress): void {
  localStorage.setItem(KEY, JSON.stringify(progress));
}

function unlockAchievements(progress: GuestCampaignProgress, catalog: CampaignCatalog, result: CampaignResult): void {
  const now = Date.now();
  const unlock = (id: string, condition: boolean) => {
    if (condition && !progress.achievements[id]) progress.achievements[id] = now;
  };
  unlock("first-sigil", progress.totals.completed >= 1);
  unlock("six-stars", progress.totals.stars >= 6);
  unlock("twelve-stars", progress.totals.stars >= 12);
  unlock("cartographer", progress.totals.cells >= 25);
  unlock("duelist", progress.totals.duelsWon >= 5);
  unlock("architect", progress.totals.fortifications >= 6);
  unlock("flawless", result.success && Number(result.stats.hp ?? 0) >= 18);
  const chapterComplete = (chapterId: string) => catalog.missions
    .filter((mission) => mission.chapterId === chapterId)
    .every((mission) => (progress.missionStars[mission.id] ?? 0) > 0);
  unlock("chapter-one", chapterComplete("chapter-1"));
  unlock("chapter-two", chapterComplete("chapter-2"));
  unlock("legend", catalog.missions.every((mission) => (progress.missionStars[mission.id] ?? 0) > 0));
}

export function recordGuestCampaignResult(catalog: CampaignCatalog, result: CampaignResult): CampaignCatalog {
  const progress = readGuestCampaignProgress();
  progress.attempts[result.missionId] = (progress.attempts[result.missionId] ?? 0) + 1;
  progress.totals.attempts += 1;
  progress.totals.cells += Number(result.stats.cells ?? 0);
  progress.totals.duelsWon += Number(result.stats.duelsWon ?? 0);
  progress.totals.fortifications += Number(result.stats.fortifications ?? 0);
  if (result.success) {
    progress.missionStars[result.missionId] = Math.max(progress.missionStars[result.missionId] ?? 0, result.stars);
  }
  progress.totals.stars = Object.values(progress.missionStars).reduce((sum, stars) => sum + stars, 0);
  progress.totals.completed = Object.values(progress.missionStars).filter((stars) => stars > 0).length;
  unlockAchievements(progress, catalog, result);
  save(progress);
  return decorateGuestCampaign(catalog, progress);
}

export function decorateGuestCampaign(catalog: CampaignCatalog, supplied = readGuestCampaignProgress()): CampaignCatalog {
  const progress = supplied;
  return {
    ...catalog,
    totals: progress.totals,
    missions: catalog.missions.map((mission, index) => {
      const previousCompleted = index === 0 || (progress.missionStars[catalog.missions[index - 1].id] ?? 0) > 0;
      const stars = progress.missionStars[mission.id] ?? 0;
      return {
        ...mission,
        unlocked: previousCompleted,
        progress: stars > 0 || progress.attempts[mission.id]
          ? { stars, attempts: progress.attempts[mission.id] ?? 0 }
          : null,
      };
    }),
    achievements: catalog.achievements.map((achievement) => ({
      ...achievement,
      unlockedAt: progress.achievements[achievement.id] ?? null,
    })),
  };
}
