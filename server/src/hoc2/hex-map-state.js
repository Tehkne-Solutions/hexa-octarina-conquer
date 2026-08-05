import { assertAxialCoordinate, compareHexes, hexKey } from "./hex-coordinates.js";

const VISIBILITY_STATES = new Set(["unknown", "explored", "visible"]);

function cloneInfluence(influence = {}) {
  return Object.fromEntries(
    Object.entries(influence)
      .map(([factionId, value]) => [String(factionId), Number(value)])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizeCell(raw) {
  assertAxialCoordinate(raw, "hex cell");
  const id = raw.id ?? hexKey(raw);
  const visibility = raw.visibility ?? "unknown";
  if (!VISIBILITY_STATES.has(visibility)) throw new TypeError(`invalid visibility state: ${visibility}`);

  return {
    id: String(id),
    q: raw.q,
    r: raw.r,
    terrain: raw.terrain ?? "plain",
    elevation: Number.isFinite(raw.elevation) ? raw.elevation : 0,
    provinceId: raw.provinceId ?? null,
    ownerFactionId: raw.ownerFactionId ?? null,
    controllerFactionId: raw.controllerFactionId ?? null,
    influence: cloneInfluence(raw.influence),
    visibility,
    armyId: raw.armyId ?? null,
    structureId: raw.structureId ?? null,
    resourceId: raw.resourceId ?? null,
    strategicNodeId: raw.strategicNodeId ?? null,
    octarinaNodeId: raw.octarinaNodeId ?? null,
    modifiers: Array.isArray(raw.modifiers) ? [...new Set(raw.modifiers.map(String))].sort() : [],
  };
}

function cloneCell(cell) {
  return {
    ...cell,
    influence: { ...cell.influence },
    modifiers: [...cell.modifiers],
  };
}

export class HexMapState {
  constructor(cells = []) {
    this.cells = new Map();
    for (const cell of cells) this.addCell(cell);
  }

  get size() {
    return this.cells.size;
  }

  has(hexOrKey) {
    return this.cells.has(typeof hexOrKey === "string" ? hexOrKey : hexKey(hexOrKey));
  }

  get(hexOrKey) {
    const key = typeof hexOrKey === "string" ? hexOrKey : hexKey(hexOrKey);
    const cell = this.cells.get(key);
    return cell ? cloneCell(cell) : null;
  }

  addCell(raw) {
    const cell = normalizeCell(raw);
    const coordinateKey = hexKey(cell);
    if (cell.id !== coordinateKey) {
      throw new TypeError(`hex cell id must match axial coordinates: expected ${coordinateKey}, received ${cell.id}`);
    }
    if (this.cells.has(coordinateKey)) throw new TypeError(`duplicate hex cell: ${coordinateKey}`);
    this.cells.set(coordinateKey, cell);
    return cloneCell(cell);
  }

  updateCell(hexOrKey, patch) {
    const key = typeof hexOrKey === "string" ? hexOrKey : hexKey(hexOrKey);
    const current = this.cells.get(key);
    if (!current) throw new TypeError(`hex cell does not exist: ${key}`);
    if (patch.q !== undefined || patch.r !== undefined || patch.id !== undefined) {
      throw new TypeError("hex coordinates and id are immutable after creation");
    }
    const next = normalizeCell({ ...current, ...patch, id: current.id, q: current.q, r: current.r });
    this.cells.set(key, next);
    return cloneCell(next);
  }

  removeCell(hexOrKey) {
    const key = typeof hexOrKey === "string" ? hexOrKey : hexKey(hexOrKey);
    return this.cells.delete(key);
  }

  orderedCells() {
    return [...this.cells.values()]
      .sort(compareHexes)
      .map(cloneCell);
  }

  snapshot() {
    return {
      schemaVersion: 1,
      coordinateSystem: "axial",
      cells: this.orderedCells(),
    };
  }

  serialize() {
    return this.snapshot();
  }

  static fromJSON(raw) {
    if (!raw || raw.schemaVersion !== 1 || raw.coordinateSystem !== "axial" || !Array.isArray(raw.cells)) {
      throw new TypeError("invalid HOC2 hex map payload");
    }
    return new HexMapState(raw.cells);
  }
}
