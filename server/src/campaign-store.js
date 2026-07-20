import { Pool } from "pg";

import { emptyCampaignProgress, mergeCampaignResult, publicCampaignCatalog, unlockedMissionIds } from "./campaign-catalog.js";

function clone(value) {
  return structuredClone(value);
}

export class MemoryCampaignStore {
  constructor({ clock = () => Date.now() } = {}) {
    this.kind = "memory";
    this.clock = clock;
    this.progressByAccount = new Map();
  }

  async getProgress(accountId) {
    return clone(this.progressByAccount.get(accountId) ?? emptyCampaignProgress());
  }

  async getCatalog(accountId = null) {
    const progress = accountId ? await this.getProgress(accountId) : emptyCampaignProgress();
    return publicCampaignCatalog(progress);
  }

  async assertMissionUnlocked(accountId, missionId) {
    if (!accountId) return true;
    const progress = await this.getProgress(accountId);
    if (!unlockedMissionIds(progress).includes(missionId)) {
      throw Object.assign(new Error("complete the previous mission before starting this one"), { code: "MISSION_LOCKED" });
    }
    return true;
  }

  async recordResult(accountId, result) {
    if (!accountId) return { recorded: false, progress: emptyCampaignProgress(), unlockedAchievements: [] };
    const current = await this.getProgress(accountId);
    const merged = mergeCampaignResult(current, result, this.clock());
    if (merged.recorded) this.progressByAccount.set(accountId, clone(merged.progress));
    return clone(merged);
  }

  async close() {}
}

export class PostgresCampaignStore {
  constructor({ connectionString, pool = null, poolSize = 5, clock = () => Date.now() } = {}) {
    if (!pool && !connectionString) throw new Error("PostgresCampaignStore requires DATABASE_URL");
    this.kind = "postgres";
    this.clock = clock;
    this.pool = pool ?? new Pool({ connectionString, max: poolSize });
    this.ownsPool = !pool;
  }

  async initialize() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["hexa_campaign_schema_v2"]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS campaign_progress (
          account_id TEXT PRIMARY KEY,
          progress JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS campaign_rewards (
          room_id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          xp INTEGER NOT NULL,
          awarded_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_campaign_rewards_account
          ON campaign_rewards(account_id, awarded_at DESC)
      `);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return this;
  }

  async getProgress(accountId) {
    const result = await this.pool.query("SELECT progress FROM campaign_progress WHERE account_id = $1", [accountId]);
    return clone(result.rows[0]?.progress ?? emptyCampaignProgress());
  }

  async getCatalog(accountId = null) {
    const progress = accountId ? await this.getProgress(accountId) : emptyCampaignProgress();
    return publicCampaignCatalog(progress);
  }

  async assertMissionUnlocked(accountId, missionId) {
    if (!accountId) return true;
    const progress = await this.getProgress(accountId);
    if (!unlockedMissionIds(progress).includes(missionId)) {
      throw Object.assign(new Error("complete the previous mission before starting this one"), { code: "MISSION_LOCKED" });
    }
    return true;
  }

  async recordResult(accountId, result) {
    if (!accountId) return { recorded: false, progress: emptyCampaignProgress(), unlockedAchievements: [] };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`campaign:${accountId}`]);
      const currentResult = await client.query("SELECT progress FROM campaign_progress WHERE account_id = $1 FOR UPDATE", [accountId]);
      const current = currentResult.rows[0]?.progress ?? emptyCampaignProgress();
      const merged = mergeCampaignResult(current, result, this.clock());
      if (merged.recorded) {
        await client.query(`
          INSERT INTO campaign_progress (account_id, progress, updated_at)
          VALUES ($1, $2::jsonb, $3)
          ON CONFLICT (account_id) DO UPDATE
          SET progress = EXCLUDED.progress, updated_at = EXCLUDED.updated_at
        `, [accountId, JSON.stringify(merged.progress), this.clock()]);
      }
      await client.query("COMMIT");
      return clone(merged);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

export async function createCampaignStore() {
  const kind = process.env.HEXA_CAMPAIGN_STORE
    ?? (process.env.DATABASE_URL ? "postgres" : "memory");
  if (kind === "memory") return new MemoryCampaignStore();
  if (kind === "postgres") {
    return new PostgresCampaignStore({
      connectionString: process.env.DATABASE_URL,
      poolSize: Number(process.env.HEXA_CAMPAIGN_PG_POOL_SIZE ?? 5),
    }).initialize();
  }
  throw new Error(`unsupported campaign store: ${kind}`);
}
