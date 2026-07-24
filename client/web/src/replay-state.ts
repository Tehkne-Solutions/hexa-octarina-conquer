import type { BoardState, PublicPlayer, RoomSnapshot } from "./protocol";

export interface ReplayPlayerSummary {
  id: string;
  name: string;
  accountLinked: boolean;
}

export interface ReplaySummary {
  roomId: string;
  status: "waiting" | "active" | "finished" | string;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  latestRevision: number;
  players: ReplayPlayerSummary[];
  result: RoomSnapshot["matchResult"];
}

export interface ReplayPatch {
  roomId?: string;
  revision?: number;
  state?: Partial<RoomSnapshot>;
  event?: {
    id?: string;
    type?: string;
    at?: number;
    [key: string]: unknown;
  };
}

export interface ReplayEvent {
  roomId: string;
  revision: number;
  eventId: string;
  eventType: string;
  occurredAt: number;
  patch: ReplayPatch;
}

export interface ReplayRecord extends ReplaySummary {
  events: ReplayEvent[];
}

export interface ReplayFrame {
  index: number;
  revision: number;
  occurredAt: number;
  event: ReplayEvent | null;
  snapshot: RoomSnapshot;
}

export interface ReplayEventMeta {
  label: string;
  detail: string;
  icon: string;
  tone: "neutral" | "player" | "combat" | "territory" | "finish" | "connection";
  significant: boolean;
}

const EMPTY_BOARD: BoardState = {
  boardSize: 5,
  currentPlayerId: null,
  turnNumber: 1,
  actionsRemaining: 1,
  edges: [],
  cells: [],
  provinces: [],
};

function publicPlayer(player: Partial<PublicPlayer> & { id?: string; name?: string }): PublicPlayer {
  return {
    id: String(player.id ?? "unknown"),
    name: String(player.name ?? "Arquiteto"),
    connected: Boolean(player.connected),
    accountLinked: Boolean(player.accountLinked),
    isBot: Boolean(player.isBot),
    difficulty: player.difficulty ?? null,
    mana: Number(player.mana ?? 0),
    hp: Number(player.hp ?? 0),
    handSize: Number(player.handSize ?? 0),
  };
}

export function emptyReplaySnapshot(summary: Pick<ReplaySummary, "roomId" | "status" | "latestRevision" | "players" | "result">): RoomSnapshot {
  return {
    roomId: summary.roomId,
    mode: "multiplayer",
    revision: 0,
    status: summary.status === "finished" ? "finished" : summary.status === "active" ? "active" : "waiting",
    board: structuredClone(EMPTY_BOARD),
    players: summary.players.map((player) => publicPlayer(player)),
    duels: [],
    campaign: null,
    matchResult: summary.result ?? null,
  };
}

export function sanitizePublicSnapshot(snapshot: RoomSnapshot): RoomSnapshot {
  return {
    roomId: String(snapshot.roomId),
    mode: snapshot.mode === "campaign" ? "campaign" : "multiplayer",
    revision: Number(snapshot.revision ?? 0),
    status: snapshot.status,
    board: {
      boardSize: Number(snapshot.board?.boardSize ?? 5),
      currentPlayerId: snapshot.board?.currentPlayerId ?? null,
      turnNumber: Number(snapshot.board?.turnNumber ?? 1),
      actionsRemaining: Number(snapshot.board?.actionsRemaining ?? 0),
      edges: structuredClone(snapshot.board?.edges ?? []),
      cells: structuredClone(snapshot.board?.cells ?? []),
      provinces: structuredClone(snapshot.board?.provinces ?? []),
    },
    players: (snapshot.players ?? []).map((player) => publicPlayer(player)),
    duels: structuredClone(snapshot.duels ?? []),
    campaign: snapshot.campaign ? structuredClone(snapshot.campaign) : null,
    matchResult: snapshot.matchResult ? structuredClone(snapshot.matchResult) : null,
  };
}

export function applyReplayEvent(previous: RoomSnapshot, entry: ReplayEvent): RoomSnapshot {
  const state = entry.patch?.state ?? {};
  return sanitizePublicSnapshot({
    roomId: String(entry.patch?.roomId ?? entry.roomId ?? previous.roomId),
    mode: state.mode ?? previous.mode,
    revision: Number(entry.patch?.revision ?? entry.revision ?? previous.revision),
    status: state.status ?? previous.status,
    board: state.board ?? previous.board,
    players: state.players ?? previous.players,
    duels: state.duels ?? previous.duels,
    campaign: state.campaign === undefined ? previous.campaign : state.campaign,
    matchResult: state.matchResult === undefined ? previous.matchResult : state.matchResult,
  });
}

export function buildReplayFrames(record: ReplayRecord): ReplayFrame[] {
  const events = [...record.events].sort((left, right) => left.revision - right.revision);
  let snapshot = emptyReplaySnapshot(record);
  const frames: ReplayFrame[] = [{
    index: 0,
    revision: 0,
    occurredAt: record.createdAt,
    event: null,
    snapshot,
  }];

  for (const entry of events) {
    snapshot = applyReplayEvent(snapshot, entry);
    frames.push({
      index: frames.length,
      revision: entry.revision,
      occurredAt: entry.occurredAt,
      event: entry,
      snapshot,
    });
  }
  return frames;
}

export function replayEventMeta(eventType: string): ReplayEventMeta {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("match.finished") || normalized.includes("campaign.completed") || normalized.includes("campaign.failed")) {
    return { label: "Partida encerrada", detail: "O resultado público foi confirmado pelo servidor.", icon: "✦", tone: "finish", significant: true };
  }
  if (normalized.includes("duel")) {
    return { label: "Confronto direto", detail: "Uma província entrou em resolução de duelo.", icon: "⚔", tone: "combat", significant: true };
  }
  if (normalized.includes("cell") || normalized.includes("province") || normalized.includes("fortif")) {
    return { label: "Território alterado", detail: "O controle público do tabuleiro foi atualizado.", icon: "⬡", tone: "territory", significant: true };
  }
  if (normalized.includes("edge") || normalized.includes("card")) {
    return { label: "Jogada registrada", detail: "Uma ação pública modificou a rede.", icon: "◇", tone: "player", significant: true };
  }
  if (normalized.includes("join") || normalized.includes("created") || normalized.includes("started")) {
    return { label: "Partida iniciada", detail: "Os arquitetos entraram na arena pública.", icon: "▶", tone: "player", significant: true };
  }
  if (normalized.includes("disconnect") || normalized.includes("reconnect") || normalized.includes("presence")) {
    return { label: "Conexão atualizada", detail: "O estado público de presença foi alterado.", icon: "◉", tone: "connection", significant: false };
  }
  if (normalized.includes("turn")) {
    return { label: "Nova rodada", detail: "O controle do turno avançou.", icon: "↻", tone: "neutral", significant: true };
  }
  return { label: "Estado atualizado", detail: eventType.replaceAll(".", " "), icon: "·", tone: "neutral", significant: false };
}

export function significantFrameIndexes(frames: ReplayFrame[]): number[] {
  const indexes = frames
    .filter((frame) => frame.index === 0 || (frame.event && replayEventMeta(frame.event.eventType).significant))
    .map((frame) => frame.index);
  const last = frames.length - 1;
  if (last >= 0 && !indexes.includes(last)) indexes.push(last);
  return indexes;
}

export function nearestSignificantFrame(frames: ReplayFrame[], currentIndex: number, direction: -1 | 1): number {
  const indexes = significantFrameIndexes(frames);
  if (direction < 0) return [...indexes].reverse().find((index) => index < currentIndex) ?? 0;
  return indexes.find((index) => index > currentIndex) ?? Math.max(0, frames.length - 1);
}

export function mergeReplayEvents(current: ReplayEvent[], incoming: ReplayEvent[]): ReplayEvent[] {
  const byRevision = new Map(current.map((entry) => [entry.revision, entry]));
  for (const entry of incoming) byRevision.set(entry.revision, entry);
  return [...byRevision.values()].sort((left, right) => left.revision - right.revision);
}

export function eventFromPatch(roomId: string, patch: ReplayPatch): ReplayEvent {
  const revision = Number(patch.revision ?? 0);
  return {
    roomId,
    revision,
    eventId: String(patch.event?.id ?? `${roomId}:${revision}`),
    eventType: String(patch.event?.type ?? "room.updated"),
    occurredAt: Number(patch.event?.at ?? Date.now()),
    patch,
  };
}

export function createQaReplayRecord(): ReplayRecord {
  const roomId = "ORUN09";
  const players: ReplayPlayerSummary[] = [
    { id: "kael-player", name: "Ayla Prismática", accountLinked: true },
    { id: "rival-player", name: "Doran das Cinzas", accountLinked: true },
  ];
  const baseState: RoomSnapshot = {
    roomId,
    mode: "multiplayer",
    revision: 1,
    status: "active",
    board: { ...structuredClone(EMPTY_BOARD), currentPlayerId: "kael-player", actionsRemaining: 2 },
    players: [
      publicPlayer({ ...players[0], connected: true, hp: 18, mana: 4, handSize: 4 }),
      publicPlayer({ ...players[1], connected: true, hp: 15, mana: 3, handSize: 5 }),
    ],
    duels: [],
    campaign: null,
    matchResult: null,
  };
  const event = (revision: number, eventType: string, state: Partial<RoomSnapshot>): ReplayEvent => ({
    roomId,
    revision,
    eventId: `${roomId}:${revision}`,
    eventType,
    occurredAt: 1_720_000_000_000 + revision * 8_000,
    patch: { roomId, revision, event: { id: `${roomId}:${revision}`, type: eventType, at: 1_720_000_000_000 + revision * 8_000 }, state },
  });
  const edgeOne = { start: [0, 0] as [number, number], end: [1, 0] as [number, number], ownerId: "kael-player" };
  const edgeTwo = { start: [1, 0] as [number, number], end: [1, 1] as [number, number], ownerId: "rival-player" };
  return {
    roomId,
    status: "finished",
    createdAt: 1_720_000_000_000,
    updatedAt: 1_720_000_050_000,
    finishedAt: 1_720_000_050_000,
    latestRevision: 5,
    players,
    result: { winnerPlayerId: "kael-player", loserPlayerId: "rival-player", reason: "territory", finishedAt: 1_720_000_050_000 },
    events: [
      event(1, "match.started", baseState),
      event(2, "edge.played", { board: { ...baseState.board, edges: [edgeOne], turnNumber: 1, actionsRemaining: 1 } }),
      event(3, "cell.claimed", { board: { ...baseState.board, edges: [edgeOne, edgeTwo], cells: [{ id: "0,0", x: 0, y: 0, ownerId: "kael-player", provinceId: "province-1" }], provinces: [{ id: "province-1", ownerId: "kael-player", cellIds: ["0,0"], unit: { kind: "outpost", level: 1, hp: 7, element: "octarina" }, protectedTurns: 0 }], turnNumber: 2, actionsRemaining: 2 } }),
      event(4, "duel.resolved", { board: { ...baseState.board, edges: [edgeOne, edgeTwo], cells: [{ id: "0,0", x: 0, y: 0, ownerId: "kael-player", provinceId: "province-1" }], provinces: [{ id: "province-1", ownerId: "kael-player", cellIds: ["0,0"], unit: { kind: "fortress", level: 2, hp: 10, element: "octarina" }, protectedTurns: 1 }], turnNumber: 4, actionsRemaining: 1 }, players: [publicPlayer({ ...players[0], connected: true, hp: 13, mana: 2, handSize: 3 }), publicPlayer({ ...players[1], connected: true, hp: 7, mana: 1, handSize: 4 })] }),
      event(5, "match.finished", { status: "finished", board: { ...baseState.board, edges: [edgeOne, edgeTwo], cells: [{ id: "0,0", x: 0, y: 0, ownerId: "kael-player", provinceId: "province-1" }], provinces: [{ id: "province-1", ownerId: "kael-player", cellIds: ["0,0"], unit: { kind: "fortress", level: 2, hp: 10, element: "octarina" }, protectedTurns: 1 }], turnNumber: 5, actionsRemaining: 0 }, matchResult: { winnerPlayerId: "kael-player", loserPlayerId: "rival-player", reason: "territory", finishedAt: 1_720_000_050_000 } }),
    ],
  };
}
