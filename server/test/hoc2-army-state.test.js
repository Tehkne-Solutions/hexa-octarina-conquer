import assert from "node:assert/strict";
import test from "node:test";

import { ArmyState, movementCost } from "../src/hoc2/army-state.js";

const hexes = [
  { q:0,r:0,terrain:"plain" }, { q:1,r:0,terrain:"plain" }, { q:2,r:0,terrain:"road" }, { q:3,r:0,terrain:"forest" },
  { q:0,r:1,terrain:"plain" }, { q:1,r:1,terrain:"mountain" }, { q:2,r:1,terrain:"plain" }, { q:3,r:1,terrain:"plain" },
];
const armies = [
  { id:"kael", factionId:"alliance", commanderId:"kael-vorthan", q:0,r:0,movementMax:4,supply:"supplied",units:[{kind:"guards"},{kind:"archers"},{kind:"cavalry"}] },
  { id:"brakk", factionId:"rubra", commanderId:"brakk-nulgar", q:3,r:0,movementMax:4,supply:"supplied",units:[{kind:"brutes"},{kind:"spears"},{kind:"archers"}] },
];

test("terrain and supply change authoritative movement cost", () => {
  assert.equal(movementCost({ terrain:"plain" }, "supplied"), 1);
  assert.equal(movementCost({ terrain:"forest" }, "supplied"), 2);
  assert.equal(movementCost({ terrain:"mountain" }, "cut-off"), 4);
  assert.equal(movementCost({ terrain:"water" }, "supplied"), Infinity);
});

test("reachable paths respect movement budget and enemy zone of control", () => {
  const state = new ArmyState({ hexes, armies });
  const reachable = state.reachable("kael");
  assert.ok(reachable.some((cell) => cell.q === 2 && cell.r === 0));
  const zocCell = reachable.find((cell) => cell.q === 2 && cell.r === 0);
  assert.equal(zocCell.zoc, true);
  assert.equal(reachable.some((cell) => cell.q === 3 && cell.r === 1), false);
});

test("moving into an enemy occupied hex yields ENEMY_CONTACT without teleporting attacker", () => {
  const state = new ArmyState({ hexes, armies });
  const result = state.move("kael", { q:3, r:0 });
  assert.equal(result.type, "ENEMY_CONTACT");
  assert.equal(result.attackerId, "kael");
  assert.equal(result.defenderId, "brakk");
  assert.deepEqual({ q: state.army("kael").q, r: state.army("kael").r }, { q:0, r:0 });
});

test("normal movement spends movement points and persists composition", () => {
  const state = new ArmyState({ hexes, armies:[armies[0]] });
  const result = state.move("kael", { q:1, r:0 });
  assert.equal(result.type, "MOVED");
  assert.equal(state.army("kael").movementRemaining, 3);
  assert.equal(state.army("kael").units.length, 3);
});
