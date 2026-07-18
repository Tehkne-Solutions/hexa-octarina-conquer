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

export class BoardState {
  constructor(size) {
    this.size = size;
    this.edges = new Map();
    this.cells = new Map();
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
    const claimed = [];

    for (const cell of this.cellsTouchingEdge(start, end)) {
      const keyCell = cellKey(cell);
      if (!this.cells.has(keyCell) && this.isClosedCell(cell)) {
        this.cells.set(keyCell, {
          id: `cell:${keyCell}`,
          x: cell[0],
          y: cell[1],
          ownerId: playerId,
          unit: { kind: "recruit", level: 1, hp: 3 },
        });
        claimed.push(`cell:${keyCell}`);
      }
    }

    let turnChanged = false;
    if (consumeAction) {
      this.actionsRemaining -= 1;
      this.actionsRemaining += claimed.length;
      if (this.actionsRemaining <= 0) turnChanged = this.advanceTurn();
    }

    return {
      edge: { start, end, ownerId: playerId },
      claimed,
      turnChanged,
      currentPlayerId: this.currentPlayerId,
      turnNumber: this.turnNumber,
      actionsRemaining: this.actionsRemaining,
    };
  }

  advanceTurn() {
    if (this.playerOrder.length < 2) return false;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
    this.turnNumber += 1;
    this.actionsRemaining = 1;
    return true;
  }

  cellsTouchingEdge(start, end) {
    const [[x1, y1], [x2, y2]] = [start, end];
    const candidates = y1 === y2
      ? [[Math.min(x1, x2), y1 - 1], [Math.min(x1, x2), y1]]
      : [[x1 - 1, Math.min(y1, y2)], [x1, Math.min(y1, y2)]];
    return candidates.filter(([x, y]) => x >= 0 && y >= 0 && x < this.size - 1 && y < this.size - 1);
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
    if (typeof provinceId !== "string" || !provinceId.startsWith("cell:")) {
      throw new ProtocolError("INVALID_PROVINCE", "provinceId must reference a claimed cell");
    }
    const province = this.cells.get(provinceId.slice(5));
    if (!province) throw new ProtocolError("PROVINCE_NOT_FOUND", "province does not exist");
    return province;
  }

  captureProvince(provinceId, ownerId, hp = 3) {
    const province = this.getProvince(provinceId);
    province.ownerId = ownerId;
    province.unit = { kind: "recruit", level: 1, hp: Math.max(1, hp) };
    return province;
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
      cells: [...this.cells.values()].map((cell) => ({
        id: cell.id,
        x: cell.x,
        y: cell.y,
        ownerId: cell.ownerId,
        unit: { ...cell.unit },
      })),
    };
  }
}

export const boardKeys = { pointKey, cellKey, edgeKey };
