import { describe, expect, it } from "vitest";

import type { CampaignCatalog } from "./protocol";
import {
  CAMPAIGN_CACHE_MAX_AGE_MS,
  campaignCacheScope,
  parseCampaignCatalogSnapshot,
  serializeCampaignCatalogSnapshot,
} from "./campaign-cache";

const catalog = {
  chapters: [],
  missions: [],
  achievements: [],
  totals: { stars: 0, completed: 0 },
} as unknown as CampaignCatalog;

describe("campaign catalog cache", () => {
  it("separates guest and authenticated scopes", () => {
    expect(campaignCacheScope(null)).toBe("guest");
    expect(campaignCacheScope("account-42")).toBe("account-42");
  });

  it("restores a valid snapshot inside the freshness window", () => {
    const raw = serializeCampaignCatalogSnapshot("guest", catalog, 1_000);
    expect(parseCampaignCatalogSnapshot(raw, "guest", 1_500)).toEqual({ catalog, savedAt: 1_000 });
  });

  it("rejects snapshots from another account", () => {
    const raw = serializeCampaignCatalogSnapshot("account-a", catalog, 1_000);
    expect(parseCampaignCatalogSnapshot(raw, "account-b", 1_500)).toBeNull();
  });

  it("rejects stale or malformed snapshots", () => {
    const raw = serializeCampaignCatalogSnapshot("guest", catalog, 1_000);
    expect(parseCampaignCatalogSnapshot(raw, "guest", 1_000 + CAMPAIGN_CACHE_MAX_AGE_MS + 1)).toBeNull();
    expect(parseCampaignCatalogSnapshot("{broken", "guest")).toBeNull();
  });
});
