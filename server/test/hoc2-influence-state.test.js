import assert from "node:assert/strict";
import test from "node:test";

import { HexMapState } from "../src/hoc2/hex-map-state.js";
import { analyzeGoState, calculateInfluence, findChains, isSurrounded, retreatLiberties } from "../src/hoc2/influence-state.js";

function mapOf(cells) {
  return new HexMapState(cells.map((cell) => ({ visibility: "visible", ...cell })));
}

test("adjacent controlled hexes form one chain and share liberties", () => {
  const map = mapOf([
    { q: 0, r: 0, controllerFactionId: "alliance" },
    { q: 1, r: 0, controllerFactionId: "alliance" },
    { q: 0, r: 1 },
    { q: 1, r: 1 },
    { q: 2, r: 0 },
  ]);
  const [chain] = findChains(map, "alliance");
  assert.deepEqual(chain.members, ["0,0", "1,0"]);
  assert.equal(chain.libertyCount, 3);
  assert.equal(chain.surrounded, false);
});

test("enemy occupation can reduce a chain to zero liberties without deleting it", () => {
  const map = mapOf([
    { q: 0, r: 0, controllerFactionId: "alliance" },
    { q: 1, r: 0, controllerFactionId: "rubra" },
    { q: 1, r: -1, controllerFactionId: "rubra" },
    { q: 0, r: -1, controllerFactionId: "rubra" },
    { q: -1, r: 0, controllerFactionId: "rubra" },
    { q: -1, r: 1, controllerFactionId: "rubra" },
    { q: 0, r: 1, controllerFactionId: "rubra" },
  ]);
  const [chain] = findChains(map, "alliance");
  assert.equal(chain.libertyCount, 0);
  assert.equal(chain.surrounded, true);
  assert.equal(isSurrounded(map, "alliance", "0,0"), true);
  assert.deepEqual(retreatLiberties(map, "alliance", "0,0"), []);
  assert.equal(map.get("0,0")?.controllerFactionId, "alliance");
});

test("a final neutral adjacent hex remains a valid retreat liberty", () => {
  const map = mapOf([
    { q: 0, r: 0, controllerFactionId: "alliance" },
    { q: 1, r: 0, controllerFactionId: "rubra" },
    { q: 1, r: -1, controllerFactionId: "rubra" },
    { q: 0, r: -1, controllerFactionId: "rubra" },
    { q: -1, r: 0, controllerFactionId: "rubra" },
    { q: -1, r: 1, controllerFactionId: "rubra" },
    { q: 0, r: 1 },
  ]);
  const [chain] = findChains(map, "alliance");
  assert.equal(chain.libertyCount, 1);
  assert.equal(chain.isolated, true);
  assert.deepEqual(retreatLiberties(map, "alliance", "0,0"), ["0,1"]);
});

test("influence is deterministic and remains separate from owner/controller", () => {
  const map = mapOf([
    { q: 0, r: 0, ownerFactionId: "alliance", controllerFactionId: "alliance" },
    { q: 1, r: 0, ownerFactionId: "alliance", controllerFactionId: "rubra" },
    { q: 0, r: 1 },
  ]);
  const influence = calculateInfluence(map);
  assert.deepEqual(influence["0,0"], { alliance: 2, rubra: 1 });
  assert.deepEqual(influence["1,0"], { alliance: 1, rubra: 2 });
  const state = analyzeGoState(map, ["rubra", "alliance"]);
  assert.deepEqual(map.get("1,0")?.influence, { alliance: 1, rubra: 2 });
  assert.equal(map.get("1,0")?.ownerFactionId, "alliance");
  assert.equal(map.get("1,0")?.controllerFactionId, "rubra");
  assert.deepEqual(Object.keys(state.chains), ["alliance", "rubra"]);
});
