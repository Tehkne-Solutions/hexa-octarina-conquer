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

export interface RoomSnapshot {
  roomId: string;
  revision: number;
  status: "waiting" | "active" | "finished";
  board: BoardState;
  players: PublicPlayer[];
  duels: DuelState[];
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
  status: string;
  boardSize: number;
  playerCount: number;
  players: Array<{ name: string; connected: boolean; accountLinked: boolean }>;
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
