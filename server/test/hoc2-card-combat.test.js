import test from "node:test";
import assert from "node:assert/strict";

import { createCardCombat, requestRetreat, resolveCardCombatRound, submitCardSequence } from "../src/hoc2/card-combat.js";

function makeCombat(options = {}) {
  return createCardCombat({
    id: "combat-1",
    attacker: { id: "kael", commander: "Kael Vorthan", hp: 24, armyStrength: 30, units: ["guards", "archers", "cavalry"] },
    defender: { id: "brakk", commander: "Brakk Nulgar", hp: 26, armyStrength: 32, units: ["brutes", "spears", "archers"] },
    attackerRetreatHexes: [{ q: 1, r: 0 }],
    defenderRetreatHexes: [{ q: 4, r: 0 }],
    ...options,
  });
}

test("Octarina resonance adds one starting energy without exceeding cap", () => {
  const combat = makeCombat({ octarinaResonance: { kael: true } });
  assert.equal(combat.combatants.kael.energy, 7);
  assert.equal(combat.combatants.brakk.energy, 6);
});

test("a player may commit one to three cards only and energy is authoritative", () => {
  const combat = makeCombat();
  assert.throws(() => submitCardSequence(combat, "kael", []), /between 1 and 3/);
  assert.throws(() => submitCardSequence(combat, "kael", ["feint", "precise-strike", "shield-wall", "rally"]), /between 1 and 3/);
  assert.throws(() => submitCardSequence(combat, "kael", ["cavalry-charge", "arrow-volley"]), /not enough combat energy/);
  assert.equal(submitCardSequence(combat, "kael", ["feint", "precise-strike"]), false);
  assert.equal(combat.combatants.kael.energy, 3);
});

test("both sides commit before a round can resolve", () => {
  const combat = makeCombat();
  submitCardSequence(combat, "kael", ["shield-wall"]);
  assert.throws(() => resolveCardCombatRound(combat), /both players must commit/);
  assert.equal(submitCardSequence(combat, "brakk", ["heavy-blow"]), true);
  const result = resolveCardCombatRound(combat);
  assert.equal(result.round, 2);
  assert.equal(result.status, "select");
});

test("priority lets defense resolve before a slower attack", () => {
  const combat = makeCombat();
  submitCardSequence(combat, "kael", ["shield-wall"]);
  submitCardSequence(combat, "brakk", ["heavy-blow"]);
  const result = resolveCardCombatRound(combat);
  assert.equal(result.combatants.kael.hp, 23);
  const blow = result.log.find((entry) => entry.cardId === "heavy-blow");
  assert.equal(blow.blocked, 5);
  assert.equal(blow.damage, 2);
});

test("ordered combo Feint into Precise Strike produces deterministic bonus damage", () => {
  const combat = makeCombat();
  submitCardSequence(combat, "kael", ["feint", "precise-strike"]);
  submitCardSequence(combat, "brakk", ["iron-guard"]);
  const result = resolveCardCombatRound(combat);
  const strike = result.log.find((entry) => entry.cardId === "precise-strike");
  assert.equal(strike.combo, true);
  assert.equal(strike.blocked, 6);
  assert.equal(strike.damage, 4);
});

test("unit-gated formation cards require matching Army composition", () => {
  const combat = createCardCombat({
    id: "combat-no-cavalry",
    attacker: { id: "kael", commander: "Kael", units: ["guards", "archers"], deck: ["cavalry-charge", "shield-wall", "feint", "rally", "precise-strike"] },
    defender: { id: "brakk", commander: "Brakk", units: ["brutes"] },
  });
  assert.throws(() => submitCardSequence(combat, "kael", ["cavalry-charge"]), /requires unit cavalry/);
});

test("retreat is allowed only when a territorial liberty exists", () => {
  const open = makeCombat();
  const accepted = requestRetreat(open, "kael");
  assert.equal(accepted.accepted, true);
  assert.deepEqual(accepted.retreatHex, { q: 1, r: 0 });

  const surrounded = makeCombat({ attackerRetreatHexes: [] });
  const rejected = requestRetreat(surrounded, "kael");
  assert.deepEqual(rejected, { accepted: false, reason: "surrounded" });
  assert.notEqual(surrounded.status, "resolved");
});

test("Army Strength reaching zero resolves combat independently of commander HP", () => {
  const combat = makeCombat();
  combat.combatants.brakk.armyStrength = 3;
  combat.hands.kael = ["arrow-volley", "shield-wall", "feint", "rally", "precise-strike"];
  submitCardSequence(combat, "kael", ["arrow-volley"]);
  submitCardSequence(combat, "brakk", ["iron-guard"]);
  const result = resolveCardCombatRound(combat);
  assert.equal(result.status, "resolved");
  assert.equal(result.winnerId, "kael");
  assert.equal(result.resultReason, "army-broken");
  assert.ok(result.combatants.brakk.hp > 0);
});
