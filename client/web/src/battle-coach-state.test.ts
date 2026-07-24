import { describe, expect, it } from "vitest";

import {
  appendUniqueAiMessage,
  parseStoredCoachSteps,
  resolveBattleCoachStep,
  serializeCoachSteps,
  type BattleCoachSnapshot,
} from "./battle-coach-state";

function snapshot(overrides: Partial<BattleCoachSnapshot> = {}): BattleCoachSnapshot {
  return {
    storyActive: false,
    objectiveIndex: 0,
    battleOpen: false,
    constructionOpen: false,
    victory: false,
    defeat: false,
    aiActive: false,
    aiMessage: null,
    ...overrides,
  };
}

describe("battle coach state", () => {
  it("prioritizes story, combat and construction over the objective index", () => {
    expect(resolveBattleCoachStep(snapshot({ storyActive: true, objectiveIndex: 4 }))).toBe("story");
    expect(resolveBattleCoachStep(snapshot({ battleOpen: true, objectiveIndex: 0 }))).toBe("combat");
    expect(resolveBattleCoachStep(snapshot({ constructionOpen: true, battleOpen: true }))).toBe("construction");
  });

  it("maps each campaign objective to one contextual rule", () => {
    expect(resolveBattleCoachStep(snapshot({ objectiveIndex: 0 }))).toBe("movement");
    expect(resolveBattleCoachStep(snapshot({ objectiveIndex: 1 }))).toBe("bridge");
    expect(resolveBattleCoachStep(snapshot({ objectiveIndex: 2 }))).toBe("combat");
    expect(resolveBattleCoachStep(snapshot({ objectiveIndex: 3 }))).toBe("capture");
    expect(resolveBattleCoachStep(snapshot({ objectiveIndex: 4 }))).toBe("construction");
  });

  it("stops coaching after victory or defeat", () => {
    expect(resolveBattleCoachStep(snapshot({ victory: true }))).toBeNull();
    expect(resolveBattleCoachStep(snapshot({ defeat: true }))).toBeNull();
  });

  it("keeps an ordered and deduplicated AI action summary", () => {
    let messages: string[] = [];
    messages = appendUniqueAiMessage(messages, "1/2 · Varg escolheu uma liberdade.");
    messages = appendUniqueAiMessage(messages, "1/2 · Varg escolheu uma liberdade.");
    messages = appendUniqueAiMessage(messages, "2/2 · Varg criou uma trilha.");

    expect(messages).toEqual([
      "1/2 · Varg escolheu uma liberdade.",
      "2/2 · Varg criou uma trilha.",
    ]);
  });

  it("round-trips only valid dismissed tutorial steps", () => {
    const stored = serializeCoachSteps(new Set(["movement", "combat"]));
    expect([...parseStoredCoachSteps(stored)]).toEqual(["movement", "combat"]);
    expect([...parseStoredCoachSteps('["movement","unknown"]')]).toEqual(["movement"]);
    expect(parseStoredCoachSteps("invalid").size).toBe(0);
  });
});
