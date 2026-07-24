import type { AccountSession, CampaignCatalog } from "./protocol";
import { INITIAL_LIVING_UNITS, TCG_CARDS } from "./living-board-data";

const LIVING_PROGRESS_KEY = "hexa.unified.living-campaign.v2";
const LIVING_PROGRESS_EVENT = "hexa:living-campaign-progress";

export type LivingCampaignStatus = "not-started" | "active" | "victory" | "defeat";

export interface LivingCampaignProgress {
  missionId: "bridge-of-ashes";
  title: string;
  status: LivingCampaignStatus;
  percent: number;
  completedObjectives: number;
  totalObjectives: number;
  attempts: number;
  bestTurn: number | null;
  lastTurn: number;
  startedAt: number | null;
  lastPlayedAt: number | null;
  completedAt: number | null;
  building: "farm" | "tower" | null;
  rewards: string[];
}

export interface UnifiedProfileSummary {
  displayName: string;
  handle: string | null;
  level: number;
  xp: number;
  xpPercent: number;
  rating: number;
  completedMissions: number;
  totalMissions: number;
  stars: number;
  attempts: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  cardsUnlocked: number;
  cardsTotal: number;
  heroesUnlocked: number;
  heroesTotal: number;
  campaignPercent: number;
  isAuthenticated: boolean;
}

function emptyLivingProgress(): LivingCampaignProgress {
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
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function readLivingCampaignProgress(): LivingCampaignProgress {
  const storage = browserStorage();
  if (!storage) return emptyLivingProgress();
  try {
    const raw = storage.getItem(LIVING_PROGRESS_KEY);
    if (!raw) return emptyLivingProgress();
    const parsed = JSON.parse(raw) as Partial<LivingCampaignProgress>;
    return {
      ...emptyLivingProgress(),
      ...parsed,
      percent: clampPercent(Number(parsed.percent ?? 0)),
      completedObjectives: Math.max(0, Math.min(5, Number(parsed.completedObjectives ?? 0))),
      attempts: Math.max(0, Number(parsed.attempts ?? 0)),
      rewards: Array.isArray(parsed.rewards) ? parsed.rewards.map(String) : [],
    };
  } catch {
    storage.removeItem(LIVING_PROGRESS_KEY);
    return emptyLivingProgress();
  }
}

function persistLivingProgress(progress: LivingCampaignProgress): LivingCampaignProgress {
  const storage = browserStorage();
  storage?.setItem(LIVING_PROGRESS_KEY, JSON.stringify(progress));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<LivingCampaignProgress>(LIVING_PROGRESS_EVENT, { detail: progress }));
  }
  return progress;
}

export function beginLivingCampaignAttempt(): LivingCampaignProgress {
  const current = readLivingCampaignProgress();
  const now = Date.now();
  const duplicateStrictModeMount = current.status === "active"
    && current.lastPlayedAt !== null
    && now - current.lastPlayedAt < 3_000;

  return persistLivingProgress({
    ...current,
    status: current.status === "victory" ? "victory" : "active",
    attempts: duplicateStrictModeMount ? current.attempts : current.attempts + 1,
    startedAt: duplicateStrictModeMount ? current.startedAt : now,
    lastPlayedAt: now,
    lastTurn: duplicateStrictModeMount ? current.lastTurn : 1,
  });
}

export function updateLivingCampaignProgress(update: Partial<LivingCampaignProgress>): LivingCampaignProgress {
  const current = readLivingCampaignProgress();
  const now = Date.now();
  const requestedStatus = update.status ?? current.status;
  const nextStatus = current.status === "victory" && requestedStatus !== "victory"
    ? "victory"
    : requestedStatus;
  const completedObjectives = Math.max(
    current.completedObjectives,
    Math.min(current.totalObjectives, Number(update.completedObjectives ?? current.completedObjectives)),
  );
  const percent = nextStatus === "victory"
    ? 100
    : Math.max(current.percent, clampPercent(Number(update.percent ?? current.percent)));
  const lastTurn = Math.max(current.lastTurn, Number(update.lastTurn ?? current.lastTurn));
  const bestTurn = nextStatus === "victory"
    ? current.bestTurn === null
      ? lastTurn
      : Math.min(current.bestTurn, lastTurn)
    : current.bestTurn;
  const rewards = Array.from(new Set([
    ...current.rewards,
    ...(Array.isArray(update.rewards) ? update.rewards : []),
  ]));

  return persistLivingProgress({
    ...current,
    ...update,
    status: nextStatus,
    percent,
    completedObjectives,
    lastTurn,
    bestTurn,
    lastPlayedAt: now,
    completedAt: nextStatus === "victory" ? current.completedAt ?? now : current.completedAt,
    building: update.building ?? current.building,
    rewards,
  });
}

export function subscribeLivingCampaignProgress(
  listener: (progress: LivingCampaignProgress) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    listener((event as CustomEvent<LivingCampaignProgress>).detail);
  };
  window.addEventListener(LIVING_PROGRESS_EVENT, handler);
  return () => window.removeEventListener(LIVING_PROGRESS_EVENT, handler);
}

export function unlockedCardIds(
  progress: LivingCampaignProgress,
  catalog: CampaignCatalog | null,
): Set<string> {
  const unlocked = new Set<string>([
    "kael-golpe-runico",
    "kael-guardiao-celeste",
    "lyra-flecha-eter",
  ]);
  const serverCampaignCompleted = (catalog?.totals.completed ?? 0) > 0;
  const objectives = serverCampaignCompleted ? 5 : progress.completedObjectives;

  if (objectives >= 1) {
    unlocked.add("lyra-passo-lunar");
  }
  if (objectives >= 2) {
    unlocked.add("kael-contra-selo");
  }
  if (objectives >= 3) {
    unlocked.add("raider-machado");
    unlocked.add("raider-couro");
    unlocked.add("raider-salto");
  }
  if (objectives >= 4) {
    unlocked.add("lyra-marca-cacada");
  }
  if (progress.status === "victory" || serverCampaignCompleted) {
    unlocked.add("kael-muralha-astral");
    unlocked.add("lyra-chuva-prismatica");
  }
  return unlocked;
}

export function unlockedUnitIds(
  progress: LivingCampaignProgress,
  catalog: CampaignCatalog | null,
): Set<string> {
  const unlocked = new Set<string>(["kael"]);
  const serverCampaignCompleted = (catalog?.totals.completed ?? 0) > 0;
  const objectives = serverCampaignCompleted ? 5 : progress.completedObjectives;
  if (objectives >= 1) unlocked.add("lyra");
  if (objectives >= 3) unlocked.add("raider-bridge");
  if (progress.status === "victory" || serverCampaignCompleted) unlocked.add("raider-mill");
  return unlocked;
}

export function deriveProfileSummary(
  account: AccountSession | null,
  catalog: CampaignCatalog | null,
  progress: LivingCampaignProgress,
): UnifiedProfileSummary {
  const accountXp = Math.max(0, Number(account?.account.xp ?? 0));
  const accountLevel = Math.max(1, Number(account?.account.level ?? 1));
  const localXp = (catalog?.totals.stars ?? 0) * 100
    + (catalog?.totals.completed ?? 0) * 250
    + (progress.status === "victory" ? 300 : Math.round(progress.percent * 2));
  const xp = account ? accountXp : localXp;
  const level = account ? accountLevel : Math.max(1, 1 + Math.floor(xp / 1_000));
  const xpPercent = Math.min(100, Math.max(0, ((xp % 1_000) / 1_000) * 100));
  const totalMissions = catalog?.missions.length ?? 1;
  const completedMissions = catalog?.totals.completed ?? (progress.status === "victory" ? 1 : 0);
  const serverPercent = totalMissions > 0 ? (completedMissions / totalMissions) * 100 : 0;
  const campaignPercent = Math.max(progress.percent, serverPercent);
  const achievementsUnlocked = catalog?.achievements.filter((item) => item.unlockedAt !== null).length ?? 0;
  const achievementsTotal = catalog?.achievements.length ?? 0;
  const cardsUnlocked = unlockedCardIds(progress, catalog).size;
  const cardsTotal = Object.keys(TCG_CARDS).length;
  const heroesUnlocked = [...unlockedUnitIds(progress, catalog)]
    .filter((id) => INITIAL_LIVING_UNITS.some((unit) => unit.id === id && unit.faction === "player"))
    .length;
  const heroesTotal = INITIAL_LIVING_UNITS.filter((unit) => unit.faction === "player").length;

  return {
    displayName: account?.account.displayName ?? "Arquiteto visitante",
    handle: account?.account.handle ?? null,
    level,
    xp,
    xpPercent,
    rating: Math.max(0, Number(account?.account.rating ?? 1_000)),
    completedMissions,
    totalMissions,
    stars: catalog?.totals.stars ?? (progress.status === "victory" ? 3 : 0),
    attempts: (catalog?.totals.attempts ?? 0) + progress.attempts,
    achievementsUnlocked,
    achievementsTotal,
    cardsUnlocked,
    cardsTotal,
    heroesUnlocked,
    heroesTotal,
    campaignPercent: clampPercent(campaignPercent),
    isAuthenticated: Boolean(account),
  };
}
