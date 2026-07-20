import { randomUUID } from "node:crypto";

import { runCampaignAI } from "./campaign-ai.js";
import { getCampaignMission } from "./campaign-catalog.js";
import { GameRoom } from "./game-room.js";
import { ProtocolError } from "./protocol.js";

export class DistributedRoomManager {
  constructor({ idFactory = randomUUID, clock = () => Date.now(), store }) {
    if (!store?.loadRoom || !store?.saveRoom) {
      throw new Error("DistributedRoomManager requires a distributed room store");
    }
    this.idFactory = idFactory;
    this.clock = clock;
    this.store = store;
    this.rooms = new Map();
  }

  async createRoom({ playerName, boardSize, accountId = null, roomId = null }) {
    const resolvedRoomId = roomId ?? await this.createRoomId();
    if (await this.store.loadRoom(resolvedRoomId)) {
      throw new ProtocolError("ROOM_EXISTS", "room already exists");
    }
    const room = new GameRoom({ id: resolvedRoomId, boardSize, idFactory: this.idFactory, clock: this.clock });
    const joined = room.addPlayer(playerName, { accountId });
    await this.store.saveRoom(room, { expectedRevision: null });
    this.rooms.set(room.id, room);
    return { room, ...joined, followUpPatches: [] };
  }

  async createCampaignRoom({ playerName, accountId = null, missionId }) {
    const mission = getCampaignMission(missionId);
    let roomId;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      roomId = `C${mission.order.toString().padStart(2, "0")}${(await this.createRoomId()).slice(0, 5)}`;
      if (!(await this.store.loadRoom(roomId))) break;
    }
    const room = new GameRoom({
      id: roomId,
      mode: "campaign",
      boardSize: mission.boardSize,
      idFactory: this.idFactory,
      clock: this.clock,
    });
    const human = room.addPlayer(playerName, { accountId }).player;
    const bot = room.addBot(mission.aiName, { difficulty: mission.difficulty }).player;
    const patch = room.startCampaign({ missionId, humanPlayerId: human.id, botPlayerId: bot.id });
    await this.store.saveRoom(room, { expectedRevision: null });
    this.rooms.set(room.id, room);
    return { room, player: human, patch, followUpPatches: [] };
  }

  async joinRoom({ roomId, playerName, accountId = null }) {
    const room = await this.getRoom(roomId);
    const expectedRevision = room.revision;
    const joined = room.addPlayer(playerName, { accountId });
    await this.store.saveRoom(room, { expectedRevision });
    this.rooms.set(room.id, room);
    return { room, ...joined, followUpPatches: [] };
  }

  async reconnect(payload) {
    const room = await this.getRoom(payload.roomId);
    const expectedRevision = room.revision;
    const result = room.reconnect(payload);
    if (room.revision !== expectedRevision) {
      await this.store.saveRoom(room, { expectedRevision });
    }
    this.rooms.set(room.id, room);
    return { room, ...result };
  }

  async applyCommand(command) {
    const room = await this.getRoom(command.payload.roomId);
    const expectedRevision = room.revision;
    const patch = room.applyCommand(command);
    const followUpPatches = runCampaignAI(room);
    await this.store.saveRoom(room, { expectedRevision });
    this.rooms.set(room.id, room);
    return { room, patch, followUpPatches };
  }

  async disconnect(roomId, playerId) {
    const raw = await this.store.loadRoom(roomId);
    if (!raw) return null;
    const room = this.restore(raw);
    const expectedRevision = room.revision;
    const patch = room.disconnect(playerId);
    if (!patch) return null;
    await this.store.saveRoom(room, { expectedRevision });
    this.rooms.set(room.id, room);
    return { room, patch };
  }

  async expireDisconnect(roomId, playerId) {
    const raw = await this.store.loadRoom(roomId);
    if (!raw) return null;
    const room = this.restore(raw);
    if (room.status === "finished") return null;
    const expectedRevision = room.revision;
    let patch;
    if (room.status === "active" && room.players.length === 2) {
      patch = room.forfeitPlayer(playerId, "abandonment", { disconnect: true });
    } else {
      patch = room.disconnect(playerId);
    }
    if (!patch) return null;
    await this.store.saveRoom(room, { expectedRevision });
    this.rooms.set(room.id, room);
    return { room, patch };
  }

  async listRooms({ status, mode } = {}) {
    const records = await this.store.loadRooms();
    const rooms = [];
    for (const record of records) {
      try {
        const room = this.restore(record);
        this.rooms.set(room.id, room);
        if ((!status || room.status === status) && (!mode || room.mode === mode)) rooms.push(room);
      } catch (error) {
        console.error(`Failed to restore distributed room ${record?.id ?? "unknown"}:`, error);
      }
    }
    return rooms
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((room) => room.lobbySummary());
  }

  async removeRoom(roomId) {
    this.rooms.delete(roomId);
    await this.store.deleteRoom(roomId);
    return true;
  }

  async getRoom(roomId) {
    const raw = await this.store.loadRoom(roomId);
    if (!raw) throw new ProtocolError("ROOM_NOT_FOUND", "room does not exist");
    const room = this.restore(raw);
    this.rooms.set(room.id, room);
    return room;
  }

  restore(record) {
    return GameRoom.restore(record, { idFactory: this.idFactory, clock: this.clock });
  }

  async createRoomId() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const roomId = this.idFactory().replaceAll("-", "").slice(0, 8).toUpperCase();
      if (!(await this.store.loadRoom(roomId))) return roomId;
    }
    throw new ProtocolError("ROOM_ID_EXHAUSTED", "could not allocate a unique room id");
  }
}
