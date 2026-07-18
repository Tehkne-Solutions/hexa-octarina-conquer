import pg from "pg";

import { ProtocolError } from "./protocol.js";

const { Pool } = pg;

export class PostgresRoomStore {
  constructor({ pool, clock = () => Date.now() }) {
    this.kind = "postgres";
    this.pool = pool;
    this.clock = clock;
  }

  static async connect({ connectionString = process.env.DATABASE_URL, clock = () => Date.now() } = {}) {
    if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL room storage");
    const pool = new Pool({
      connectionString,
      max: Number(process.env.HEXA_ROOM_PG_POOL_SIZE ?? process.env.HEXA_PG_POOL_SIZE ?? 10),
    });
    const store = new PostgresRoomStore({ pool, clock });
    await store.migrate();
    return store;
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS distributed_rooms (
        id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        updated_at BIGINT NOT NULL,
        payload JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS distributed_room_events (
        event_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL REFERENCES distributed_rooms(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        type TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        payload JSONB NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_distributed_room_revision
        ON distributed_room_events(room_id, revision);
      CREATE INDEX IF NOT EXISTS idx_distributed_rooms_status_updated
        ON distributed_rooms(status, updated_at DESC);
    `);
  }

  async loadRooms() {
    const result = await this.pool.query("SELECT payload FROM distributed_rooms ORDER BY updated_at ASC");
    return result.rows.map((row) => structuredClone(row.payload));
  }

  async loadRoom(roomId) {
    const result = await this.pool.query("SELECT payload FROM distributed_rooms WHERE id = $1", [roomId]);
    return result.rows[0] ? structuredClone(result.rows[0].payload) : null;
  }

  async saveRoom(room, { expectedRevision = null } = {}) {
    const serialized = room.serialize();
    const latestPatch = room.patchLog.at(-1);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        "SELECT revision FROM distributed_rooms WHERE id = $1 FOR UPDATE",
        [room.id],
      );

      if (existing.rowCount === 0) {
        if (expectedRevision !== null && expectedRevision !== 0) {
          throw new ProtocolError("ROOM_WRITE_CONFLICT", "room disappeared before it could be saved", {
            roomId: room.id,
            expectedRevision,
          });
        }
        await client.query(`
          INSERT INTO distributed_rooms (id, revision, status, updated_at, payload)
          VALUES ($1, $2, $3, $4, $5::jsonb)
        `, [room.id, room.revision, room.status, room.updatedAt, JSON.stringify(serialized)]);
      } else {
        const currentRevision = Number(existing.rows[0].revision);
        if (expectedRevision === null || currentRevision !== expectedRevision) {
          throw new ProtocolError("ROOM_WRITE_CONFLICT", "another server changed the room first", {
            roomId: room.id,
            expectedRevision,
            currentRevision,
          });
        }
        await client.query(`
          UPDATE distributed_rooms
          SET revision = $2, status = $3, updated_at = $4, payload = $5::jsonb
          WHERE id = $1
        `, [room.id, room.revision, room.status, room.updatedAt, JSON.stringify(serialized)]);
      }

      if (latestPatch?.event) {
        await client.query(`
          INSERT INTO distributed_room_events (
            event_id, room_id, revision, type, created_at, payload
          ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          ON CONFLICT (event_id) DO NOTHING
        `, [
          latestPatch.event.id,
          room.id,
          latestPatch.revision,
          latestPatch.event.type,
          latestPatch.event.at,
          JSON.stringify(latestPatch.event.payload ?? {}),
        ]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteRoom(roomId) {
    await this.pool.query("DELETE FROM distributed_rooms WHERE id = $1", [roomId]);
  }

  async countEvents(roomId) {
    const result = await this.pool.query(
      "SELECT COUNT(*)::integer AS total FROM distributed_room_events WHERE room_id = $1",
      [roomId],
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async close() {
    await this.pool.end();
  }
}
