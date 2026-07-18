import { randomUUID } from "node:crypto";

import { BoardState } from "./board-state.js";
import { STARTER_HAND, cardSnapshot } from "./cards.js";
import { duelSnapshot } from "./duel-engine.js";
import { ProtocolError } from "./protocol.js";
import { RoomActions } from "./room-actions.js";

export class GameRoom extends RoomActions {
  constructor({ id, boardSize = 5, idFactory = randomUUID, clock = () => Date.now() }) {
    super();
    this.id = id;
    this.idFactory = idFactory;
    this.clock = clock;
    this.status = "waiting";
    this.revision = 0;
    this.players = [];
    this.board = new BoardState(boardSize);
    this.duels = new Map();
    this.nextDuelId = 1;
    this.usedMacroTurns = new Set();
    this.patchLog = [];
    this.matchResult = null;
    this.createdAt = this.clock();
    this.updatedAt = this.createdAt;
  }

  addPlayer(playerName, { accountId = null } = {}) {
    if (this.players.length >= 2) throw new ProtocolError("ROOM_FULL", "room already has two players");
    const normalizedName = playerName.trim();
    if (this.players.some((player) => player.name.toLowerCase() === normalizedName.toLowerCase())) {
      throw new ProtocolError("DUPLICATE_PLAYER_NAME", "player name is already used in this room");
    }
    if (accountId && this.players.some((player) => player.accountId === accountId)) {
      throw new ProtocolError("ACCOUNT_ALREADY_IN_ROOM", "this account already participates in the room");
    }

    const player = {
      id: this.idFactory(),
      accountId,
      sessionToken: this.idFactory(),
      name: normalizedName,
      connected: true,
      lastSeenAt: this.clock(),
      mana: 5,
      hp: 20,
      hand: [...STARTER_HAND],
    };
    this.players.push(player);
    this.board.setPlayerOrder(this.players.map((item) => item.id));
    if (this.players.length === 2) this.status = "active";
    const patch = this.commit("player.joined", {
      playerId: player.id,
      playerName: player.name,
      accountLinked: Boolean(player.accountId),
      status: this.status,
    });
    return { player, patch };
  }

  authenticate(playerId, sessionToken) {
    const player = this.players.find((item) => item.id === playerId);
    if (!player || player.sessionToken !== sessionToken) {
      throw new ProtocolError("INVALID_SESSION", "player credentials are invalid");
    }
    player.connected = true;
    player.lastSeenAt = this.clock();
    return player;
  }

  reconnect({ playerId, sessionToken, lastRevision = 0 }) {
    const existing = this.players.find((item) => item.id === playerId);
    const wasConnected = existing?.connected ?? false;
    const player = this.authenticate(playerId, sessionToken);
    const connectionPatch = wasConnected ? null : this.commit("player.reconnected", { playerId });
    const patches = this.patchesSince(lastRevision);
    return {
      player,
      connectionPatch,
      privateState: this.privateStateFor(player.id),
      mode: patches === null ? "snapshot" : "patches",
      snapshot: patches === null ? this.snapshot() : undefined,
      patches: patches ?? undefined,
    };
  }

  disconnect(playerId) {
    const player = this.players.find((item) => item.id === playerId);
    if (!player || !player.connected) return null;
    player.connected = false;
    player.lastSeenAt = this.clock();
    return this.commit("player.disconnected", { playerId });
  }

  assertRevision(expectedRevision) {
    if (expectedRevision !== this.revision) {
      throw new ProtocolError("REVISION_CONFLICT", "client state is stale", {
        expectedRevision,
        currentRevision: this.revision,
      });
    }
  }

  commit(eventType, payload) {
    this.revision += 1;
    this.updatedAt = this.clock();
    const patch = {
      roomId: this.id,
      revision: this.revision,
      event: {
        id: `${this.id}:${this.revision}`,
        type: eventType,
        at: this.updatedAt,
        payload,
      },
      state: {
        status: this.status,
        board: this.board.snapshot(),
        players: this.publicPlayers(),
        duels: [...this.duels.values()].map(duelSnapshot),
        matchResult: this.publicMatchResult(),
      },
    };
    this.patchLog.push(patch);
    this.patchLog = this.patchLog.slice(-100);
    return patch;
  }

  patchesSince(lastRevision) {
    if (lastRevision === this.revision) return [];
    const firstAvailable = this.patchLog[0]?.revision ?? this.revision;
    if (lastRevision < firstAvailable - 1) return null;
    return this.patchLog.filter((patch) => patch.revision > lastRevision);
  }

  publicPlayers() {
    return this.players.map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      accountLinked: Boolean(player.accountId),
      mana: player.mana,
      hp: player.hp,
      handSize: player.hand.length,
    }));
  }

  publicMatchResult() {
    if (!this.matchResult) return null;
    return {
      winnerPlayerId: this.matchResult.winnerPlayerId,
      loserPlayerId: this.matchResult.loserPlayerId,
      reason: this.matchResult.reason,
      finishedAt: this.matchResult.finishedAt,
    };
  }

  privateStateFor(playerId) {
    const player = this.players.find((item) => item.id === playerId);
    if (!player) throw new ProtocolError("PLAYER_NOT_FOUND", "player does not exist in this room");
    const duelSubmissions = {};
    for (const duel of this.duels.values()) {
      if (duel.submissions?.[playerId]) duelSubmissions[duel.id] = [...duel.submissions[playerId]];
    }
    return {
      roomId: this.id,
      revision: this.revision,
      playerId: player.id,
      accountId: player.accountId,
      name: player.name,
      mana: player.mana,
      hp: player.hp,
      hand: player.hand.map(cardSnapshot),
      duelSubmissions,
    };
  }

  lobbySummary() {
    return {
      roomId: this.id,
      status: this.status,
      boardSize: this.board.size,
      playerCount: this.players.length,
      players: this.players.map((player) => ({
        name: player.name,
        connected: player.connected,
        accountLinked: Boolean(player.accountId),
      })),
      revision: this.revision,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  snapshot() {
    return {
      roomId: this.id,
      revision: this.revision,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      board: this.board.snapshot(),
      players: this.publicPlayers(),
      duels: [...this.duels.values()].map(duelSnapshot),
      matchResult: this.publicMatchResult(),
    };
  }

  serialize() {
    return {
      schemaVersion: 2,
      id: this.id,
      status: this.status,
      revision: this.revision,
      players: this.players.map((player) => ({ ...player, hand: [...player.hand] })),
      board: this.board.serialize(),
      duels: [...this.duels.values()],
      nextDuelId: this.nextDuelId,
      usedMacroTurns: [...this.usedMacroTurns],
      patchLog: this.patchLog,
      matchResult: this.matchResult,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static restore(raw, { idFactory = randomUUID, clock = () => Date.now() } = {}) {
    if (!raw || ![1, 2].includes(raw.schemaVersion)) {
      throw new ProtocolError("INVALID_ROOM_DATA", "unsupported persisted room schema");
    }
    const room = new GameRoom({
      id: raw.id,
      boardSize: raw.board?.boardSize ?? 5,
      idFactory,
      clock,
    });
    room.status = raw.status;
    room.revision = raw.revision;
    room.players = (raw.players ?? []).map((player) => ({
      ...player,
      accountId: player.accountId ?? null,
      connected: false,
      hand: [...player.hand],
    }));
    room.board = BoardState.fromJSON(raw.board);
    room.duels = new Map((raw.duels ?? []).map((duel) => [duel.id, duel]));
    room.nextDuelId = raw.nextDuelId ?? 1;
    room.usedMacroTurns = new Set(raw.usedMacroTurns ?? []);
    room.patchLog = raw.patchLog ?? [];
    room.matchResult = raw.matchResult ?? null;
    room.createdAt = raw.createdAt ?? room.createdAt;
    room.updatedAt = raw.updatedAt ?? room.updatedAt;
    return room;
  }
}
