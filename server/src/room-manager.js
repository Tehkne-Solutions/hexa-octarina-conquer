import { randomUUID } from "node:crypto";

import { runCampaignAI } from "./campaign-ai.js";
import { getCampaignMission } from "./campaign-catalog.js";
import { GameRoom } from "./game-room.js";
import { ProtocolError } from "./protocol.js";
import { MemoryRoomStore } from "./room-store.js";

export class RoomManager {
  constructor({ idFactory = randomUUID, clock = () => Date.now(), store = new MemoryRoomStore() } = {}) {
    this.idFactory = idFactory;
    this.clock = clock;
    this.store = store;
    this.rooms = new Map();
    for (const record of this.store.loadRooms()) {
      try {
        const room = GameRoom.restore(record, { idFactory: this.idFactory, clock: this.clock });
        this.rooms.set(room.id, room);
      } catch (error) {
        console.error(`Failed to restore room ${record?.id ?? "unknown"}:`, error);
      }
    }
  }

  createRoom({ playerName, boardSize, accountId = null, roomId = null }) {
    const resolvedRoomId = roomId ?? this.createRoomId();
    if (this.rooms.has(resolvedRoomId)) throw new ProtocolError("ROOM_EXISTS", "room already exists");
    const room = new GameRoom({ id: resolvedRoomId, boardSize, idFactory: this.idFactory, clock: this.clock });
    this.rooms.set(resolvedRoomId, room);
    const joined = room.addPlayer(playerName, { accountId });
    this.persist(room);
    return { room, ...joined, followUpPatches: [] };
  }

  createCampaignRoom({ playerName, accountId = null, missionId }) {
    const mission = getCampaignMission(missionId);
    const roomId = `C${mission.order.toString().padStart(2, "0")}${this.createRoomId().slice(0, 5)}`;
    const room = new GameRoom({
      id: roomId,
      mode: "campaign",
      boardSize: mission.boardSize,
      idFactory: this.idFactory,
      clock: this.clock,
    });
    this.rooms.set(roomId, room);
    const human = room.addPlayer(playerName, { accountId }).player;
    const bot = room.addBot(mission.aiName, { difficulty: mission.difficulty }).player;
    const patch = room.startCampaign({ missionId, humanPlayerId: human.id, botPlayerId: bot.id });
    this.persist(room);
    return { room, player: human, patch, followUpPatches: [] };
  }

  joinRoom({ roomId, playerName, accountId = null }) {
    const room = this.getRoom(roomId);
    const joined = room.addPlayer(playerName, { accountId });
    this.persist(room);
    return { room, ...joined, followUpPatches: [] };
  }

  reconnect(payload) {
    const room = this.getRoom(payload.roomId);
    const result = room.reconnect(payload);
    this.persist(room);
    return { room, ...result };
  }

  applyCommand(command) {
    const room = this.getRoom(command.payload.roomId);
    const humanPatch = room.applyCommand(command);
    const followUpPatches = runCampaignAI(room);
    const patch = followUpPatches.at(-1) ?? humanPatch;
    this.persist(room);
    return { room, patch, humanPatch, followUpPatches };
  }

  disconnect(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const patch = room.disconnect(playerId);
    if (patch) this.persist(room);
    return patch ? { room, patch } : null;
  }

  expireDisconnect(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status === "finished") return null;
    let patch;
    if (room.status === "active" && room.players.length === 2) {
      patch = room.forfeitPlayer(playerId, "abandonment", { disconnect: true });
    } else {
      patch = room.disconnect(playerId);
    }
    if (patch) this.persist(room);
    return patch ? { room, patch } : null;
  }

  listRooms({ status, mode } = {}) {
    return [...this.rooms.values()]
      .filter((room) => (!status || room.status === status) && (!mode || room.mode === mode))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((room) => room.lobbySummary());
  }

  removeRoom(roomId) {
    const existed = this.rooms.delete(roomId);
    if (existed) this.store.deleteRoom(roomId);
    return existed;
  }

  persist(room) {
    this.store.saveRoom(room);
  }

  getRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) throw new ProtocolError("ROOM_NOT_FOUND", "room does not exist");
    return room;
  }

  createRoomId() {
    let roomId;
    do {
      roomId = this.idFactory().replaceAll("-", "").slice(0, 8).toUpperCase();
    } while (this.rooms.has(roomId));
    return roomId;
  }
}
