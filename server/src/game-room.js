import { randomUUID } from "node:crypto";

import { BoardState } from "./board-state.js";
import { STARTER_HAND } from "./cards.js";
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
  }

  addPlayer(playerName) {
    if (this.players.length >= 2) throw new ProtocolError("ROOM_FULL", "room already has two players");
    const normalizedName = playerName.trim();
    if (this.players.some((player) => player.name.toLowerCase() === normalizedName.toLowerCase())) {
      throw new ProtocolError("DUPLICATE_PLAYER_NAME", "player name is already used in this room");
    }

    const player = {
      id: this.idFactory(),
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
    const patch = this.commit("player.joined", { playerId: player.id, playerName: player.name, status: this.status });
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
    const player = this.authenticate(playerId, sessionToken);
    const patches = this.patchesSince(lastRevision);
    return {
      player,
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
    const patch = {
      roomId: this.id,
      revision: this.revision,
      event: {
        id: `${this.id}:${this.revision}`,
        type: eventType,
        at: this.clock(),
        payload,
      },
      state: {
        status: this.status,
        board: this.board.snapshot(),
        players: this.publicPlayers(),
        duels: [...this.duels.values()].map(duelSnapshot),
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
      mana: player.mana,
      hp: player.hp,
      handSize: player.hand.length,
    }));
  }

  snapshot() {
    return {
      roomId: this.id,
      revision: this.revision,
      status: this.status,
      board: this.board.snapshot(),
      players: this.publicPlayers(),
      duels: [...this.duels.values()].map(duelSnapshot),
    };
  }
}
