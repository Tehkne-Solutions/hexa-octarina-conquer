import { randomUUID } from "node:crypto";

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
    return { room, ...joined };
  }

  joinRoom({ roomId, playerName, accountId = null }) {
    const room = this.getRoom(roomId);
    const joined = room.addPlayer(playerName, { accountId });
    this.persist(room);
    return { room, ...joined };
  }

  reconnect(payload) {
    const room = this.getRoom(payload.roomId);
    const result = room.reconnect(payload);
    this.persist(room);
    return { room, ...result };
  }

  applyCommand(command) {
    const room = this.getRoom(command.payload.roomId);
    const patch = room.applyCommand(command);
    this.persist(room);
    return { room, patch };
  }

  disconnect(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const patch = room.disconnect(playerId);
    if (patch) this.persist(room);
    return patch ? { room, patch } : null;
  }

  listRooms({ status } = {}) {
    return [...this.rooms.values()]
      .filter((room) => !status || room.status === status)
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
