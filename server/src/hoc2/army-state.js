import { hexKey, hexNeighbors } from "./hex-coordinates.js";

const TERRAIN_COST = Object.freeze({ plain: 1, road: 1, forest: 2, mountain: 3, water: Infinity });
const SUPPLY_STATES = new Set(["supplied", "low", "cut-off"]);

function normalizeArmy(raw) {
  if (!raw || raw.id == null || !raw.factionId || !Number.isInteger(raw.q) || !Number.isInteger(raw.r)) throw new TypeError("army requires id,factionId,q,r");
  const supply = raw.supply ?? "supplied";
  if (!SUPPLY_STATES.has(supply)) throw new TypeError(`invalid supply state: ${supply}`);
  return {
    id: String(raw.id), factionId: String(raw.factionId), commanderId: raw.commanderId ? String(raw.commanderId) : null,
    q: raw.q, r: raw.r, movementMax: Number.isFinite(raw.movementMax) ? raw.movementMax : 4,
    movementRemaining: Number.isFinite(raw.movementRemaining) ? raw.movementRemaining : (Number.isFinite(raw.movementMax) ? raw.movementMax : 4),
    supply, formation: raw.formation ?? "balanced", state: raw.state ?? "ready",
    units: Array.isArray(raw.units) ? raw.units.map((unit) => ({ ...unit })) : [],
  };
}

export function movementCost(hex, supply = "supplied") {
  const base = TERRAIN_COST[hex.terrain] ?? 1;
  if (!Number.isFinite(base)) return Infinity;
  return supply === "cut-off" ? base + 1 : supply === "low" ? base + 0.5 : base;
}

export class ArmyState {
  constructor({ hexes = [], armies = [] } = {}) {
    this.hexes = new Map(hexes.map((hex) => [hexKey(hex), { ...hex }]));
    this.armies = new Map(armies.map((raw) => { const army = normalizeArmy(raw); return [army.id, army]; }));
  }

  army(id) { const value = this.armies.get(String(id)); return value ? { ...value, units: value.units.map((u) => ({ ...u })) } : null; }
  occupantAt(hex) { return [...this.armies.values()].find((army) => army.q === hex.q && army.r === hex.r) ?? null; }
  enemyZoneOfControl(factionId) {
    const keys = new Set();
    for (const army of this.armies.values()) if (army.factionId !== factionId) for (const hex of hexNeighbors(army)) if (this.hexes.has(hexKey(hex))) keys.add(hexKey(hex));
    return keys;
  }

  reachable(armyId) {
    const army = this.armies.get(String(armyId)); if (!army) return [];
    const zoc = this.enemyZoneOfControl(army.factionId);
    const start = hexKey(army); const best = new Map([[start, 0]]); const queue = [{ q: army.q, r: army.r, cost: 0, path: [start] }]; const results = [];
    while (queue.length) {
      queue.sort((a,b) => a.cost - b.cost || a.path.join("|").localeCompare(b.path.join("|")));
      const current = queue.shift();
      for (const next of hexNeighbors(current)) {
        const key = hexKey(next), tile = this.hexes.get(key); if (!tile) continue;
        const occupant = this.occupantAt(next); if (occupant?.factionId === army.factionId) continue;
        const step = movementCost(tile, army.supply); const cost = current.cost + step;
        if (!Number.isFinite(step) || cost > army.movementRemaining || cost >= (best.get(key) ?? Infinity)) continue;
        best.set(key, cost);
        const contact = occupant && occupant.factionId !== army.factionId;
        const entersZoc = zoc.has(key);
        const path = [...current.path, key]; results.push({ q: next.q, r: next.r, cost, path, contact: Boolean(contact), zoc: entersZoc });
        if (!contact && !entersZoc) queue.push({ q: next.q, r: next.r, cost, path });
      }
    }
    return results.sort((a,b) => a.cost - b.cost || hexKey(a).localeCompare(hexKey(b)));
  }

  move(armyId, destination) {
    const army = this.armies.get(String(armyId)); if (!army) throw new TypeError("army not found");
    const target = this.reachable(armyId).find((candidate) => candidate.q === destination.q && candidate.r === destination.r);
    if (!target) throw new TypeError("destination is not reachable");
    const enemy = this.occupantAt(destination);
    if (enemy && enemy.factionId !== army.factionId) return { type: "ENEMY_CONTACT", attackerId: army.id, defenderId: enemy.id, hex: { q: destination.q, r: destination.r }, cost: target.cost, path: target.path };
    army.q = destination.q; army.r = destination.r; army.movementRemaining -= target.cost; army.state = army.movementRemaining > 0 ? "moved" : "exhausted";
    return { type: "MOVED", armyId: army.id, hex: { q: army.q, r: army.r }, movementRemaining: army.movementRemaining, path: target.path };
  }

  snapshot() { return { schemaVersion: 1, armies: [...this.armies.values()].sort((a,b) => a.id.localeCompare(b.id)).map((a) => ({ ...a, units: a.units.map((u) => ({ ...u })) })) }; }
}
