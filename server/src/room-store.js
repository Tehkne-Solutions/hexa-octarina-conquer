import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export class MemoryRoomStore {
  constructor() {
    this.records = new Map();
  }

  loadRooms() {
    return [...this.records.values()].map((record) => structuredClone(record));
  }

  saveRoom(room) {
    this.records.set(room.id, structuredClone(room.serialize()));
  }

  deleteRoom(roomId) {
    this.records.delete(roomId);
  }
}

export class FileRoomStore {
  constructor({ directory = process.env.HEXA_DATA_DIR ?? resolve(process.cwd(), ".data", "rooms") } = {}) {
    this.directory = directory;
    mkdirSync(this.directory, { recursive: true });
  }

  pathFor(roomId) {
    const safeId = roomId.replace(/[^A-Z0-9_-]/gi, "_");
    return join(this.directory, `${safeId}.json`);
  }

  loadRooms() {
    if (!existsSync(this.directory)) return [];
    const rooms = [];
    for (const filename of readdirSync(this.directory).filter((name) => name.endsWith(".json"))) {
      try {
        const raw = JSON.parse(readFileSync(join(this.directory, filename), "utf8"));
        rooms.push(raw);
      } catch (error) {
        const brokenPath = join(this.directory, `${filename}.broken-${Date.now()}`);
        renameSync(join(this.directory, filename), brokenPath);
        console.error(`Quarantined invalid room snapshot ${filename}:`, error);
      }
    }
    return rooms;
  }

  saveRoom(room) {
    mkdirSync(this.directory, { recursive: true });
    const target = this.pathFor(room.id);
    const temporary = `${target}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(room.serialize(), null, 2)}\n`, "utf8");
    renameSync(temporary, target);
  }

  deleteRoom(roomId) {
    rmSync(this.pathFor(roomId), { force: true });
  }
}
