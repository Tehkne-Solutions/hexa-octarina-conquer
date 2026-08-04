import type { CampaignCatalog, CampaignMission } from "./protocol";
import type { LivingCampaignProgress } from "./unified-progress";

export type CampaignMissionSource = "living" | "server";

export interface CampaignJourneyMission {
  id: string;
  source: CampaignMissionSource;
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  chapterSubtitle: string;
  order: number;
  title: string;
  briefing: string;
  difficulty: CampaignMission["difficulty"];
  aiName: string;
  boardSize: number;
  rewardXp: number;
  primaryLabel: string;
  bonusLabels: string[];
  unlocked: boolean;
  stars: number;
  attempts: number;
  progressPercent: number;
  completed: boolean;
}

export interface CampaignJourneyChapter {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  missions: CampaignJourneyMission[];
  completed: number;
  stars: number;
}

export const LIVING_MISSION_ID = "bridge-of-ashes";

function serverProgressPercent(mission: CampaignMission): number {
  if ((mission.progress?.stars ?? 0) > 0) return 100;
  if ((mission.progress?.attempts ?? 0) > 0) return 18;
  return 0;
}

export function createCampaignJourney(
  catalog: CampaignCatalog | null,
  livingProgress: LivingCampaignProgress,
): CampaignJourneyChapter[] {
  const prologueCompleted = livingProgress.status === "victory";
  const livingMission: CampaignJourneyMission = {
    id: LIVING_MISSION_ID,
    source: "living",
    chapterId: "living-prologue",
    chapterOrder: 0,
    chapterTitle: "Prólogo Vivo",
    chapterSubtitle: "A reconquista de Orun começa onde as trilhas atravessam as cinzas.",
    order: 1,
    title: "A Ponte das Cinzas",
    briefing: "O moinho que alimenta Orun foi tomado. Liberte Lyra, atravesse a ponte, derrote os saqueadores e escolha a primeira construção da vila.",
    difficulty: "novice",
    aiName: "Saqueadores das Cinzas",
    boardSize: 7,
    rewardXp: 300,
    primaryLabel: "Libertar Lyra e retomar o Moinho do Norte",
    bonusLabels: ["Fechar uma célula territorial", "Concluir sem perder todas as unidades"],
    unlocked: true,
    stars: prologueCompleted ? 3 : 0,
    attempts: livingProgress.attempts,
    progressPercent: livingProgress.percent,
    completed: prologueCompleted,
  };

  const chapters: CampaignJourneyChapter[] = [{
    id: "living-prologue",
    order: 0,
    title: livingMission.chapterTitle,
    subtitle: livingMission.chapterSubtitle,
    missions: [livingMission],
    completed: livingMission.completed ? 1 : 0,
    stars: livingMission.stars,
  }];

  if (!catalog) return chapters;

  const serverChapters = catalog.chapters
    .map((chapter) => {
      const missions = catalog.missions
        .filter((mission) => mission.chapterId === chapter.id)
        .sort((left, right) => left.order - right.order)
        .map<CampaignJourneyMission>((mission) => ({
          id: mission.id,
          source: "server",
          chapterId: chapter.id,
          chapterOrder: chapter.order,
          chapterTitle: chapter.title,
          chapterSubtitle: chapter.subtitle,
          order: mission.order,
          title: mission.title,
          briefing: mission.briefing,
          difficulty: mission.difficulty,
          aiName: mission.aiName,
          boardSize: mission.boardSize,
          rewardXp: mission.rewardXp,
          primaryLabel: mission.primary.label,
          bonusLabels: mission.bonus.map((objective) => objective.label),
          unlocked: prologueCompleted && mission.unlocked,
          stars: mission.progress?.stars ?? 0,
          attempts: mission.progress?.attempts ?? 0,
          progressPercent: serverProgressPercent(mission),
          completed: (mission.progress?.stars ?? 0) > 0,
        }));

      return {
        id: chapter.id,
        order: chapter.order,
        title: chapter.title,
        subtitle: chapter.subtitle,
        missions,
        completed: missions.filter((mission) => mission.completed).length,
        stars: missions.reduce((sum, mission) => sum + mission.stars, 0),
      } satisfies CampaignJourneyChapter;
    })
    .filter((chapter) => chapter.missions.length > 0);

  return [...chapters, ...serverChapters].sort((left, right) => left.order - right.order);
}

export function flattenCampaignJourney(chapters: CampaignJourneyChapter[]): CampaignJourneyMission[] {
  return chapters.flatMap((chapter) => chapter.missions);
}

export function recommendedCampaignMission(chapters: CampaignJourneyChapter[]): CampaignJourneyMission | null {
  const missions = flattenCampaignJourney(chapters);
  return missions.find((mission) => mission.unlocked && !mission.completed)
    ?? missions.find((mission) => mission.unlocked)
    ?? null;
}

export function campaignTotals(chapters: CampaignJourneyChapter[]): {
  completed: number;
  missions: number;
  stars: number;
  availableStars: number;
} {
  const missions = flattenCampaignJourney(chapters);
  return {
    completed: missions.filter((mission) => mission.completed).length,
    missions: missions.length,
    stars: missions.reduce((sum, mission) => sum + mission.stars, 0),
    availableStars: missions.length * 3,
  };
}

export function difficultyLabel(difficulty: CampaignMission["difficulty"]): string {
  if (difficulty === "novice") return "Iniciante";
  if (difficulty === "adept") return "Tático";
  return "Mestre";
}
