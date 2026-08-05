import { areHexAdjacent, hexKey } from "./hex-coordinates.js";

const EDGE_STATES = new Set(["connected", "blocked", "broken", "contested"]);
const NODE_STATES = new Set(["neutral", "claimed", "active", "contested", "disabled"]);

function nodeKey(node) {
  return String(node.id);
}

function normalizedNode(raw) {
  if (!raw || raw.id == null || !Number.isInteger(raw.q) || !Number.isInteger(raw.r)) throw new TypeError("strategic node requires id,q,r");
  const state = raw.state ?? "neutral";
  if (!NODE_STATES.has(state)) throw new TypeError(`invalid node state: ${state}`);
  return {
    id: String(raw.id), q: raw.q, r: raw.r,
    kind: String(raw.kind ?? "point"),
    ownerFactionId: raw.ownerFactionId ?? null,
    state,
    supplySource: Boolean(raw.supplySource),
  };
}

function edgeId(a, b) { return [String(a), String(b)].sort().join("~"); }

function normalizedEdge(raw, nodes) {
  if (!raw || raw.a == null || raw.b == null) throw new TypeError("strategic edge requires a and b");
  const a = String(raw.a), b = String(raw.b);
  if (a === b) throw new TypeError("strategic edge cannot self-connect");
  if (!nodes.has(a) || !nodes.has(b)) throw new TypeError("strategic edge endpoints must exist");
  const state = raw.state ?? "connected";
  if (!EDGE_STATES.has(state)) throw new TypeError(`invalid edge state: ${state}`);
  return { id: edgeId(a,b), a, b, kind: String(raw.kind ?? "road"), state };
}

export class StrategicNetwork {
  constructor({ nodes = [], edges = [] } = {}) {
    this.nodes = new Map(nodes.map((raw) => { const node = normalizedNode(raw); return [nodeKey(node), node]; }));
    this.edges = new Map();
    for (const raw of edges) { const edge = normalizedEdge(raw, this.nodes); this.edges.set(edge.id, edge); }
  }

  addNode(raw) {
    const node = normalizedNode(raw);
    if (this.nodes.has(node.id)) throw new TypeError(`duplicate strategic node: ${node.id}`);
    this.nodes.set(node.id, node);
    return { ...node };
  }

  connect(a, b, options = {}) {
    const edge = normalizedEdge({ a, b, ...options }, this.nodes);
    if (this.edges.has(edge.id)) throw new TypeError(`duplicate strategic edge: ${edge.id}`);
    this.edges.set(edge.id, edge);
    return { ...edge };
  }

  setEdgeState(a, b, state) {
    if (!EDGE_STATES.has(state)) throw new TypeError(`invalid edge state: ${state}`);
    const id = edgeId(a,b), current = this.edges.get(id);
    if (!current) throw new TypeError(`strategic edge does not exist: ${id}`);
    const next = { ...current, state }; this.edges.set(id, next); return { ...next };
  }

  activeNeighbors(nodeId) {
    const id = String(nodeId);
    return [...this.edges.values()]
      .filter((edge) => edge.state === "connected" && (edge.a === id || edge.b === id))
      .map((edge) => edge.a === id ? edge.b : edge.a)
      .sort();
  }

  supplyPath(fromId, factionId) {
    const start = String(fromId);
    if (!this.nodes.has(start)) return null;
    const queue = [[start]]; const seen = new Set([start]);
    while (queue.length) {
      const path = queue.shift(); const currentId = path[path.length - 1]; const current = this.nodes.get(currentId);
      if (current.supplySource && current.ownerFactionId === factionId && current.state === "active") return path;
      for (const nextId of this.activeNeighbors(currentId)) {
        if (seen.has(nextId)) continue;
        const next = this.nodes.get(nextId);
        if (next.state === "disabled" || next.state === "contested") continue;
        if (next.ownerFactionId != null && next.ownerFactionId !== factionId) continue;
        seen.add(nextId); queue.push([...path, nextId]);
      }
    }
    return null;
  }

  hasCycleForFaction(factionId) {
    const eligible = new Set([...this.nodes.values()].filter((n) => n.ownerFactionId === factionId && n.state === "active").map((n) => n.id));
    const visited = new Set();
    const walk = (id, parent) => {
      visited.add(id);
      for (const next of this.activeNeighbors(id)) {
        if (!eligible.has(next)) continue;
        if (!visited.has(next)) { if (walk(next, id)) return true; }
        else if (next !== parent) return true;
      }
      return false;
    };
    for (const id of eligible) if (!visited.has(id) && walk(id, null)) return true;
    return false;
  }

  snapshot() {
    return {
      schemaVersion: 1,
      nodes: [...this.nodes.values()].sort((a,b) => a.id.localeCompare(b.id)).map((n) => ({ ...n, hexId: hexKey(n) })),
      edges: [...this.edges.values()].sort((a,b) => a.id.localeCompare(b.id)).map((e) => ({ ...e })),
    };
  }
}

export function validatePhysicalEdge(nodeA, nodeB) {
  return areHexAdjacent(nodeA, nodeB);
}
