import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export class MemoryRoomStore {
  constructor() {
    this.kind = "memory";
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

  close() {}
}

export class FileRoomStore {
  constructor({ directory = process.env.HEXA_DATA_DIR ?? resolve(process.cwd(), ".data", "rooms") } = {}) {
    this.kind = "files";
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

  close() {}
}

export class SqliteRoomStore {
  constructor({ filename = process.env.HEXA_DB_PATH ?? resolve(process.cwd(), ".data", "hexa-octarina.sqlite") } = {}) {
    this.kind = "sqlite";
    this.filename = filename;
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename, { timeout: 5_000 });
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS room_events (
        event_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        payload TEXT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_room_events_room_revision
        ON room_events(room_id, revision);
    `);
    this.selectRooms = this.database.prepare("SELECT payload FROM rooms ORDER BY updated_at ASC");
    this.upsertRoom = this.database.prepare(`
      INSERT INTO rooms (id, revision, status, updated_at, payload)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        revision = excluded.revision,
        status = excluded.status,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `);
    this.insertEvent = this.database.prepare(`
      INSERT OR IGNORE INTO room_events (event_id, room_id, revision, type, created_at, payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.deleteRoomStatement = this.database.prepare("DELETE FROM rooms WHERE id = ?");
  }

  loadRooms() {
    const rooms = [];
    for (const row of this.selectRooms.all()) {
      try {
        rooms.push(JSON.parse(row.payload));
      } catch (error) {
        console.error("Ignoring invalid SQLite room snapshot:", error);
      }
    }
    return rooms;
  }

  saveRoom(room) {
    const serialized = room.serialize();
    const latestPatch = room.patchLog.at(-1);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.upsertRoom.run(
        room.id,
        room.revision,
        room.status,
        room.updatedAt,
        JSON.stringify(serialized),
      );
      if (latestPatch?.event) {
        this.insertEvent.run(
          latestPatch.event.id,
          room.id,
          latestPatch.revision,
          latestPatch.event.type,
          latestPatch.event.at,
          JSON.stringify(latestPatch.event.payload ?? {}),
        );
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  deleteRoom(roomId) {
    this.deleteRoomStatement.run(roomId);
  }

  countEvents(roomId) {
    return this.database.prepare("SELECT COUNT(*) AS total FROM room_events WHERE room_id = ?").get(roomId).total;
  }

  close() {
    if (this.database.isOpen) this.database.close();
  }
}

export function createRoomStore({ mode = process.env.HEXA_STORE ?? "sqlite" } = {}) {
  if (mode === "memory") return new MemoryRoomStore();
  if (mode === "files") return new FileRoomStore();
  if (mode === "sqlite") return new SqliteRoomStore();
  throw new Error(`Unsupported HEXA_STORE mode: ${mode}`);
}
