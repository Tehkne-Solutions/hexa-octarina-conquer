import { randomUUID } from "node:crypto";

import pg from "pg";

const { Pool } = pg;
const DEFAULT_TTL_MS = 45_000;

function memoryKey(instanceId, roomId, playerId) {
  return `${instanceId}:${roomId}:${playerId}`;
}

export class MemoryPresenceStore {
  constructor({ instanceId = `instance-${randomUUID()}`, clock = () => Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
    this.kind = "memory";
    this.instanceId = instanceId;
    this.clock = clock;
    this.ttlMs = ttlMs;
    this.instances = new Map();
    this.players = new Map();
  }

  async heartbeatInstance(metadata = {}) {
    const previous = this.instances.get(this.instanceId);
    const now = this.clock();
    this.instances.set(this.instanceId, {
      instanceId: this.instanceId,
      startedAt: previous?.startedAt ?? now,
      lastSeen: now,
      metadata: structuredClone(metadata),
    });
  }

  async markOnline({ roomId, playerId, accountId = null }) {
    const now = this.clock();
    const key = memoryKey(this.instanceId, roomId, playerId);
    const previous = this.players.get(key);
    this.players.set(key, {
      instanceId: this.instanceId,
      roomId,
      playerId,
      accountId,
      connectedAt: previous?.connectedAt ?? now,
      lastSeen: now,
    });
  }

  async heartbeatPlayer({ roomId, playerId }) {
    const key = memoryKey(this.instanceId, roomId, playerId);
    const current = this.players.get(key);
    if (current) current.lastSeen = this.clock();
  }

  async markOffline({ roomId, playerId }) {
    return this.players.delete(memoryKey(this.instanceId, roomId, playerId));
  }

  async listRoom(roomId) {
    const cutoff = this.clock() - this.ttlMs;
    const grouped = new Map();
    for (const presence of this.players.values()) {
      if (presence.roomId !== roomId || presence.lastSeen <= cutoff) continue;
      const current = grouped.get(presence.playerId) ?? {
        roomId,
        playerId: presence.playerId,
        accountId: presence.accountId,
        online: true,
        lastSeen: 0,
        instances: [],
      };
      current.lastSeen = Math.max(current.lastSeen, presence.lastSeen);
      if (!current.instances.includes(presence.instanceId)) current.instances.push(presence.instanceId);
      grouped.set(presence.playerId, current);
    }
    return [...grouped.values()].sort((left, right) => left.playerId.localeCompare(right.playerId));
  }

  async summary() {
    const cutoff = this.clock() - this.ttlMs;
    const instances = [...this.instances.values()].filter((item) => item.lastSeen > cutoff);
    const players = [...this.players.values()].filter((item) => item.lastSeen > cutoff);
    return {
      activeInstances: instances.length,
      activePlayers: new Set(players.map((item) => `${item.roomId}:${item.playerId}`)).size,
    };
  }

  async prune() {
    const cutoff = this.clock() - this.ttlMs;
    let removed = 0;
    for (const [key, item] of this.players) {
      if (item.lastSeen <= cutoff) {
        this.players.delete(key);
        removed += 1;
      }
    }
    for (const [key, item] of this.instances) {
      if (item.lastSeen <= cutoff) this.instances.delete(key);
    }
    return removed;
  }

  async close() {
    this.players.clear();
    this.instances.clear();
  }
}

export class PostgresPresenceStore {
  constructor({ pool, instanceId, clock = () => Date.now(), ttlMs = DEFAULT_TTL_MS }) {
    this.kind = "postgres";
    this.pool = pool;
    this.instanceId = instanceId;
    this.clock = clock;
    this.ttlMs = ttlMs;
  }

  static async connect({
    connectionString = process.env.DATABASE_URL,
    instanceId = process.env.HEXA_INSTANCE_ID ?? `instance-${randomUUID()}`,
    clock = () => Date.now(),
    ttlMs = Number(process.env.HEXA_PRESENCE_TTL_MS ?? DEFAULT_TTL_MS),
  } = {}) {
    if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL presence storage");
    const pool = new Pool({ connectionString, max: Number(process.env.HEXA_PRESENCE_PG_POOL_SIZE ?? 4) });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cluster_instances (
        instance_id TEXT PRIMARY KEY,
        started_at BIGINT NOT NULL,
        last_seen BIGINT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE TABLE IF NOT EXISTS player_presence (
        instance_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        account_id TEXT,
        connected_at BIGINT NOT NULL,
        last_seen BIGINT NOT NULL,
        PRIMARY KEY (instance_id, room_id, player_id)
      );
      CREATE INDEX IF NOT EXISTS idx_player_presence_room_seen ON player_presence(room_id, last_seen DESC);
      CREATE INDEX IF NOT EXISTS idx_cluster_instances_seen ON cluster_instances(last_seen DESC);
    `);
    return new PostgresPresenceStore({ pool, instanceId, clock, ttlMs });
  }

  async heartbeatInstance(metadata = {}) {
    const now = this.clock();
    await this.pool.query(`
      INSERT INTO cluster_instances (instance_id, started_at, last_seen, metadata)
      VALUES ($1, $2, $2, $3::jsonb)
      ON CONFLICT (instance_id) DO UPDATE SET
        last_seen = excluded.last_seen,
        metadata = excluded.metadata
    `, [this.instanceId, now, JSON.stringify(metadata)]);
  }

  async markOnline({ roomId, playerId, accountId = null }) {
    const now = this.clock();
    await this.pool.query(`
      INSERT INTO player_presence (instance_id, room_id, player_id, account_id, connected_at, last_seen)
      VALUES ($1, $2, $3, $4, $5, $5)
      ON CONFLICT (instance_id, room_id, player_id) DO UPDATE SET
        account_id = excluded.account_id,
        last_seen = excluded.last_seen
    `, [this.instanceId, roomId, playerId, accountId, now]);
  }

  async heartbeatPlayer({ roomId, playerId }) {
    await this.pool.query(`
      UPDATE player_presence SET last_seen = $4
      WHERE instance_id = $1 AND room_id = $2 AND player_id = $3
    `, [this.instanceId, roomId, playerId, this.clock()]);
  }

  async markOffline({ roomId, playerId }) {
    const result = await this.pool.query(`
      DELETE FROM player_presence WHERE instance_id = $1 AND room_id = $2 AND player_id = $3
    `, [this.instanceId, roomId, playerId]);
    return result.rowCount > 0;
  }

  async listRoom(roomId) {
    const result = await this.pool.query(`
      SELECT player_id, MAX(account_id) AS account_id, MAX(last_seen) AS last_seen,
        ARRAY_AGG(DISTINCT instance_id ORDER BY instance_id) AS instances
      FROM player_presence
      WHERE room_id = $1 AND last_seen > $2
      GROUP BY player_id
      ORDER BY player_id
    `, [roomId, this.clock() - this.ttlMs]);
    return result.rows.map((row) => ({
      roomId,
      playerId: row.player_id,
      accountId: row.account_id,
      online: true,
      lastSeen: Number(row.last_seen),
      instances: row.instances,
    }));
  }

  async summary() {
    const cutoff = this.clock() - this.ttlMs;
    const result = await this.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM cluster_instances WHERE last_seen > $1) AS active_instances,
        (SELECT COUNT(DISTINCT room_id || ':' || player_id) FROM player_presence WHERE last_seen > $1) AS active_players
    `, [cutoff]);
    return {
      activeInstances: Number(result.rows[0].active_instances),
      activePlayers: Number(result.rows[0].active_players),
    };
  }

  async prune() {
    const cutoff = this.clock() - this.ttlMs;
    const players = await this.pool.query("DELETE FROM player_presence WHERE last_seen <= $1", [cutoff]);
    await this.pool.query("DELETE FROM cluster_instances WHERE last_seen <= $1", [cutoff]);
    return players.rowCount;
  }

  async close() {
    await this.pool.query("DELETE FROM player_presence WHERE instance_id = $1", [this.instanceId]);
    await this.pool.query("DELETE FROM cluster_instances WHERE instance_id = $1", [this.instanceId]);
    await this.pool.end();
  }
}

export async function createPresenceStore({
  mode = process.env.HEXA_PRESENCE_STORE ?? (process.env.DATABASE_URL ? "postgres" : "memory"),
  instanceId = process.env.HEXA_INSTANCE_ID ?? `instance-${randomUUID()}`,
} = {}) {
  if (mode === "memory") return new MemoryPresenceStore({ instanceId });
  if (mode === "postgres") return PostgresPresenceStore.connect({ instanceId });
  throw new Error(`Unsupported HEXA_PRESENCE_STORE mode: ${mode}`);
}
