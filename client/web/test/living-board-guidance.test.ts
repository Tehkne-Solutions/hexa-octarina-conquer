import { describe, expect, it } from "vitest";

import { TCG_CARDS } from "../src/living-board-data";
import {
  commandBudgetForTurn,
  currentObjectiveIndex,
  recommendedCombatCards,
} from "../src/living-board-guidance";

describe("living board guided playtest", () => {
  it("introduces command points gradually", () => {
    expect(commandBudgetForTurn(1)).toBe(1);
    expect(commandBudgetForTurn(2)).toBe(2);
    expect(commandBudgetForTurn(3)).toBe(3);
    expect(commandBudgetForTurn(9)).toBe(3);
  });

  it("keeps objectives strictly sequential", () => {
    expect(currentObjectiveIndex({
      rescuedLyra: false,
      crossedBridge: false,
      enemiesDefeated: 0,
      millCaptured: false,
      buildingPlaced: false,
    })).toBe(0);

    expect(currentObjectiveIndex({
      rescuedLyra: true,
      crossedBridge: true,
      enemiesDefeated: 1,
      millCaptured: false,
      buildingPlaced: false,
    })).toBe(3);

    expect(currentObjectiveIndex({
      rescuedLyra: true,
      crossedBridge: true,
      enemiesDefeated: 2,
      millCaptured: true,
      buildingPlaced: true,
    })).toBe(5);
  });

  it("suggests a legal combat combination within three energy", () => {
    const deck = [
      "kael-golpe-runico",
      "kael-guardiao-celeste",
      "kael-contra-selo",
      "kael-muralha-astral",
    ];
    const selected = recommendedCombatCards(deck, 3);
    const energy = selected.reduce((sum, cardId) => sum + TCG_CARDS[cardId].cost, 0);
    expect(selected.length).toBeGreaterThan(0);
    expect(energy).toBeLessThanOrEqual(3);
  });
});
