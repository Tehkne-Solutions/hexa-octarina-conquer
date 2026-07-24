import type { CampaignCatalog } from "./protocol";

const CACHE_PREFIX = "hexa.campaign.catalog-cache.v1";
export const CAMPAIGN_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

interface CampaignCatalogSnapshot {
  version: 1;
  scope: string;
  savedAt: number;
  catalog: CampaignCatalog;
}

type CacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function campaignCacheScope(accountId: string | null | undefined): string {
  return accountId?.trim() || "guest";
}

export function campaignCacheKey(scope: string): string {
  return `${CACHE_PREFIX}:${scope}`;
}

function isCampaignCatalog(value: unknown): value is CampaignCatalog {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CampaignCatalog>;
  return Array.isArray(candidate.chapters)
    && Array.isArray(candidate.missions)
    && Array.isArray(candidate.achievements)
    && Boolean(candidate.totals && typeof candidate.totals === "object");
}

export function serializeCampaignCatalogSnapshot(
  scope: string,
  catalog: CampaignCatalog,
  savedAt = Date.now(),
): string {
  const snapshot: CampaignCatalogSnapshot = { version: 1, scope, savedAt, catalog };
  return JSON.stringify(snapshot);
}

export function parseCampaignCatalogSnapshot(
  raw: string | null,
  expectedScope: string,
  now = Date.now(),
  maxAgeMs = CAMPAIGN_CACHE_MAX_AGE_MS,
): { catalog: CampaignCatalog; savedAt: number } | null {
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw) as Partial<CampaignCatalogSnapshot>;
    if (snapshot.version !== 1 || snapshot.scope !== expectedScope) return null;
    if (typeof snapshot.savedAt !== "number" || now - snapshot.savedAt > maxAgeMs) return null;
    if (!isCampaignCatalog(snapshot.catalog)) return null;
    return { catalog: snapshot.catalog, savedAt: snapshot.savedAt };
  } catch {
    return null;
  }
}

export function saveCampaignCatalogSnapshot(
  scope: string,
  catalog: CampaignCatalog,
  storage: CacheStorage = window.localStorage,
  savedAt = Date.now(),
): void {
  storage.setItem(campaignCacheKey(scope), serializeCampaignCatalogSnapshot(scope, catalog, savedAt));
}

export function readCampaignCatalogSnapshot(
  scope: string,
  storage: CacheStorage = window.localStorage,
  now = Date.now(),
): { catalog: CampaignCatalog; savedAt: number } | null {
  const key = campaignCacheKey(scope);
  const snapshot = parseCampaignCatalogSnapshot(storage.getItem(key), scope, now);
  if (!snapshot) storage.removeItem(key);
  return snapshot;
}
