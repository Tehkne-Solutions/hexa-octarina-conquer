export type StrategicFaction = "blue" | "red";
export type StrategicUnitId = "kael" | "lyra" | "varg" | "brakk";
export type StrategicStructureType = "bastion" | "watchtower";
export type StrategicResult = "playing" | "victory" | "defeat";
export type StrategicRouteState = "unbuilt" | "road";

export interface StrategicNode {
  id: string;
  col: number;
  row: number;
  name: string;
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
  name: string;
  biome: "grass" | "forest" | "water" | "rock";
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

const NODE_NAMES = [
  "Portal do Norte",
  "Mirante de Orun",
  "Bastião Rubro",
  "Posto da Floresta",
  "Entroncamento Central",
  "Torre da Vigília",
  "Acampamento de Lyra",
  "Vau Octarino",
  "Portão Rubro",
] as const;

const CELL_DEFINITIONS = [
  { name: "Bosque de Orun", biome: "grass" },
  { name: "Vale da Vigília", biome: "forest" },
  { name: "Vau Octarino", biome: "water" },
  { name: "Escarpas Rubras", biome: "rock" },
] as const;

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
      const index = row * STRATEGIC_COLUMNS + col;
      nodes.push({
        id: strategicNodeId(col, row),
        col,
        row,
        name: NODE_NAMES[index],
      });
    }
  }

  const edgeOwners = new Map<string, StrategicFaction>([
    [strategicEdgeId(strategicNodeId(0, 1), strategicNodeId(1, 1)), "blue"],
    [strategicEdgeId(strategicNodeId(0, 1), strategicNodeId(0, 2)), "blue"],
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
      const index = row * (STRATEGIC_COLUMNS - 1) + col;
      const definition = CELL_DEFINITIONS[index];
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
        name: definition.name,
        biome: definition.biome,
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

export function strategicEdgeBetween(board: StrategicBoard, a: string, b: string): StrategicEdge | null {
  return board.edges.find((edge) => edge.id === strategicEdgeId(a, b)) ?? null;
}

export function strategicBuildTargets(board: StrategicBoard, unitId: StrategicUnitId): string[] {
  const unit = strategicUnit(board, unitId);
  if (unit.hp <= 0) return [];

  return strategicAdjacentNodeIds(board, unit.nodeId).filter((targetNodeId) => {
    const edge = strategicEdgeBetween(board, unit.nodeId, targetNodeId);
    return edge?.state === "unbuilt";
  });
}

export function strategicConfrontationTargets(board: StrategicBoard, unitId: StrategicUnitId): string[] {
  const unit = strategicUnit(board, unitId);
  if (unit.hp <= 0) return [];

  return strategicBuildTargets(board, unitId).filter((targetNodeId) => {
    const targetUnit = strategicUnitAt(board, targetNodeId);
    return Boolean(targetUnit && targetUnit.faction !== unit.faction);
  });
}

export function strategicMoveTargets(board: StrategicBoard, unitId: StrategicUnitId): string[] {
  const unit = strategicUnit(board, unitId);
  if (unit.hp <= 0) return [];

  return strategicAdjacentNodeIds(board, unit.nodeId).filter((targetNodeId) => {
    const edge = strategicEdgeBetween(board, unit.nodeId, targetNodeId);
    return edge?.state === "road"
      && edge.owner === unit.faction
      && !strategicUnitAt(board, targetNodeId);
  });
}

export function strategicAttackTargets(board: StrategicBoard, unitId: StrategicUnitId): StrategicUnitId[] {
  const unit = strategicUnit(board, unitId);
  if (unit.hp <= 0) return [];

  return board.units
    .filter((target) => {
      if (target.hp <= 0 || target.faction === unit.faction) return false;
      const edge = strategicEdgeBetween(board, unit.nodeId, target.nodeId);
      return edge?.state === "road";
    })
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

export function strategicCellRoadProgress(
  board: StrategicBoard,
  cellId: string,
  faction: StrategicFaction,
): number {
  const cell = board.cells.find((entry) => entry.id === cellId);
  if (!cell) return 0;
  const edgeIndex = new Map(board.edges.map((edge) => [edge.id, edge]));
  return cell.edgeIds.filter((edgeId) => {
    const edge = edgeIndex.get(edgeId);
    return edge?.state === "road" && edge.owner === faction;
  }).length;
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
  const redDefeated = board.units.some((unit) => unit.faction === "red" && unit.hp <= 0);
  const blueDefeated = board.units.some((unit) => unit.faction === "blue" && unit.hp <= 0);

  if (!blueAlive) return "defeat";
  if (!redAlive) return "victory";
  if (
    strategicOwnedCellCount(board, "blue") >= 2
    && strategicStructureCount(board, "blue") >= 1
    && redDefeated
  ) return "victory";
  if (
    strategicOwnedCellCount(board, "red") >= 2
    && strategicStructureCount(board, "red") >= 1
    && blueDefeated
  ) return "defeat";
  return "playing";
}

function strategicNodeDistance(board: StrategicBoard, a: string, b: string): number {
  const nodeA = board.nodes.find((node) => node.id === a);
  const nodeB = board.nodes.find((node) => node.id === b);
  if (!nodeA || !nodeB) return Number.POSITIVE_INFINITY;
  return Math.abs(nodeA.col - nodeB.col) + Math.abs(nodeA.row - nodeB.row);
}

export function strategicPreferredMove(board: StrategicBoard, unitId: StrategicUnitId): string | null {
  const unit = strategicUnit(board, unitId);
  const moves = strategicMoveTargets(board, unitId);
  if (moves.length === 0) return null;

  const targets = board.units
    .filter((candidate) => candidate.faction !== unit.faction && candidate.hp > 0)
    .sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
  if (targets.length === 0) return moves.sort()[0] ?? null;

  const critical = unit.hp / unit.maxHp <= 0.4;
  const scored = moves.map((nodeId) => ({
    nodeId,
    distance: Math.min(...targets.map((target) => strategicNodeDistance(board, nodeId, target.nodeId))),
  }));

  scored.sort((a, b) => critical
    ? b.distance - a.distance || a.nodeId.localeCompare(b.nodeId)
    : a.distance - b.distance || a.nodeId.localeCompare(b.nodeId));

  return scored[0]?.nodeId ?? null;
}

export function strategicEnemyTurn(board: StrategicBoard): StrategicAiTurn {
  let next = board;
  const messages: string[] = [];
  const movedUnits = new Set<StrategicUnitId>();
  const attackedUnits = new Set<StrategicUnitId>();
  const budget = strategicActionBudget(board, "red");

  for (let action = 0; action < budget && strategicResult(next) === "playing"; action += 1) {
    const enemies = next.units.filter((unit) => unit.faction === "red" && unit.hp > 0);
    let acted = false;

    for (const enemy of enemies) {
      const structures = strategicStructureTargets(next, enemy.id);
      if (structures.length > 0) {
        next = strategicBuildStructure(next, enemy.id, structures[0], "watchtower");
        messages.push(`${enemy.name} ergueu uma Torre de Vigília Rubra.`);
        acted = true;
        break;
      }
    }
    if (acted) continue;

    for (const enemy of enemies) {
      if (attackedUnits.has(enemy.id)) continue;
      const attacks = strategicAttackTargets(next, enemy.id)
        .map((targetId) => strategicUnit(next, targetId))
        .sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
      if (attacks.length > 0) {
        next = strategicAttack(next, enemy.id, attacks[0].id);
        attackedUnits.add(enemy.id);
        messages.push(`${enemy.name} atacou ${attacks[0].name} por uma estrada construída.`);
        acted = true;
        break;
      }
    }
    if (acted) continue;

    for (const enemy of enemies) {
      const confrontations = strategicConfrontationTargets(next, enemy.id)
        .map((nodeId) => ({ nodeId, target: strategicUnitAt(next, nodeId) }))
        .filter((entry): entry is { nodeId: string; target: StrategicUnit } => Boolean(entry.target))
        .sort((a, b) => a.target.hp - b.target.hp || a.target.id.localeCompare(b.target.id));
      if (confrontations.length > 0) {
        const selected = confrontations[0];
        next = strategicClaimEdge(next, enemy.id, selected.nodeId);
        messages.push(`${enemy.name} abriu uma rota de confronto contra ${selected.target.name}.`);
        acted = true;
        break;
      }
    }
    if (acted) continue;

    if (strategicOwnedCellCount(next, "red") < 1) {
      for (const enemy of enemies) {
        const builds = strategicBuildTargets(next, enemy.id);
        if (builds.length > 0) {
          next = strategicClaimEdge(next, enemy.id, builds[0]);
          messages.push(`${enemy.name} construiu uma estrada Rubra.`);
          acted = true;
          break;
        }
      }
      if (acted) continue;
    }

    for (const enemy of enemies) {
      const builds = strategicBuildTargets(next, enemy.id);
      if (builds.length > 0) {
        next = strategicClaimEdge(next, enemy.id, builds[0]);
        messages.push(`${enemy.name} expandiu a rede de estradas Rubras.`);
        acted = true;
        break;
      }
    }
    if (acted) continue;

    for (const enemy of enemies) {
      if (movedUnits.has(enemy.id)) continue;
      const selectedMove = strategicPreferredMove(next, enemy.id);
      if (selectedMove) {
        const critical = enemy.hp / enemy.maxHp <= 0.4;
        next = strategicMoveUnit(next, enemy.id, selectedMove);
        movedUnits.add(enemy.id);
        messages.push(critical
          ? `${enemy.name} recuou para preservar a unidade.`
          : `${enemy.name} avançou em direção ao alvo mais vulnerável.`);
        acted = true;
        break;
      }
    }

    if (!acted) break;
  }

  return {
    board: next,
    message: messages.length > 0 ? messages.join(" ") : "A Legião Rubra manteve posição.",
  };
}
