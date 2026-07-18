import { ProtocolError } from "./protocol.js";

function pointKey([x, y]) {
  return `${x},${y}`;
}

function cellKey([x, y]) {
  return `${x},${y}`;
}

function edgeKey(start, end) {
  const [a, b] = [start, end].sort((left, right) => {
    if (left[0] !== right[0]) return left[0] - right[0];
    return left[1] - right[1];
  });
  return `${pointKey(a)}|${pointKey(b)}`;
}

function parsePoint(raw) {
  return raw.split(",").map(Number);
}

function parseEdge(raw) {
  const [left, right] = raw.split("|");
  return [parsePoint(left), parsePoint(right)];
}

function cloneUnit(unit) {
  return {
    kind: unit?.kind ?? "recruit",
    level: unit?.level ?? 1,
    hp: unit?.hp ?? 3,
    element: unit?.element ?? "physical",
  };
}

function provinceStrength(province) {
  return province.unit.level * 2 + province.unit.hp;
}

export class BoardState {
  constructor(size) {
    this.size = size;
    this.edges = new Map();
    this.cells = new Map();
    this.provinces = new Map();
    this.nextProvinceId = 1;
    this.currentPlayerIndex = 0;
    this.turnNumber = 1;
    this.actionsRemaining = 1;
    this.playerOrder = [];
  }

  setPlayerOrder(playerIds) {
    this.playerOrder = [...playerIds];
    if (this.currentPlayerIndex >= this.playerOrder.length) this.currentPlayerIndex = 0;
  }

  get currentPlayerId() {
    return this.playerOrder[this.currentPlayerIndex] ?? null;
  }

  validateActor(playerId) {
    if (this.playerOrder.length < 2) {
      throw new ProtocolError("ROOM_NOT_READY", "the room requires two players");
    }
    if (this.currentPlayerId !== playerId) {
      throw new ProtocolError("NOT_YOUR_TURN", "only the active player can perform macro actions", {
        currentPlayerId: this.currentPlayerId,
      });
    }
  }

  validateEdge(start, end) {
    for (const [x, y] of [start, end]) {
      if (x < 0 || y < 0 || x >= this.size || y >= this.size) {
        throw new ProtocolError("EDGE_OUT_OF_BOUNDS", "edge point is outside the board");
      }
    }
    if (Math.abs(start[0] - end[0]) + Math.abs(start[1] - end[1]) !== 1) {
      throw new ProtocolError("INVALID_EDGE", "edges must join orthogonally adjacent points");
    }
    const key = edgeKey(start, end);
    if (this.edges.has(key)) {
      throw new ProtocolError("EDGE_EXISTS", "edge already exists");
    }
    return key;
  }

  playEdge(playerId, start, end, { consumeAction = true } = {}) {
    this.validateActor(playerId);
    if (consumeAction && this.actionsRemaining <= 0) {
      throw new ProtocolError("NO_ACTIONS", "no board actions remain in this turn");
    }

    const key = this.validateEdge(start, end);
    this.edges.set(key, playerId);
    const claimedProvinceIds = [];

    for (const cell of this.cellsTouchingEdge(start, end)) {
      const keyCell = cellKey(cell);
      if (!this.cells.has(keyCell) && this.isClosedCell(cell)) {
        const province = this.claimCell(cell, playerId);
        if (!claimedProvinceIds.includes(province.id)) claimedProvinceIds.push(province.id);
      }
    }

    let turnChanged = false;
    if (consumeAction) {
      this.actionsRemaining -= 1;
      this.actionsRemaining += claimedProvinceIds.length;
      if (this.actionsRemaining <= 0) turnChanged = this.advanceTurn();
    }

    return {
      edge: { start, end, ownerId: playerId },
      claimed: claimedProvinceIds,
      turnChanged,
      currentPlayerId: this.currentPlayerId,
      turnNumber: this.turnNumber,
      actionsRemaining: this.actionsRemaining,
    };
  }

  claimCell([x, y], ownerId) {
    const key = cellKey([x, y]);
    const id = `cell:${key}`;
    const alliedProvinceIds = new Set();

    for (const neighbor of this.adjacentCells([x, y])) {
      const cell = this.cells.get(cellKey(neighbor));
      if (cell?.ownerId === ownerId) alliedProvinceIds.add(cell.provinceId);
    }

    let province;
    if (alliedProvinceIds.size === 0) {
      province = {
        id: `province-${this.nextProvinceId++}`,
        ownerId,
        cellIds: [],
        unit: cloneUnit(),
        protectedTurns: 0,
      };
      this.provinces.set(province.id, province);
    } else {
      province = [...alliedProvinceIds]
        .map((provinceId) => this.provinces.get(provinceId))
        .filter(Boolean)
        .sort((left, right) => left.id.localeCompare(right.id))[0];
    }

    const cell = { id, x, y, ownerId, provinceId: province.id };
    this.cells.set(key, cell);
    province.cellIds.push(id);
    province.cellIds.sort();

    for (const provinceId of alliedProvinceIds) {
      if (provinceId !== province.id) this.mergeProvinces(province.id, provinceId);
    }
    return this.provinces.get(province.id);
  }

  mergeProvinces(primaryId, secondaryId) {
    const primary = this.provinces.get(primaryId);
    const secondary = this.provinces.get(secondaryId);
    if (!primary || !secondary || primary.ownerId !== secondary.ownerId) return primary;

    const strongest = provinceStrength(secondary) > provinceStrength(primary) ? secondary : primary;
    primary.unit = cloneUnit(strongest.unit);
    primary.unit.level = Math.max(primary.unit.level, secondary.unit.level);
    primary.unit.hp = Math.max(primary.unit.hp, secondary.unit.hp);
    primary.protectedTurns = Math.max(primary.protectedTurns ?? 0, secondary.protectedTurns ?? 0);

    for (const cellId of secondary.cellIds) {
      const cell = this.cells.get(cellId.slice(5));
      if (cell) cell.provinceId = primary.id;
      if (!primary.cellIds.includes(cellId)) primary.cellIds.push(cellId);
    }
    primary.cellIds.sort();
    this.provinces.delete(secondary.id);
    return primary;
  }

  mergeAdjacentAlliedProvince(provinceId) {
    let province = this.getProvince(provinceId);
    const adjacentIds = new Set();
    for (const cellId of province.cellIds) {
      const cell = this.cells.get(cellId.slice(5));
      if (!cell) continue;
      for (const neighbor of this.adjacentCells([cell.x, cell.y])) {
        const neighborCell = this.cells.get(cellKey(neighbor));
        if (neighborCell?.ownerId === province.ownerId && neighborCell.provinceId !== province.id) {
          adjacentIds.add(neighborCell.provinceId);
        }
      }
    }
    for (const adjacentId of adjacentIds) province = this.mergeProvinces(province.id, adjacentId);
    return province;
  }

  advanceTurn() {
    if (this.playerOrder.length < 2) return false;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
    this.turnNumber += 1;
    this.actionsRemaining = 1;
    for (const province of this.provinces.values()) {
      if (province.protectedTurns > 0) province.protectedTurns -= 1;
    }
    return true;
  }

  cellsTouchingEdge(start, end) {
    const [[x1, y1], [x2, y2]] = [start, end];
    const candidates = y1 === y2
      ? [[Math.min(x1, x2), y1 - 1], [Math.min(x1, x2), y1]]
      : [[x1 - 1, Math.min(y1, y2)], [x1, Math.min(y1, y2)]];
    return candidates.filter(([x, y]) => this.cellInBounds([x, y]));
  }

  cellInBounds([x, y]) {
    return x >= 0 && y >= 0 && x < this.size - 1 && y < this.size - 1;
  }

  adjacentCells([x, y]) {
    return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter((cell) => this.cellInBounds(cell));
  }

  isClosedCell([x, y]) {
    const required = [
      edgeKey([x, y], [x + 1, y]),
      edgeKey([x + 1, y], [x + 1, y + 1]),
      edgeKey([x, y + 1], [x + 1, y + 1]),
      edgeKey([x, y], [x, y + 1]),
    ];
    return required.every((key) => this.edges.has(key));
  }

  getProvince(provinceId) {
    if (typeof provinceId !== "string" || provinceId.trim() === "") {
      throw new ProtocolError("INVALID_PROVINCE", "provinceId must be a non-empty string");
    }
    if (provinceId.startsWith("cell:")) {
      const cell = this.cells.get(provinceId.slice(5));
      if (!cell) throw new ProtocolError("PROVINCE_NOT_FOUND", "province does not exist");
      provinceId = cell.provinceId;
    }
    const province = this.provinces.get(provinceId);
    if (!province) throw new ProtocolError("PROVINCE_NOT_FOUND", "province does not exist");
    return province;
  }

  captureProvince(provinceId, ownerId, hp = 3) {
    const province = this.getProvince(provinceId);
    province.ownerId = ownerId;
    province.unit = { kind: "recruit", level: 1, hp: Math.max(1, hp), element: "physical" };
    province.protectedTurns = 0;
    for (const cellId of province.cellIds) {
      const cell = this.cells.get(cellId.slice(5));
      if (cell) cell.ownerId = ownerId;
    }
    return this.mergeAdjacentAlliedProvince(province.id);
  }

  fortifyProvince(provinceId, playerId, value) {
    const province = this.getProvince(provinceId);
    if (province.ownerId !== playerId) {
      throw new ProtocolError("NOT_PROVINCE_OWNER", "only the owner can fortify this province");
    }
    province.unit.hp += value;
    if (province.unit.hp >= 6 && province.unit.kind !== "fortress") {
      province.unit.kind = "fortress";
      province.unit.level += 1;
    }
    return province;
  }

  detectSurroundedProvinces() {
    const surrounded = [];
    for (const province of this.provinces.values()) {
      if ((province.protectedTurns ?? 0) > 0) continue;
      const ownCells = new Set(province.cellIds);
      const frontier = new Set();
      for (const cellId of province.cellIds) {
        const cell = this.cells.get(cellId.slice(5));
        if (!cell) continue;
        for (const neighbor of this.adjacentCells([cell.x, cell.y])) {
          const neighborId = `cell:${cellKey(neighbor)}`;
          if (!ownCells.has(neighborId)) frontier.add(cellKey(neighbor));
        }
      }
      if (frontier.size === 0) continue;
      const owners = new Set();
      let hasLiberty = false;
      for (const frontierKey of frontier) {
        const cell = this.cells.get(frontierKey);
        if (!cell) {
          hasLiberty = true;
          break;
        }
        owners.add(cell.ownerId);
      }
      if (!hasLiberty && owners.size === 1) {
        const [attackerId] = owners;
        if (attackerId !== province.ownerId) surrounded.push({ provinceId: province.id, attackerId });
      }
    }
    return surrounded;
  }

  snapshot() {
    return {
      boardSize: this.size,
      currentPlayerId: this.currentPlayerId,
      turnNumber: this.turnNumber,
      actionsRemaining: this.actionsRemaining,
      edges: [...this.edges.entries()].map(([key, ownerId]) => {
        const [start, end] = parseEdge(key);
        return { start, end, ownerId };
      }),
      cells: [...this.cells.values()].map((cell) => ({ ...cell })),
      provinces: [...this.provinces.values()].map((province) => ({
        id: province.id,
        ownerId: province.ownerId,
        cellIds: [...province.cellIds],
        unit: cloneUnit(province.unit),
        protectedTurns: province.protectedTurns ?? 0,
      })),
    };
  }

  serialize() {
    return {
      ...this.snapshot(),
      nextProvinceId: this.nextProvinceId,
      currentPlayerIndex: this.currentPlayerIndex,
      playerOrder: [...this.playerOrder],
    };
  }

  static fromJSON(raw) {
    const board = new BoardState(raw.boardSize);
    board.currentPlayerIndex = raw.currentPlayerIndex ?? 0;
    board.turnNumber = raw.turnNumber ?? 1;
    board.actionsRemaining = raw.actionsRemaining ?? 1;
    board.playerOrder = [...(raw.playerOrder ?? [])];
    board.nextProvinceId = raw.nextProvinceId ?? 1;
    for (const edge of raw.edges ?? []) board.edges.set(edgeKey(edge.start, edge.end), edge.ownerId);
    for (const cell of raw.cells ?? []) board.cells.set(cellKey([cell.x, cell.y]), { ...cell });
    for (const province of raw.provinces ?? []) {
      board.provinces.set(province.id, {
        ...province,
        cellIds: [...province.cellIds],
        unit: cloneUnit(province.unit),
      });
    }
    return board;
  }
}

export const boardKeys = { pointKey, cellKey, edgeKey };
