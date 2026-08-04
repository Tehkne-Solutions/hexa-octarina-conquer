import { describe, expect, it } from "vitest";

import { strategicRoadCount, strategicUnit } from "./strategic-board-model";
import {
  createBalancedStrategicBoard,
  createStrategicMatchSeed,
  strategicNextRoundStarter,
  strategicStarterFromSeed,
} from "./strategic-balanced-opening";

describe("VS51 balanced gameplay opening", () => {
  it("starts from mirrored west-east fronts with no prebuilt roads", () => {
    const board = createBalancedStrategicBoard();

    expect(strategicUnit(board, "kael").nodeId).toBe("s-0-0");
    expect(strategicUnit(board, "lyra").nodeId).toBe("s-0-2");
    expect(strategicUnit(board, "varg").nodeId).toBe("s-2-0");
    expect(strategicUnit(board, "brakk").nodeId).toBe("s-2-2");
    expect(strategicRoadCount(board, "blue")).toBe(0);
    expect(strategicRoadCount(board, "red")).toBe(0);
  });

  it("derives initiative deterministically and alternates each round", () => {
    const starter = strategicStarterFromSeed(500000);
    expect(strategicStarterFromSeed(500000)).toBe(starter);
    expect(strategicNextRoundStarter(strategicNextRoundStarter(starter))).toBe(starter);
  });

  it("can generate stable test seeds from injected entropy", () => {
    expect(createStrategicMatchSeed(123456, 0.25)).toBe(createStrategicMatchSeed(123456, 0.25));
  });
});
