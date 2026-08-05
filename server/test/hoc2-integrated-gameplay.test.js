import test from "node:test";
import assert from "node:assert/strict";

import { ArmyState } from "../src/hoc2/army-state.js";
import { HexMapState } from "../src/hoc2/hex-map-state.js";
import { Hoc2IntegratedGameplay } from "../src/hoc2/integrated-gameplay.js";
import { OctarinaNetwork } from "../src/hoc2/octarina-network.js";
import { StrategicNetwork } from "../src/hoc2/strategic-network.js";

function scenario() {
  const map = new HexMapState([
    { q: 1, r: 0, terrain: "plain", ownerFactionId: "alliance", controllerFactionId: "alliance", armyId: "kael" },
    { q: 2, r: 0, terrain: "plain", ownerFactionId: "rubra", controllerFactionId: "rubra", armyId: "brakk", strategicNodeId: "fortress" },
    { q: 2, r: -1, terrain: "plain", ownerFactionId: "rubra", controllerFactionId: null },
    { q: 0, r: 0, terrain: "plain", ownerFactionId: "alliance", controllerFactionId: "alliance", octarinaNodeId: "oct-west" },
    { q: 0, r: 1, terrain: "plain", ownerFactionId: "alliance", controllerFactionId: "alliance", octarinaNodeId: "oct-core" },
    { q: 1, r: 1, terrain: "plain", ownerFactionId: "alliance", controllerFactionId: "alliance", octarinaNodeId: "oct-east" },
    { q: -1, r: 1, terrain: "plain", ownerFactionId: "alliance", controllerFactionId: "alliance", octarinaNodeId: "oct-south" },
  ]);
  const armies = new ArmyState({
    hexes: map.orderedCells(),
    armies: [
      { id: "kael", factionId: "alliance", commanderId: "Kael Vorthan", q: 1, r: 0, movementMax: 4, supply: "cut-off", units: [{ type: "guards" }, { type: "archers" }, { type: "cavalry" }] },
      { id: "brakk", factionId: "rubra", commanderId: "Brakk Nulgar", q: 2, r: 0, movementMax: 4, supply: "supplied", units: [{ type: "brutes" }, { type: "spears" }, { type: "archers" }] },
    ],
  });
  const strategicNetwork = new StrategicNetwork({
    nodes: [
      { id: "fortress", q: 2, r: 0, kind: "fortress", ownerFactionId: "rubra", state: "active", supplySource: true },
    ],
  });
  const octarinaNetwork = new OctarinaNetwork({
    nodes: [
      { id: "oct-core", q: 0, r: 1, kind: "core", ownerFactionId: "alliance", state: "active" },
      { id: "oct-west", q: 0, r: 0, kind: "source", ownerFactionId: "alliance", state: "active", charge: 2 },
      { id: "oct-east", q: 1, r: 1, kind: "source", ownerFactionId: "alliance", state: "active", charge: 3 },
      { id: "oct-south", q: -1, r: 1, kind: "source", ownerFactionId: "alliance", state: "active", charge: 4 },
    ],
    edges: [
      { a: "oct-core", b: "oct-west" },
      { a: "oct-core", b: "oct-east" },
      { a: "oct-core", b: "oct-south" },
    ],
  });
  return new Hoc2IntegratedGameplay({
    map,
    armies,
    strategicNetwork,
    octarinaNetwork,
    supplyNodeByArmy: { kael: "fortress" },
    objective: { id: "capture-velmar", type: "capture", hex: { q: 2, r: 0 }, factionId: "alliance", complete: false },
    combatStats: { kael: { hp: 24, armyStrength: 30 }, brakk: { hp: 26, armyStrength: 3 } },
  });
}

test("enemy contact opens authoritative Card Combat without moving attacker", () => {
  const game = scenario();
  const contact = game.moveArmy("kael", { q: 2, r: 0 });
  assert.equal(contact.type, "ENEMY_CONTACT");
  assert.deepEqual({ q: game.army("kael").q, r: game.army("kael").r }, { q: 1, r: 0 });
  assert.equal(contact.combat.attackerId, "kael");
  assert.equal(contact.combat.defenderId, "brakk");
  assert.equal(contact.combat.combatants.kael.energy, 7, "3/6 Octarina resonance must reach the combat");
});

test("combat victory returns to map and applies capture, retreat, Go, supply, Octarina and objective cascade", () => {
  const game = scenario();
  game.moveArmy("kael", { q: 2, r: 0 });
  game.submitCombatCards("kael", ["arrow-volley"]);
  game.submitCombatCards("brakk", ["iron-guard"]);
  const outcome = game.resolveCombatRound();

  assert.equal(outcome.type, "COMBAT_RESULT");
  assert.equal(outcome.result.winnerId, "kael");
  assert.equal(game.army("kael").q, 2);
  assert.equal(game.army("kael").r, 0);
  assert.equal(game.map.get({ q: 2, r: 0 }).controllerFactionId, "alliance");
  assert.equal(game.map.get({ q: 2, r: 0 }).armyId, "kael");
  assert.deepEqual({ q: game.army("brakk").q, r: game.army("brakk").r }, { q: 2, r: -1 });
  assert.equal(game.strategicNetwork.nodes.get("fortress").ownerFactionId, "alliance");
  assert.equal(game.army("kael").supply, "supplied", "captured supply source must reconnect Kael");
  assert.equal(outcome.world.objective.complete, true);
  assert.equal(outcome.world.octarina["oct-core"].formation.resonance, true);
  assert.ok(outcome.world.go.chains.alliance.some((chain) => chain.members.includes("2,0")));
  assert.ok(outcome.cascade.some((event) => event.type === "HEX_CAPTURED"));
  assert.ok(outcome.cascade.some((event) => event.type === "SUPPLY_CHANGED"));
  assert.ok(outcome.cascade.some((event) => event.type === "OBJECTIVE_COMPLETE"));
  assert.equal(outcome.world.combat, null);
});

test("retreat preserves the strategic map when attacker withdraws", () => {
  const game = scenario();
  game.moveArmy("kael", { q: 2, r: 0 });
  const outcome = game.retreat("kael");
  assert.equal(outcome.type, "COMBAT_RESULT");
  assert.equal(outcome.result.resultReason, "retreat");
  assert.deepEqual({ q: game.army("kael").q, r: game.army("kael").r }, { q: 1, r: 0 });
  assert.equal(game.map.get({ q: 2, r: 0 }).controllerFactionId, "rubra");
  assert.equal(game.objective.complete, false);
});
