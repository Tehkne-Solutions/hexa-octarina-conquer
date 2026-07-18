import pg from "pg";

const { Pool } = pg;
const DEFAULT_RECONNECT_GRACE_MS = 60_000;

function leaseKey(roomId, playerId) {
  return `${roomId}:${playerId}`;
}

function replaySummary(room) {
  return {
    roomId: room.id,
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    finishedAt: room.matchResult?.finishedAt ?? null,
    latestRevision: room.revision,
    players: room.publicPlayers().map((player) => ({
      id: player.id,
      name: player.name,
      accountLinked: player.accountLinked,
    })),
    result: room.publicMatchResult(),
  };
}

function normalizeReplayEvent(entry) {
  return {
    roomId: entry.roomId,
    revision: Number(entry.revision),
    eventId: entry.eventId,
    eventType: entry.eventType,
    occurredAt: Number(entry.occurredAt),
    patch: structuredClone(entry.patch),
  };
}

export class MemoryResilienceStore {
  constructor({ clock = () => Date.now(), reconnectGraceMs = Number(process.env.HEXA_RECONNECT_GRACE_MS ?? DEFAULT_RECONNECT_GRACE_MS) } = {}) {
    this.kind = "memory";
    this.clock = clock;
    this.reconnectGraceMs = reconnectGraceMs;
    this.leases = new Map();
    this.replays = new Map();
  }

  async scheduleDisconnect({ roomId, playerId, accountId = null, sourceInstanceId = null, deadlineAt = this.clock() + this.reconnectGraceMs }) {
    const lease = {
      roomId,
      playerId,
      accountId,
      sourceInstanceId,
      createdAt: this.clock(),
      deadlineAt,
    };
    this.leases.set(leaseKey(roomId, playerId), lease);
    return { ...lease };
  }

  async cancelDisconnect(roomId, playerId) {
    return { cancelled: this.leases.delete(leaseKey(roomId, playerId)) };
  }

  async claimExpiredDisconnects(limit = 50) {
    const now = this.clock();
    const expired = [...this.leases.values()]
      .filter((lease) => lease.deadlineAt <= now)
      .sort((left, right) => left.deadlineAt - right.deadlineAt)
      .slice(0, limit);
    for (const lease of expired) this.leases.delete(leaseKey(lease.roomId, lease.playerId));
    return expired.map((lease) => ({ ...lease }));
  }

  async listDisconnects(roomId = undefined) {
    return [...this.leases.values()]
      .filter((lease) => !roomId || lease.roomId === roomId)
      .sort((left, right) => left.deadlineAt - right.deadlineAt)
      .map((lease) => ({ ...lease }));
  }

  async appendReplay(room, patch) {
    const current = this.replays.get(room.id) ?? { summary: replaySummary(room), events: new Map() };
    current.summary = replaySummary(room);
    if (patch?.revision && !current.events.has(patch.revision)) {
      current.events.set(patch.revision, normalizeReplayEvent({
        roomId: room.id,
        revision: patch.revision,
        eventId: patch.event?.id ?? `${room.id}:${patch.revision}`,
        eventType: patch.event?.type ?? "room.updated",
        occurredAt: patch.event?.at ?? room.updatedAt,
        patch,
      }));
    }
    this.replays.set(room.id, current);
    return current.summary;
  }

  async listReplays({ limit = 50, status = undefined } = {}) {
    return [...this.replays.values()]
      .map((replay) => structuredClone(replay.summary))
      .filter((summary) => !status || summary.status === status)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, Math.min(200, Math.max(1, limit)));
  }

  async getReplay(roomId, { afterRevision = 0, limit = 500 } = {}) {
    const replay = this.replays.get(roomId);
    if (!replay) return null;
    return {
      ...structuredClone(replay.summary),
      events: [...replay.events.values()]
        .filter((entry) => entry.revision > afterRevision)
        .sort((left, right) => left.revision - right.revision)
        .slice(0, Math.min(2_000, Math.max(1, limit)))
        .map(normalizeReplayEvent),
    };
  }

  async close() {}
}

export class PostgresResilienceStore {
  constructor({ pool, clock = () => Date.now(), reconnectGraceMs = Number(process.env.HEXA_RECONNECT_GRACE_MS ?? DEFAULT_RECONNECT_GRACE_MS) }) {
    this.kind = "postgres";
    this.pool = pool;
    this.clock = clock;
    this.reconnectGraceMs = reconnectGraceMs;
  }

  static async connect({ connectionString = process.env.DATABASE_URL, clock = () => Date.now() } = {}) {
    if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL resilience storage");
    const pool = new Pool({ connectionString, max: Number(process.env.HEXA_RESILIENCE_PG_POOL_SIZE ?? 6) });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reconnect_leases (
        room_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        account_id TEXT,
        source_instance_id TEXT,
        created_at BIGINT NOT NULL,
        deadline_at BIGINT NOT NULL,
        PRIMARY KEY (room_id, player_id)
      );
      CREATE INDEX IF NOT EXISTS idx_reconnect_leases_deadline
        ON reconnect_leases(deadline_at ASC);

      CREATE TABLE IF NOT EXISTS match_replays (
        room_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        finished_at BIGINT,
        latest_revision INTEGER NOT NULL,
        players JSONB NOT NULL DEFAULT '[]'::jsonb,
        result JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_match_replays_updated
        ON match_replays(updated_at DESC);

      CREATE TABLE IF NOT EXISTS replay_events (
        room_id TEXT NOT NULL REFERENCES match_replays(room_id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        occurred_at BIGINT NOT NULL,
        patch JSONB NOT NULL,
        PRIMARY KEY (room_id, revision),
        UNIQUE (event_id)
      );
      CREATE INDEX IF NOT EXISTS idx_replay_events_room_revision
        ON replay_events(room_id, revision ASC);
    `);
    return new PostgresResilienceStore({ pool, clock });
  }

  async scheduleDisconnect({ roomId, playerId, accountId = null, sourceInstanceId = null, deadlineAt = this.clock() + this.reconnectGraceMs }) {
    const createdAt = this.clock();
    const result = await this.pool.query(`
      INSERT INTO reconnect_leases (
        room_id, player_id, account_id, source_instance_id, created_at, deadline_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (room_id, player_id)
      DO UPDATE SET
        account_id = excluded.account_id,
        source_instance_id = excluded.source_instance_id,
        created_at = excluded.created_at,
        deadline_at = excluded.deadline_at
      RETURNING *
    `, [roomId, playerId, accountId, sourceInstanceId, createdAt, deadlineAt]);
    const row = result.rows[0];
    return {
      roomId: row.room_id,
      playerId: row.player_id,
      accountId: row.account_id,
      sourceInstanceId: row.source_instance_id,
      createdAt: Number(row.created_at),
      deadlineAt: Number(row.deadline_at),
    };
  }

  async cancelDisconnect(roomId, playerId) {
    const result = await this.pool.query(
      "DELETE FROM reconnect_leases WHERE room_id = $1 AND player_id = $2",
      [roomId, playerId],
    );
    return { cancelled: result.rowCount > 0 };
  }

  async claimExpiredDisconnects(limit = 50) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(`
        WITH claimed AS (
          SELECT room_id, player_id
          FROM reconnect_leases
          WHERE deadline_at <= $1
          ORDER BY deadline_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $2
        )
        DELETE FROM reconnect_leases lease
        USING claimed
        WHERE lease.room_id = claimed.room_id AND lease.player_id = claimed.player_id
        RETURNING lease.*
      `, [this.clock(), limit]);
      await client.query("COMMIT");
      return result.rows.map((row) => ({
        roomId: row.room_id,
        playerId: row.player_id,
        accountId: row.account_id,
        sourceInstanceId: row.source_instance_id,
        createdAt: Number(row.created_at),
        deadlineAt: Number(row.deadline_at),
      }));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listDisconnects(roomId = undefined) {
    const result = roomId
      ? await this.pool.query("SELECT * FROM reconnect_leases WHERE room_id = $1 ORDER BY deadline_at ASC", [roomId])
      : await this.pool.query("SELECT * FROM reconnect_leases ORDER BY deadline_at ASC LIMIT 500");
    return result.rows.map((row) => ({
      roomId: row.room_id,
      playerId: row.player_id,
      accountId: row.account_id,
      sourceInstanceId: row.source_instance_id,
      createdAt: Number(row.created_at),
      deadlineAt: Number(row.deadline_at),
    }));
  }

  async appendReplay(room, patch) {
    const summary = replaySummary(room);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO match_replays (
          room_id, status, created_at, updated_at, finished_at, latest_revision, players, result
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
        ON CONFLICT (room_id)
        DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at,
          finished_at = excluded.finished_at,
          latest_revision = GREATEST(match_replays.latest_revision, excluded.latest_revision),
          players = excluded.players,
          result = excluded.result
      `, [
        summary.roomId,
        summary.status,
        summary.createdAt,
        summary.updatedAt,
        summary.finishedAt,
        summary.latestRevision,
        JSON.stringify(summary.players),
        summary.result ? JSON.stringify(summary.result) : null,
      ]);
      if (patch?.revision) {
        await client.query(`
          INSERT INTO replay_events (
            room_id, revision, event_id, event_type, occurred_at, patch
          ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          ON CONFLICT DO NOTHING
        `, [
          room.id,
          patch.revision,
          patch.event?.id ?? `${room.id}:${patch.revision}`,
          patch.event?.type ?? "room.updated",
          patch.event?.at ?? room.updatedAt,
          JSON.stringify(patch),
        ]);
      }
      await client.query("COMMIT");
      return summary;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listReplays({ limit = 50, status = undefined } = {}) {
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    const result = status
      ? await this.pool.query("SELECT * FROM match_replays WHERE status = $1 ORDER BY updated_at DESC LIMIT $2", [status, safeLimit])
      : await this.pool.query("SELECT * FROM match_replays ORDER BY updated_at DESC LIMIT $1", [safeLimit]);
    return result.rows.map((row) => ({
      roomId: row.room_id,
      status: row.status,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      finishedAt: row.finished_at === null ? null : Number(row.finished_at),
      latestRevision: Number(row.latest_revision),
      players: row.players ?? [],
      result: row.result ?? null,
    }));
  }

  async getReplay(roomId, { afterRevision = 0, limit = 500 } = {}) {
    const summaryResult = await this.pool.query("SELECT * FROM match_replays WHERE room_id = $1", [roomId]);
    if (summaryResult.rowCount === 0) return null;
    const safeLimit = Math.min(2_000, Math.max(1, Number(limit) || 500));
    const eventsResult = await this.pool.query(`
      SELECT * FROM replay_events
      WHERE room_id = $1 AND revision > $2
      ORDER BY revision ASC
      LIMIT $3
    `, [roomId, Number(afterRevision) || 0, safeLimit]);
    const row = summaryResult.rows[0];
    return {
      roomId: row.room_id,
      status: row.status,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      finishedAt: row.finished_at === null ? null : Number(row.finished_at),
      latestRevision: Number(row.latest_revision),
      players: row.players ?? [],
      result: row.result ?? null,
      events: eventsResult.rows.map((event) => normalizeReplayEvent({
        roomId: event.room_id,
        revision: event.revision,
        eventId: event.event_id,
        eventType: event.event_type,
        occurredAt: event.occurred_at,
        patch: event.patch,
      })),
    };
  }

  async close() {
    await this.pool.end();
  }
}

export async function createResilienceStore({
  mode = process.env.HEXA_RESILIENCE_STORE ?? (process.env.DATABASE_URL ? "postgres" : "memory"),
} = {}) {
  if (mode === "memory") return new MemoryResilienceStore();
  if (mode === "postgres") return PostgresResilienceStore.connect();
  throw new Error(`Unsupported HEXA_RESILIENCE_STORE mode: ${mode}`);
}
