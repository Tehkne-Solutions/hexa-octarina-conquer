import assert from "node:assert/strict";
import test from "node:test";

import { OctarinaNetwork } from "../src/hoc2/octarina-network.js";

const nodes = [
  { id: "core", q: 0, r: 0, kind: "core", ownerFactionId: "alliance", state: "active", charge: 0, range: 1 },
  { id: "north", q: 1, r: -1, kind: "source", ownerFactionId: "alliance", state: "active", charge: 2, range: 1 },
  { id: "east", q: 1, r: 0, kind: "source", ownerFactionId: "alliance", state: "active", charge: 3, range: 1 },
  { id: "south", q: 0, r: 1, kind: "source", ownerFactionId: "alliance", state: "active", charge: 4, range: 1 },
];

function network() {
  return new OctarinaNetwork({ nodes, edges: [
    { a: "core", b: "north" },
    { a: "core", b: "east" },
    { a: "core", b: "south" },
  ]});
}

test("flow is derived only from active connected allied sources", () => {
  const state = network();
  assert.deepEqual(state.flowTo("core", "alliance"), {
    flow: 9,
    connectedSources: ["east", "north", "south"],
    visited: ["core", "east", "north", "south"],
  });
  state.setEdgeState("core", "east", "broken");
  assert.equal(state.flowTo("core", "alliance").flow, 6);
});

test("three valid core connections activate partial Hexa resonance", () => {
  const state = network();
  assert.deepEqual(state.formationProgress("core", "alliance"), {
    slots: 3,
    maxSlots: 6,
    resonance: true,
    bonus: { id: "arcane-resonance", combatEnergyStart: 1 },
  });
  state.setEdgeState("core", "south", "disabled");
  assert.deepEqual(state.formationProgress("core", "alliance"), {
    slots: 2,
    maxSlots: 6,
    resonance: false,
    bonus: null,
  });
});

test("enemy and unstable nodes do not relay Octarina flow", () => {
  const state = new OctarinaNetwork({ nodes: [
    nodes[0],
    { ...nodes[1], ownerFactionId: "rubra" },
    { ...nodes[2], state: "unstable" },
  ], edges: [
    { a: "core", b: "north" },
    { a: "core", b: "east" },
  ]});
  assert.deepEqual(state.flowTo("core", "alliance"), { flow: 0, connectedSources: [], visited: ["core"] });
});

test("Octarina links obey node range instead of physical road adjacency", () => {
  assert.throws(() => new OctarinaNetwork({
    nodes: [
      { id: "core", q: 0, r: 0, kind: "core", ownerFactionId: "alliance", state: "active", range: 1 },
      { id: "far", q: 2, r: 0, kind: "source", ownerFactionId: "alliance", state: "active", range: 1 },
    ],
    edges: [{ a: "core", b: "far" }],
  }), /out of range/);
});
