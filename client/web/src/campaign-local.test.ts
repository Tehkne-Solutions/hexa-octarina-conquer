import { beforeEach, describe, expect, it } from "vitest";

import { decorateGuestCampaign, readGuestCampaignProgress, recordGuestCampaignResult } from "./campaign-local";
import type { CampaignCatalog, CampaignResult } from "./protocol";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

const catalog: CampaignCatalog = {
  chapters: [{ id: "chapter-1", order: 1, title: "Capítulo", subtitle: "Teste" }],
  missions: [
    {
      id: "c1-m1", chapterId: "chapter-1", order: 1, title: "Primeira", briefing: "",
      boardSize: 4, difficulty: "novice", aiName: "Bot", rewardXp: 100,
      primary: { type: "cells", target: 1, label: "Uma célula" }, bonus: [], failure: {},
      unlocked: true, progress: null,
    },
    {
      id: "c1-m2", chapterId: "chapter-1", order: 2, title: "Segunda", briefing: "",
      boardSize: 4, difficulty: "novice", aiName: "Bot 2", rewardXp: 120,
      primary: { type: "cells", target: 2, label: "Duas células" }, bonus: [], failure: {},
      unlocked: false, progress: null,
    },
  ],
  achievements: [
    { id: "first-sigil", title: "Primeiro Selo", description: "Complete uma missão", icon: "✦", unlockedAt: null },
  ],
  totals: { stars: 0, cells: 0, duelsWon: 0, fortifications: 0, attempts: 0, completed: 0 },
};

const result: CampaignResult = {
  roomId: "ROOM-GUEST",
  missionId: "c1-m1",
  success: true,
  stars: 2,
  rewardXp: 150,
  reason: "primary_objective",
  stats: { cells: 1, duelsWon: 0, fortifications: 0, hp: 20 },
  bonusCompleted: [true],
  finishedAt: 1,
};

describe("guest campaign progress", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
  });

  it("stores stars, unlocks the next mission and decorates achievements", () => {
    const updated = recordGuestCampaignResult(catalog, result);
    const persisted = readGuestCampaignProgress();

    expect(persisted.totals.stars).toBe(2);
    expect(persisted.totals.completed).toBe(1);
    expect(updated.missions[1].unlocked).toBe(true);
    expect(updated.missions[0].progress?.stars).toBe(2);
    expect(updated.achievements[0].unlockedAt).not.toBeNull();
  });

  it("keeps only the first mission unlocked before progress exists", () => {
    const initial = decorateGuestCampaign(catalog);
    expect(initial.missions[0].unlocked).toBe(true);
    expect(initial.missions[1].unlocked).toBe(false);
  });
});
