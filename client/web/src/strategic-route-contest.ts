import {
  strategicAdjacentNodeIds,
  strategicEdgeBetween,
  strategicUnit,
  type StrategicBoard,
  type StrategicCell,
  type StrategicFaction,
  type StrategicUnitId,
} from "./strategic-board-model";

function deriveContestedCells(board: StrategicBoard, faction: StrategicFaction): StrategicCell[] {
  const edgeIndex = new Map(board.edges.map((edge) => [edge.id, edge]));
  return board.cells.map((cell) => {
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

export function strategicContestTargets(board: StrategicBoard, unitId: StrategicUnitId): string[] {
  const unit = strategicUnit(board, unitId);
  if (unit.hp <= 0) return [];

  return strategicAdjacentNodeIds(board, unit.nodeId).filter((targetNodeId) => {
    const edge = strategicEdgeBetween(board, unit.nodeId, targetNodeId);
    return edge?.state === "road" && edge.owner !== null && edge.owner !== unit.faction;
  });
}

export function strategicContestRoute(
  board: StrategicBoard,
  unitId: StrategicUnitId,
  targetNodeId: string,
): StrategicBoard {
  if (!strategicContestTargets(board, unitId).includes(targetNodeId)) return board;

  const unit = strategicUnit(board, unitId);
  const edge = strategicEdgeBetween(board, unit.nodeId, targetNodeId);
  if (!edge) return board;

  const edges = board.edges.map((candidate) => candidate.id === edge.id
    ? { ...candidate, owner: unit.faction, state: "road" as const }
    : candidate);
  const projected = { ...board, edges };

  return {
    ...projected,
    cells: deriveContestedCells(projected, unit.faction),
  };
}
