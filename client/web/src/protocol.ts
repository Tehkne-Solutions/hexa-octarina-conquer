export const PROTOCOL_VERSION = "1.0" as const;

export type Point = [number, number];

export interface EdgeState {
  start: Point;
  end: Point;
  ownerId: string;
}

export interface CellState {
  id: string;
  x: number;
  y: number;
  ownerId: string;
  provinceId: string;
}

export interface UnitState {
  kind: string;
  level: number;
  hp: number;
  element: string;
}

export interface ProvinceState {
  id: string;
  ownerId: string;
  cellIds: string[];
  unit: UnitState;
  protectedTurns: number;
}

export interface BoardState {
  boardSize: number;
  currentPlayerId: string | null;
  turnNumber: number;
  actionsRemaining: number;
  edges: EdgeState[];
  cells: CellState[];
  provinces: ProvinceState[];
}

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  accountLinked: boolean;
  isBot?: boolean;
  difficulty?: "novice" | "adept" | "master" | null;
  mana: number;
  hp: number;
  handSize: number;
}

export interface CardState {
  id: string;
  name: string;
  kind: string;
  cost: number;
  effect: string;
  value: number;
  element: string;
  description: string;
  icon: string;
}

export interface DuelState {
  id: string;
  attackerId: string;
  defenderId: string;
  provinceId: string;
  status: string;
  roundNumber?: number;
  attacker?: { hp: number; energy: number; shield?: number };
  defender?: { hp: number; energy: number; shield?: number };
}

export interface CampaignObjective {
  type: string;
  target: number;
  label: string;
  current?: number;
  completed?: boolean;
}

export interface CampaignMission {
  id: string;
  chapterId: string;
  order: number;
  title: string;
  briefing: string;
  boardSize: number;
  difficulty: "novice" | "adept" | "master";
  aiName: string;
  rewardXp: number;
  primary: CampaignObjective;
  bonus: CampaignObjective[];
  failure: { turnLimit?: number; botCells?: number };
  unlocked: boolean;
  progress: null | { stars: number; attempts: number; bestTurns?: number | null; bestHp?: number };
}

export interface CampaignChapter {
  id: string;
  order: number;
  title: string;
  subtitle: string;
}

export interface CampaignAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: number | null;
}

export interface CampaignCatalog {
  chapters: CampaignChapter[];
  missions: CampaignMission[];
  achievements: CampaignAchievement[];
  totals: { stars: number; cells: number; duelsWon: number; fortifications: number; attempts: number; completed: number };
}

export interface CampaignResult {
  roomId: string;
  missionId: string;
  success: boolean;
  stars: number;
  rewardXp: number;
  reason: string;
  stats: Record<string, number>;
  bonusCompleted: boolean[];
  finishedAt: number;
}

export interface CampaignState {
  mission: Pick<CampaignMission, "id" | "chapterId" | "order" | "title" | "briefing" | "difficulty" | "aiName" | "rewardXp">;
  status: "active" | "completed" | "failed";
  humanPlayerId: string;
  botPlayerId: string;
  primary: CampaignObjective;
  bonus: CampaignObjective[];
  failure: { turnLimit?: number; botCells?: number };
  stats: Record<string, number>;
  result: CampaignResult | null;
}

export interface RoomSnapshot {
  roomId: string;
  mode?: "multiplayer" | "campaign";
  revision: number;
  status: "waiting" | "active" | "finished";
  board: BoardState;
  players: PublicPlayer[];
  duels: DuelState[];
  campaign?: CampaignState | null;
  matchResult: null | {
    winnerPlayerId: string;
    loserPlayerId: string;
    reason: string;
    finishedAt: number;
  };
}

export interface PrivateState {
  roomId: string;
  revision: number;
  playerId: string;
  accountId?: string | null;
  name: string;
  mana: number;
  hp: number;
  hand: CardState[];
  duelSubmissions: Record<string, string[]>;
  campaign?: CampaignState | null;
}

export interface RoomSession {
  roomId: string;
  playerId: string;
  sessionToken: string;
  lastRevision: number;
}

export interface AccountSession {
  account: {
    id: string;
    handle: string;
    displayName: string;
    level?: number;
    xp?: number;
    rating?: number;
  };
  accessToken: string;
}

export interface LobbyRoom {
  roomId: string;
  mode?: string;
  status: string;
  boardSize: number;
  playerCount: number;
  players: Array<{ name: string; connected: boolean; accountLinked: boolean; isBot?: boolean }>;
  revision: number;
}

export interface ServerMessage<T = unknown> {
  protocolVersion?: string;
  type: string;
  requestId?: string;
  payload: T;
}

export interface OutgoingMessage<T = unknown> {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: string;
  requestId: string;
  payload: T;
}

export function makeRequestId(prefix = "web"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function canonicalEdge(start: Point, end: Point): string {
  return [start, end]
    .sort((left, right) => left[0] - right[0] || left[1] - right[1])
    .map(([x, y]) => `${x},${y}`)
    .join("|");
}

export function isAdjacent(start: Point, end: Point): boolean {
  return Math.abs(start[0] - end[0]) + Math.abs(start[1] - end[1]) === 1;
}
