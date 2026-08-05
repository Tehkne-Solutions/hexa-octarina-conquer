import { hexDistance, hexKey } from "./hex-coordinates.js";

const NODE_KINDS = new Set(["source", "conductor", "core"]);
const NODE_STATES = new Set(["neutral", "claimed", "active", "contested", "unstable", "disabled"]);
const EDGE_STATES = new Set(["connected", "broken", "contested", "disabled"]);

function normalizeNode(raw) {
  if (!raw || raw.id == null || !Number.isInteger(raw.q) || !Number.isInteger(raw.r)) {
    throw new TypeError("Octarina node requires id,q,r");
  }
  const kind = raw.kind ?? "source";
  if (!NODE_KINDS.has(kind)) throw new TypeError(`invalid Octarina node kind: ${kind}`);
  const state = raw.state ?? "neutral";
  if (!NODE_STATES.has(state)) throw new TypeError(`invalid Octarina node state: ${state}`);
  const charge = Number(raw.charge ?? 0);
  if (!Number.isFinite(charge) || charge < 0) throw new TypeError("Octarina node charge must be non-negative");
  const range = Number(raw.range ?? (kind === "conductor" ? 2 : 1));
  if (!Number.isInteger(range) || range < 1) throw new TypeError("Octarina node range must be a positive integer");
  return {
    id: String(raw.id), q: raw.q, r: raw.r, kind,
    ownerFactionId: raw.ownerFactionId ?? null,
    state, charge, range,
    affinity: String(raw.affinity ?? "arcana"),
  };
}

function edgeId(a, b) { return [String(a), String(b)].sort().join("~"); }

function normalizeEdge(raw, nodes) {
  if (!raw || raw.a == null || raw.b == null) throw new TypeError("Octarina edge requires a and b");
  const a = String(raw.a), b = String(raw.b);
  if (a === b || !nodes.has(a) || !nodes.has(b)) throw new TypeError("invalid Octarina edge endpoints");
  const state = raw.state ?? "connected";
  if (!EDGE_STATES.has(state)) throw new TypeError(`invalid Octarina edge state: ${state}`);
  const left = nodes.get(a), right = nodes.get(b);
  const distance = hexDistance(left, right);
  if (distance > left.range || distance > right.range) throw new TypeError(`Octarina nodes out of range: ${a}~${b}`);
  return { id: edgeId(a,b), a, b, state };
}

export class OctarinaNetwork {
  constructor({ nodes = [], edges = [] } = {}) {
    this.nodes = new Map();
    for (const raw of nodes) {
      const node = normalizeNode(raw);
      if (this.nodes.has(node.id)) throw new TypeError(`duplicate Octarina node: ${node.id}`);
      this.nodes.set(node.id, node);
    }
    this.edges = new Map();
    for (const raw of edges) {
      const edge = normalizeEdge(raw, this.nodes);
      if (this.edges.has(edge.id)) throw new TypeError(`duplicate Octarina edge: ${edge.id}`);
      this.edges.set(edge.id, edge);
    }
  }

  setEdgeState(a, b, state) {
    if (!EDGE_STATES.has(state)) throw new TypeError(`invalid Octarina edge state: ${state}`);
    const id = edgeId(a,b), current = this.edges.get(id);
    if (!current) throw new TypeError(`Octarina edge does not exist: ${id}`);
    const next = { ...current, state };
    this.edges.set(id, next);
    return { ...next };
  }

  activeNeighbors(nodeId, factionId) {
    const id = String(nodeId);
    return [...this.edges.values()]
      .filter((edge) => edge.state === "connected" && (edge.a === id || edge.b === id))
      .map((edge) => edge.a === id ? edge.b : edge.a)
      .filter((nextId) => {
        const next = this.nodes.get(nextId);
        return next && next.state === "active" && next.ownerFactionId === factionId;
      })
      .sort();
  }

  flowTo(coreId, factionId) {
    const core = this.nodes.get(String(coreId));
    if (!core || core.kind !== "core" || core.state !== "active" || core.ownerFactionId !== factionId) {
      return { flow: 0, connectedSources: [], visited: [] };
    }
    const queue = [core.id];
    const seen = new Set(queue);
    const connectedSources = [];
    let flow = 0;
    while (queue.length) {
      const currentId = queue.shift();
      const current = this.nodes.get(currentId);
      if (current.kind === "source") {
        connectedSources.push(current.id);
        flow += current.charge;
      }
      for (const nextId of this.activeNeighbors(currentId, factionId)) {
        if (!seen.has(nextId)) { seen.add(nextId); queue.push(nextId); }
      }
    }
    return { flow, connectedSources: connectedSources.sort(), visited: [...seen].sort() };
  }

  formationProgress(coreId, factionId) {
    const core = this.nodes.get(String(coreId));
    if (!core || core.kind !== "core") return { slots: 0, maxSlots: 6, resonance: false, bonus: null };
    const neighbors = this.activeNeighbors(core.id, factionId);
    const slots = Math.min(6, neighbors.length);
    return {
      slots,
      maxSlots: 6,
      resonance: slots >= 3,
      bonus: slots >= 3 ? { id: "arcane-resonance", combatEnergyStart: 1 } : null,
    };
  }

  snapshot() {
    return {
      schemaVersion: 1,
      nodes: [...this.nodes.values()].sort((a,b) => a.id.localeCompare(b.id)).map((node) => ({ ...node, hexId: hexKey(node) })),
      edges: [...this.edges.values()].sort((a,b) => a.id.localeCompare(b.id)).map((edge) => ({ ...edge })),
    };
  }
}
