import { describe, expect, it } from "vitest";

import { simulateStrategicBalance } from "./strategic-balance-simulator";

describe("META 10.14A initiative bias diagnostic", () => {
  it("compares the same seeded sample with Blue-first and Red-first initiative", () => {
    const matches = 1000;
    const seedOffset = 300000;
    const blueFirst = simulateStrategicBalance(matches, seedOffset, "blue");
    const redFirst = simulateStrategicBalance(matches, seedOffset, "red");

    console.log("HOC_STRATEGIC_INITIATIVE_BIAS=" + JSON.stringify({
      matches,
      seedOffset,
      blueFirst,
      redFirst,
    }));

    expect(blueFirst.matches).toBe(matches);
    expect(redFirst.matches).toBe(matches);
    expect(blueFirst.victories + blueFirst.defeats + blueFirst.unresolved).toBe(matches);
    expect(redFirst.victories + redFirst.defeats + redFirst.unresolved).toBe(matches);
  }, 15000);
});
