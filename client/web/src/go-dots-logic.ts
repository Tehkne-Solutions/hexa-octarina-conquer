import type { Faction } from "./living-board-data";

export interface GridPoint {
  x: number;
  y: number;
}

export type InfluenceOwner = Faction | "contested";

export interface InfluenceEdge {
  id: string;
  start: GridPoint;
  end: GridPoint;
  owner: InfluenceOwner;
}

export interface ClaimedCell {
  id: string;
  x: number;
  y: number;
  owner: Faction;
}

export function canonicalEdgeId(start: GridPoint, end: GridPoint): string {
  const [left, right] = [start, end].sort((a, b) => a.x - b.x || a.y - b.y);
  return `${left.x},${left.y}|${right.x},${right.y}`;
}

export function registerInfluenceEdge(
  edges: InfluenceEdge[],
  start: GridPoint,
  end: GridPoint,
  owner: Faction,
): InfluenceEdge[] {
  const id = canonicalEdgeId(start, end);
  const current = edges.find((edge) => edge.id === id);
  if (!current) return [...edges, { id, start, end, owner }];
  if (current.owner === owner || current.owner === "contested") return edges;
  return edges.map((edge) => edge.id === id ? { ...edge, owner: "contested" } : edge);
}

function cellEdgeIds(x: number, y: number): string[] {
  return [
    canonicalEdgeId({ x, y }, { x: x + 1, y }),
    canonicalEdgeId({ x: x + 1, y }, { x: x + 1, y: y + 1 }),
    canonicalEdgeId({ x, y: y + 1 }, { x: x + 1, y: y + 1 }),
    canonicalEdgeId({ x, y }, { x, y: y + 1 }),
  ];
}

export function deriveClaimedCells(edges: InfluenceEdge[], boardSize: number): ClaimedCell[] {
  const byId = new Map(edges.map((edge) => [edge.id, edge]));
  const cells: ClaimedCell[] = [];

  for (let y = 0; y < boardSize - 1; y += 1) {
    for (let x = 0; x < boardSize - 1; x += 1) {
      const borders = cellEdgeIds(x, y).map((id) => byId.get(id));
      if (borders.some((edge) => !edge || edge.owner === "contested")) continue;
      const owner = borders[0]?.owner;
      if ((owner === "player" || owner === "enemy") && borders.every((edge) => edge?.owner === owner)) {
        cells.push({ id: `${x},${y}`, x, y, owner });
      }
    }
  }

  return cells;
}

export function gridPercent(value: number, boardSize: number): number {
  const margin = 6;
  return margin + (value / (boardSize - 1)) * (100 - margin * 2);
}
