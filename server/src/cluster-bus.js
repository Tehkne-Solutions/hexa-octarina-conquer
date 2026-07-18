import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

import pg from "pg";

const { Client, Pool } = pg;
const NOTIFY_CHANNEL = "hexa_cluster_events";

function normalizeEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    originInstanceId: row.origin_instance_id,
    topic: row.topic,
    payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
    createdAt: Number(row.created_at),
  };
}

export class MemoryClusterBus {
  constructor({ emitter = new EventEmitter(), instanceId = `instance-${randomUUID()}`, clock = () => Date.now() } = {}) {
    this.kind = "memory";
    this.instanceId = instanceId;
    this.clock = clock;
    this.emitter = emitter;
    this.handlers = new Set();
    this.listener = (event) => {
      for (const handler of this.handlers) Promise.resolve(handler(event)).catch(() => {});
    };
    this.emitter.on("cluster-event", this.listener);
  }

  subscribe(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async publish(topic, payload = {}) {
    const event = {
      id: `cluster-${randomUUID()}`,
      originInstanceId: this.instanceId,
      topic,
      payload: structuredClone(payload),
      createdAt: this.clock(),
    };
    queueMicrotask(() => this.emitter.emit("cluster-event", event));
    return event;
  }

  async prune() {
    return 0;
  }

  async close() {
    this.emitter.off("cluster-event", this.listener);
    this.handlers.clear();
  }
}

export class PostgresClusterBus {
  constructor({ pool, listener, instanceId, clock = () => Date.now() }) {
    this.kind = "postgres";
    this.pool = pool;
    this.listener = listener;
    this.instanceId = instanceId;
    this.clock = clock;
    this.handlers = new Set();
    this.notificationHandler = (notification) => {
      if (notification.channel !== NOTIFY_CHANNEL || !notification.payload) return;
      this.#dispatchById(notification.payload).catch(() => {});
    };
    this.listener.on("notification", this.notificationHandler);
  }

  static async connect({
    connectionString = process.env.DATABASE_URL,
    instanceId = process.env.HEXA_INSTANCE_ID ?? `instance-${randomUUID()}`,
    clock = () => Date.now(),
  } = {}) {
    if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL cluster bus");
    const pool = new Pool({ connectionString, max: Number(process.env.HEXA_CLUSTER_PG_POOL_SIZE ?? 4) });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cluster_events (
        id TEXT PRIMARY KEY,
        origin_instance_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cluster_events_created_at ON cluster_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_cluster_events_topic_time ON cluster_events(topic, created_at DESC);
    `);
    const listener = new Client({ connectionString });
    await listener.connect();
    await listener.query(`LISTEN ${NOTIFY_CHANNEL}`);
    return new PostgresClusterBus({ pool, listener, instanceId, clock });
  }

  subscribe(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async publish(topic, payload = {}) {
    const event = {
      id: `cluster-${randomUUID()}`,
      originInstanceId: this.instanceId,
      topic,
      payload,
      createdAt: this.clock(),
    };
    await this.pool.query(`
      INSERT INTO cluster_events (id, origin_instance_id, topic, payload, created_at)
      VALUES ($1, $2, $3, $4::jsonb, $5)
    `, [event.id, event.originInstanceId, event.topic, JSON.stringify(event.payload), event.createdAt]);
    await this.pool.query(`SELECT pg_notify('${NOTIFY_CHANNEL}', $1)`, [event.id]);
    return event;
  }

  async #dispatchById(eventId) {
    const result = await this.pool.query("SELECT * FROM cluster_events WHERE id = $1", [eventId]);
    const event = normalizeEvent(result.rows[0]);
    if (!event) return;
    for (const handler of this.handlers) await handler(event);
  }

  async prune({ maxAgeMs = 24 * 60 * 60 * 1000 } = {}) {
    const result = await this.pool.query("DELETE FROM cluster_events WHERE created_at < $1", [this.clock() - maxAgeMs]);
    return result.rowCount;
  }

  async close() {
    this.handlers.clear();
    this.listener.off("notification", this.notificationHandler);
    try {
      await this.listener.query(`UNLISTEN ${NOTIFY_CHANNEL}`);
    } finally {
      await this.listener.end();
      await this.pool.end();
    }
  }
}

export async function createClusterBus({
  mode = process.env.HEXA_CLUSTER_BUS ?? (process.env.DATABASE_URL ? "postgres" : "memory"),
  instanceId = process.env.HEXA_INSTANCE_ID ?? `instance-${randomUUID()}`,
} = {}) {
  if (mode === "memory") return new MemoryClusterBus({ instanceId });
  if (mode === "postgres") return PostgresClusterBus.connect({ instanceId });
  throw new Error(`Unsupported HEXA_CLUSTER_BUS mode: ${mode}`);
}
