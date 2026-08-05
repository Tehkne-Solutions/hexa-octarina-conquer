import assert from "node:assert/strict";
import test from "node:test";

import { StrategicNetwork, validatePhysicalEdge } from "../src/hoc2/strategic-network.js";

const nodes = [
  { id: "aldor", q: 0, r: 0, kind: "city", ownerFactionId: "alliance", state: "active", supplySource: true },
  { id: "bridge", q: 1, r: 0, kind: "bridge", ownerFactionId: "alliance", state: "active" },
  { id: "mine", q: 2, r: 0, kind: "mine", ownerFactionId: "alliance", state: "active" },
  { id: "outpost", q: 1, r: 1, kind: "outpost", ownerFactionId: "alliance", state: "active" },
];

test("physical edge validation uses axial adjacency", () => {
  assert.equal(validatePhysicalEdge(nodes[0], nodes[1]), true);
  assert.equal(validatePhysicalEdge(nodes[0], nodes[2]), false);
});

test("supply path follows only connected valid nodes", () => {
  const network = new StrategicNetwork({ nodes, edges: [
    { a: "aldor", b: "bridge" },
    { a: "bridge", b: "mine" },
  ]});
  assert.deepEqual(network.supplyPath("mine", "alliance"), ["mine", "bridge", "aldor"]);
  network.setEdgeState("bridge", "mine", "broken");
  assert.equal(network.supplyPath("mine", "alliance"), null);
  network.setEdgeState("bridge", "mine", "connected");
  assert.deepEqual(network.supplyPath("mine", "alliance"), ["mine", "bridge", "aldor"]);
});

test("closed allied network is detected as a circuit", () => {
  const network = new StrategicNetwork({ nodes, edges: [
    { a: "aldor", b: "bridge" },
    { a: "bridge", b: "mine" },
    { a: "mine", b: "outpost" },
    { a: "outpost", b: "aldor" },
  ]});
  assert.equal(network.hasCycleForFaction("alliance"), true);
  network.setEdgeState("mine", "outpost", "blocked");
  assert.equal(network.hasCycleForFaction("alliance"), false);
});

test("enemy or contested nodes cannot relay alliance supply", () => {
  const network = new StrategicNetwork({ nodes: [
    nodes[0],
    { ...nodes[1], ownerFactionId: "rubra" },
    nodes[2],
  ], edges: [{ a: "aldor", b: "bridge" }, { a: "bridge", b: "mine" }] });
  assert.equal(network.supplyPath("mine", "alliance"), null);
});
