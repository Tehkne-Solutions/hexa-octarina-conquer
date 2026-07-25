import { describe, expect, it } from "vitest";

import {
  ONBOARDING_DISMISSED_KEY,
  PROGRESS_BACKUP_KEY,
  createProgressBackup,
  guestProgressHasActivity,
  progressSummary,
  readProgressBackups,
  shouldOfferAccountOnboarding,
} from "./account-sync";
import type { LivingCampaignProgress } from "./unified-progress";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function progress(update: Partial<LivingCampaignProgress> = {}): LivingCampaignProgress {
  return {
    missionId: "bridge-of-ashes",
    title: "A Ponte das Cinzas",
    status: "not-started",
    percent: 0,
    completedObjectives: 0,
    totalObjectives: 5,
    attempts: 0,
    bestTurn: null,
    lastTurn: 0,
    startedAt: null,
    lastPlayedAt: null,
    completedAt: null,
    building: null,
    rewards: [],
    ...update,
  };
}

describe("account progress synchronization helpers", () => {
  it("offers onboarding only after meaningful guest progress", () => {
    const storage = new MemoryStorage();
    expect(shouldOfferAccountOnboarding(null, progress(), storage)).toBe(false);
    expect(shouldOfferAccountOnboarding(null, progress({ status: "active", percent: 18, attempts: 1 }), storage)).toBe(true);
    storage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    expect(shouldOfferAccountOnboarding(null, progress({ status: "active", percent: 18, attempts: 1 }), storage)).toBe(false);
  });

  it("does not offer account onboarding to authenticated players", () => {
    const storage = new MemoryStorage();
    const account = { account: { id: "a1", handle: "kael", displayName: "Kael" }, accessToken: "token" };
    expect(shouldOfferAccountOnboarding(account, progress({ status: "victory", percent: 100 }), storage)).toBe(false);
  });

  it("creates immutable rolling backups before synchronization", () => {
    const storage = new MemoryStorage();
    const local = progress({ status: "active", percent: 52, completedObjectives: 3, attempts: 2 });
    const backup = createProgressBackup("account-1", "merge", local, storage, 1000);
    local.percent = 99;
    expect(backup?.localProgress.percent).toBe(52);
    expect(readProgressBackups(storage)).toHaveLength(1);
    expect(readProgressBackups(storage)[0]).toMatchObject({ accountId: "account-1", strategy: "merge", createdAt: 1000 });
    expect(storage.getItem(PROGRESS_BACKUP_KEY)).toContain("bridge-of-ashes");
  });

  it("summarizes local states without exposing arbitrary content", () => {
    expect(guestProgressHasActivity(progress())).toBe(false);
    expect(progressSummary(progress({ status: "active", percent: 44, completedObjectives: 2 }))).toBe("44% · 2/5 objetivos");
    expect(progressSummary(progress({ status: "victory", percent: 100, completedObjectives: 5 }))).toBe("Prólogo concluído · 5/5 objetivos");
  });
});
