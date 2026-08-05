import assert from "node:assert/strict";
import test from "node:test";

import {
  HEX_DIRECTION_ORDER,
  areHexAdjacent,
  cubeCoordinate,
  hexDistance,
  hexKey,
  hexNeighbors,
  neighborInDirection,
  parseHexKey,
} from "../src/hoc2/hex-coordinates.js";
import { HexMapState } from "../src/hoc2/hex-map-state.js";

test("HOC2 axial coordinates expose exactly six canonical neighbors in deterministic order", () => {
  const origin = { q: 0, r: 0 };
  assert.deepEqual(HEX_DIRECTION_ORDER, ["E", "NE", "NW", "W", "SW", "SE"]);
  assert.deepEqual(hexNeighbors(origin), [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ]);
  assert.deepEqual(neighborInDirection(origin, "SW"), { q: -1, r: 1 });
});

test("HOC2 hex key, parser, cube conversion and distance are reversible and exact", () => {
  const hex = { q: -3, r: 5 };
  assert.equal(hexKey(hex), "-3,5");
  assert.deepEqual(parseHexKey("-3,5"), hex);
  assert.deepEqual(cubeCoordinate(hex), { q: -3, r: 5, s: -2 });
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 3, r: -2 }), 3);
  assert.equal(areHexAdjacent({ q: 2, r: 1 }, { q: 1, r: 2 }), true);
  assert.equal(areHexAdjacent({ q: 2, r: 1 }, { q: 0, r: 2 }), false);
});

test("HOC2 coordinate validation rejects malformed keys and non-integer coordinates", () => {
  assert.throws(() => parseHexKey("1"), /invalid hex key/);
  assert.throws(() => parseHexKey("1,2,3"), /invalid hex key/);
  assert.throws(() => hexKey({ q: 1.5, r: 0 }), /integer q and r/);
  assert.throws(() => neighborInDirection({ q: 0, r: 0 }, "N"), /unknown hex direction/);
});

test("HOC2 HexMapState keeps ownership, control and influence as independent authoritative fields", () => {
  const map = new HexMapState([
    {
      q: 0,
      r: 0,
      terrain: "forest",
      ownerFactionId: "alliance",
      controllerFactionId: "rubra",
      influence: { alliance: 3, rubra: 5 },
      visibility: "visible",
    },
  ]);

  const cell = map.get({ q: 0, r: 0 });
  assert.equal(cell.ownerFactionId, "alliance");
  assert.equal(cell.controllerFactionId, "rubra");
  assert.deepEqual(cell.influence, { alliance: 3, rubra: 5 });
});

test("HOC2 HexMapState supports VS01 occupancy slots without merging domain layers", () => {
  const map = new HexMapState();
  map.addCell({
    q: 1,
    r: -1,
    armyId: "army-kael",
    structureId: "outpost-aldor",
    resourceId: "iron-1",
    strategicNodeId: "node-bridge",
    octarinaNodeId: "octarina-1",
    modifiers: ["high-ground", "river-bank", "high-ground"],
  });

  assert.deepEqual(map.get("1,-1"), {
    id: "1,-1",
    q: 1,
    r: -1,
    terrain: "plain",
    elevation: 0,
    provinceId: null,
    ownerFactionId: null,
    controllerFactionId: null,
    influence: {},
    visibility: "unknown",
    armyId: "army-kael",
    structureId: "outpost-aldor",
    resourceId: "iron-1",
    strategicNodeId: "node-bridge",
    octarinaNodeId: "octarina-1",
    modifiers: ["high-ground", "river-bank"],
  });
});

test("HOC2 HexMapState serialization is deterministic regardless of insertion order", () => {
  const left = new HexMapState([
    { q: 1, r: 0, influence: { rubra: 1, alliance: 2 } },
    { q: -1, r: 1 },
    { q: 0, r: 0 },
  ]);
  const right = new HexMapState([
    { q: 0, r: 0 },
    { q: 1, r: 0, influence: { alliance: 2, rubra: 1 } },
    { q: -1, r: 1 },
  ]);

  assert.deepEqual(left.serialize(), right.serialize());
  assert.deepEqual(HexMapState.fromJSON(left.serialize()).serialize(), left.serialize());
  assert.deepEqual(left.serialize().cells.map((cell) => cell.id), ["-1,1", "0,0", "1,0"]);
});

test("HOC2 HexMapState rejects duplicate coordinates and coordinate mutation", () => {
  const map = new HexMapState([{ q: 0, r: 0 }]);
  assert.throws(() => map.addCell({ q: 0, r: 0 }), /duplicate hex cell/);
  assert.throws(() => map.addCell({ id: "custom", q: 1, r: 0 }), /id must match axial coordinates/);
  assert.throws(() => map.updateCell("0,0", { q: 2 }), /immutable/);
});
