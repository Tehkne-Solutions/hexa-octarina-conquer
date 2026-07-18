import { randomUUID } from "node:crypto";

import { GameRoom } from "./game-room.js";
import { ProtocolError } from "./protocol.js";

export class RoomManager {
  constructor({ idFactory = randomUUID, clock = () => Date.now() } = {}) {
    this.idFactory = idFactory;
    this.clock = clock;
    this.rooms = new Map();
  }

  createRoom({ playerName, boardSize }) {
    const roomId = this.createRoomId();
    const room = new GameRoom({ id: roomId, boardSize, idFactory: this.idFactory, clock: this.clock });
    this.rooms.set(roomId, room);
    const joined = room.addPlayer(playerName);
    return { room, ...joined };
  }

  joinRoom({ roomId, playerName }) {
    const room = this.getRoom(roomId);
    const joined = room.addPlayer(playerName);
    return { room, ...joined };
  }

  reconnect(payload) {
    const room = this.getRoom(payload.roomId);
    return { room, ...room.reconnect(payload) };
  }

  applyCommand(command) {
    const room = this.getRoom(command.payload.roomId);
    const patch = room.applyCommand(command);
    return { room, patch };
  }

  disconnect(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const patch = room.disconnect(playerId);
    return patch ? { room, patch } : null;
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
