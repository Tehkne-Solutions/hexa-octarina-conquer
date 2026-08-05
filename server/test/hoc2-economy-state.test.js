import assert from "node:assert/strict";
import test from "node:test";

import { EconomyState, constructionEligibility } from "../src/hoc2/economy-state.js";

test("turn production applies income minus maintenance deterministically", () => {
  const economy = new EconomyState({
    stock: { gold: 200, supply: 120, materials: 100, octarina: 10 },
    income: { gold: 15, supply: 12, materials: 6, octarina: 2 },
    maintenance: { gold: 3, supply: 4 },
  });
  const result = economy.advanceTurn();
  assert.deepEqual(result.delta, { gold: 12, supply: 8, materials: 6, octarina: 2 });
  assert.deepEqual(result.stock, { gold: 212, supply: 128, materials: 106, octarina: 12 });
});

test("mine production depends on supply connectivity", () => {
  const economy = new EconomyState({ income: { materials: 5 } });
  economy.setIncomeForMine({ connected: false, materials: 5 });
  assert.equal(economy.snapshot().income.materials, 0);
  economy.setIncomeForMine({ connected: true, materials: 5 });
  assert.equal(economy.snapshot().income.materials, 5);
});

test("starting an outpost spends resources and completes after its duration", () => {
  const economy = new EconomyState({ stock: { gold: 100, materials: 80 } });
  economy.startProject({ id: "outpost-1", type: "outpost", hexId: "1,1", turns: 1, cost: { gold: 20, materials: 40 } });
  assert.deepEqual(economy.snapshot().stock, { gold: 80, supply: 0, materials: 40, octarina: 0 });
  const result = economy.advanceTurn();
  assert.deepEqual(result.completed, ["outpost-1"]);
});

test("construction eligibility is contextual and terrain-aware", () => {
  assert.equal(constructionEligibility({ terrain: "plain", ownerFactionId: "alliance", factionId: "alliance", type: "outpost" }).allowed, true);
  assert.equal(constructionEligibility({ terrain: "water", ownerFactionId: "alliance", factionId: "alliance", type: "outpost" }).allowed, false);
  assert.equal(constructionEligibility({ terrain: "mountain", ownerFactionId: "alliance", factionId: "alliance", type: "road" }).allowed, false);
  assert.equal(constructionEligibility({ terrain: "plain", ownerFactionId: "rubra", factionId: "alliance", type: "road" }).allowed, false);
});
