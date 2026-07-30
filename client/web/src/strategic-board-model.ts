export type StrategicFaction = "blue" | "red";
export type StrategicUnitId = "kael" | "lyra" | "varg" | "brakk";
export type StrategicStructureType = "bastion" | "watchtower";
export type StrategicResult = "playing" | "victory" | "defeat";
export type StrategicRouteState = "unbuilt" | "road";

export interface StrategicNode {
  id: string;
  col: number;
  row: number;
}

export interface StrategicEdge {
  id: string;
  a: string;
  b: string;
  owner: StrategicFaction | null;
  state: StrategicRouteState;
}

export interface StrategicStructure {
  type: StrategicStructureType;
  owner: StrategicFaction;
}

export interface StrategicCell {
  id: string;
  col: number;
  row: number;
  corners: [string, string, string, string];
  edgeIds: [string, string, string, string];
  owner: StrategicFaction | null;
  structure: StrategicStructure | null;
}

export interface StrategicUnit {
  id: StrategicUnitId;
  name: string;
  role: string;
  faction: StrategicFaction;
  nodeId: string;
  hp: number;
  maxHp: number;
}

export interface StrategicBoard {
  nodes: StrategicNode[];
  edges: StrategicEdge[];
  cells: StrategicCell[];
  units: StrategicUnit[];
}

export interface StrategicAiTurn {
  board: StrategicBoard;
  message: string;
}

export const STRATEGIC_COLUMNS = 3;
export const STRATEGIC_ROWS = 3;

export function strategicNodeId(col: number, row: number): string {
  return `s-${col}-${row}`;
}

export function strategicEdgeId(a: string, b: string): string {
  return [a, b].sort().join("--");
}

function makeEdge(
  aCol: number,
  aRow: number,
  bCol: number,
  bRow: number,
  owner: StrategicFaction | null = null,
): StrategicEdge {
  const a = strategicNodeId(aCol, aRow);
  const b = strategicNodeId(bCol, bRow);
  return {
    id: strategicEdgeId(a, b),
    a,
    b,
    owner,
    state: owner ? "road" : "unbuilt",
  };
}

function cellEdges(corners: StrategicCell["corners"]): StrategicCell["edgeIds"] {
  const [nw, ne, se, sw] = corners;
  return [
    strategicEdgeId(nw, ne),
    strategicEdgeId(ne, se),
    strategicEdgeId(sw, se),
    strategicEdgeId(nw, sw),
  ];
}

function deriveCells(cells: StrategicCell[], edges: StrategicEdge[]): StrategicCell[] {
  const edgeIndex = new Map(edges.map((edge) => [edge.id, edge]));
  return cells.map((cell) => {
    const boundary = cell.edgeIds.map((id) => edgeIndex.get(id));
    const firstOwner = boundary[0]?.owner ?? null;
    const owner = firstOwner
      && boundary.every((edge) => edge?.state === "road" && edge.owner === firstOwner)
      ? firstOwner
      : null;
    return {
      ...cell,
      owner,
      structure: owner && cell.structure?.owner === owner ? cell.structure : null,
    };
  });
}

export function createStrategicBoard(): StrategicBoard {
  const nodes: StrategicNode[] = [];
  for (let row = 0; row < STRATEGIC_ROWS; row += 1) {
    for (let col = 0; col < STRATEGIC_COLUMNS; col += 1) {
      nodes.push({ id: strategicNodeId(col, row), col, row });
    }
  }

  // Three blue roads already outline most of the south-west region.
  // Kael can construct the missing connection s-1-1 -> s-1-2 to close it.
  const edgeOwners = new Map<string, StrategicFaction>([
    [strategicEdgeId(strategicNodeId(0, 1), strategicNodeId(1, 1)), "blue"],
    [strategicEdgeId(strategicNodeId(0, 1), strategicNodeId(0, 2)), "blue"],
    [strategicEdgeId(strategicNodeId(0, 2), strategicNodeId(1, 2)), "blue"],
    [strategicEdgeId(strategicNodeId(1, 0), strategicNodeId(1, 1)), "blue"],
    [strategicEdgeId(strategicNodeId(1, 0), strategicNodeId(2, 0)), "red"],
    [strategicEdgeId(strategicNodeId(2, 0), strategicNodeId(2, 1)), "red"],
  ]);

  const edges: StrategicEdge[] = [];
  for (let row = 0; row < STRATEGIC_ROWS; row += 1) {
    for (let col = 0; col < STRATEGIC_COLUMNS; col += 1) {
      if (col < STRATEGIC_COLUMNS - 1) {
        const id = strategicEdgeId(strategicNodeId(col, row), strategicNodeId(col + 1, row));
        edges.push(makeEdge(col, row, col + 1, row, edgeOwners.get(id) ?? null));
      }
      if (row < STRATEGIC_ROWS - 1) {
        const id = strategicEdgeId(strategicNodeId(col, row), strategicNodeId(col, row + 1));
        edges.push(makeEdge(col, row, col, row + 1, edgeOwners.get(id) ?? null));
      }
    }
  }

  const cells: StrategicCell[] = [];
  for (let row = 0; row < STRATEGIC_ROWS - 1; row += 1) {
    for (let col = 0; col < STRATEGIC_COLUMNS - 1; col += 1) {
      const corners: StrategicCell["corners"] = [
        strategicNodeId(col, row),
        strategicNodeId(col + 1, row),
        strategicNodeId(col + 1, row + 1),
        strategicNodeId(col, row + 1),
      ];
      cells.push({
        id: `sc-${col}-${row}`,
        col,
        row,
        corners,
        edgeIds: cellEdges(corners),
        owner: null,
        structure: null,
      });
    }
  }

  const units: StrategicUnit[] = [
    { id: "kael", name: "Kael", role: "Guardião", faction: "blue", nodeId: strategicNodeId(1, 1), hp: 18, maxHp: 18 },
    { id: "lyra", name: "Lyra", role: "Arqueira", faction: "blue", nodeId: strategicNodeId(0, 2), hp: 14, maxHp: 14 },
    { id: "varg", name: "Varg", role: "Batedor", faction: "red", nodeId: strategicNodeId(2, 0), hp: 12, maxHp: 12 },
    { id: "brakk", name: "Brakk", role: "Campeão", faction: "red", nodeId: strategicNodeId(2, 2), hp: 16, maxHp: 16 },
  ];

  return { nodes, edges, cells: deriveCells(cells, edges), units };
}

export function strategicUnit(board: StrategicBoard, unitId: StrategicUnitId): StrategicUnit {
  const unit = board.units.find((entry) => entry.id === unitId);
  if (!unit) throw new Error(`Unknown strategic unit: ${unitId}`);
  return unit;
}

export function strategicUnitAt(board: StrategicBoard, nodeId: string): StrategicUnit | null {
  return board.units.find((unit) => unit.hp > 0 && unit.nodeId === nodeId) ?? null;
}

export function strategicAdjacentNodeIds(board: StrategicBoard, nodeId: string): string[] {
  return board.edges.flatMap((edge) => edge.a === nodeId ? [edge.b] : edge.b === nodeId ? [edge.a] : []);
}

export function strategicBuildTargets(board: StrategicBoard, unitId: StrategicUnitId): string[] {
  const unit = strategicUnit(board, unitId);
  if (unit.hp <= 0) return [];
  return strategicAdjacentNodeIds(board, unit.nodeId).filter((target) => {
    const edge = board.edges.find((entry) => entry.id === strategicEdgeId(unit.nodeId, target));
    return edge?.state === "unbuilt" && !strategicUnitAt(board, target);
  });
}

export function strategicMoveTargets(board: StrategicBoard, unitId: StrategicUnitId): string[] {
  const unit = strategicUnit(board, unitId);
  if (unit.hp <= 0) return [];
  return strategicAdjacentNodeIds(board, unit.nodeId).filter((target) => {
    const edge = board.edges.find((entry) => entry.id === strategicEdgeId(unit.nodeId, target));
    return edge?.state === "road" && edge.owner === unit.faction && !strategicUnitAt(board, target);
  });
}

export function strategicAttackTargets(board: StrategicBoard, unitId: StrategicUnitId): StrategicUnitId[] {
  const unit = strategicUnit(board, unitId);
  if (unit.hp <= 0) return [];
  const adjacent = new Set(strategicAdjacentNodeIds(board, unit.nodeId));
  return board.units
    .filter((target) => target.hp > 0 && target.faction !== unit.faction && adjacent.has(target.nodeId))
    .map((target) => target.id);
}

export function strategicClaimEdge(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): StrategicBoard {
  if (!strategicBuildTargets(board, unitId).includes(targetNodeId)) return board;
  const unit = strategicUnit(board, unitId);
  const edgeId = strategicEdgeId(unit.nodeId, targetNodeId);
  const edges = board.edges.map((edge) => edge.id === edgeId
    ? { ...edge, owner: unit.faction, state: "road" as const }
    : edge);
  return { ...board, edges, cells: deriveCells(board.cells, edges) };
}

export function strategicMoveUnit(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): StrategicBoard {
  if (!strategicMoveTargets(board, unitId).includes(targetNodeId)) return board;
  return {
    ...board,
    units: board.units.map((unit) => unit.id === unitId ? { ...unit, nodeId: targetNodeId } : unit),
  };
}

export function strategicAttack(board: StrategicBoard, attackerId: StrategicUnitId, targetId: StrategicUnitId): StrategicBoard {
  if (!strategicAttackTargets(board, attackerId).includes(targetId)) return board;
  const attacker = strategicUnit(board, attackerId);
  const damage = attacker.id === "kael" ? 6 : attacker.id === "lyra" ? 5 : attacker.id === "brakk" ? 5 : 3;
  return {
    ...board,
    units: board.units.map((unit) => unit.id === targetId ? { ...unit, hp: Math.max(0, unit.hp - damage) } : unit),
  };
}

export function strategicStructureTargets(board: StrategicBoard, unitId: StrategicUnitId): string[] {
  const unit = strategicUnit(board, unitId);
  if (unit.hp <= 0) return [];
  return board.cells
    .filter((cell) => cell.owner === unit.faction && !cell.structure && cell.corners.includes(unit.nodeId))
    .map((cell) => cell.id);
}

export function strategicBuildStructure(
  board: StrategicBoard,
  unitId: StrategicUnitId,
  cellId: string,
  type: StrategicStructureType,
): StrategicBoard {
  if (!strategicStructureTargets(board, unitId).includes(cellId)) return board;
  const unit = strategicUnit(board, unitId);
  return {
    ...board,
    cells: board.cells.map((cell) => cell.id === cellId
      ? { ...cell, structure: { type, owner: unit.faction } }
      : cell),
  };
}

export function strategicOwnedCellCount(board: StrategicBoard, faction: StrategicFaction): number {
  return board.cells.filter((cell) => cell.owner === faction).length;
}

export function strategicStructureCount(board: StrategicBoard, faction: StrategicFaction): number {
  return board.cells.filter((cell) => cell.structure?.owner === faction).length;
}

export function strategicRoadCount(board: StrategicBoard, faction: StrategicFaction): number {
  return board.edges.filter((edge) => edge.state === "road" && edge.owner === faction).length;
}

export function strategicActionBudget(board: StrategicBoard, faction: StrategicFaction): number {
  return Math.min(5, 3 + strategicStructureCount(board, faction));
}

export function strategicResult(board: StrategicBoard): StrategicResult {
  const blueAlive = board.units.some((unit) => unit.faction === "blue" && unit.hp > 0);
  const redAlive = board.units.some((unit) => unit.faction === "red" && unit.hp > 0);
  if (!blueAlive) return "defeat";
  if (!redAlive) return "victory";
  if (strategicOwnedCellCount(board, "blue") >= 2 && strategicStructureCount(board, "blue") >= 1) return "victory";
  if (strategicOwnedCellCount(board, "red") >= 2 && strategicStructureCount(board, "red") >= 1) return "defeat";
  return "playing";
}

export function strategicEnemyTurn(board: StrategicBoard): StrategicAiTurn {
  const enemies = board.units.filter((unit) => unit.faction === "red" && unit.hp > 0);
  for (const enemy of enemies) {
    const attacks = strategicAttackTargets(board, enemy.id);
    if (attacks.length > 0) {
      return { board: strategicAttack(board, enemy.id, attacks[0]), message: `${enemy.name} atacou uma unidade de Orun.` };
    }
  }

  for (const enemy of enemies) {
    const builds = strategicBuildTargets(board, enemy.id);
    if (builds.length > 0) {
      let next = strategicClaimEdge(board, enemy.id, builds[0]);
      const structures = strategicStructureTargets(next, enemy.id);
      if (structures.length > 0) next = strategicBuildStructure(next, enemy.id, structures[0], "watchtower");
      return { board: next, message: `${enemy.name} construiu uma estrada rubra.` };
    }
  }

  for (const enemy of enemies) {
    const moves = strategicMoveTargets(board, enemy.id);
    if (moves.length > 0) {
      return { board: strategicMoveUnit(board, enemy.id, moves[0]), message: `${enemy.name} avançou por uma estrada rubra.` };
    }
  }

  return { board, message: "A Legião Rubra manteve posição." };
}
