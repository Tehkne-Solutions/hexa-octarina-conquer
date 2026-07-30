export type MetaFaction = "blue" | "red" | "violet";

export interface MetaNode {
  id: string;
  col: number;
  row: number;
  kind: "normal" | "sanctuary" | "capital";
}

export interface MetaEdge {
  id: string;
  a: string;
  b: string;
  owner: MetaFaction | null;
}

export interface MetaCell {
  id: string;
  col: number;
  row: number;
  corners: [string, string, string, string];
  owner: MetaFaction | null;
}

export interface MetaBoardModel {
  columns: number;
  rows: number;
  nodes: MetaNode[];
  edges: MetaEdge[];
  cells: MetaCell[];
}

export interface MetaPoint {
  x: number;
  y: number;
}

export const META_COLUMNS = 7;
export const META_ROWS = 5;

export function metaNodeId(col: number, row: number): string {
  return `n-${col}-${row}`;
}

export function metaEdgeId(a: string, b: string): string {
  return [a, b].sort().join("--");
}

export function metaIsoPoint(col: number, row: number): MetaPoint {
  const tileWidth = 116;
  const tileHeight = 66;
  const originX = 540;
  const originY = 92;
  return {
    x: originX + (col - row) * (tileWidth / 2),
    y: originY + (col + row) * (tileHeight / 2),
  };
}

function initialOwner(col: number, row: number): MetaFaction | null {
  if (col <= 2 && row >= 1) return "blue";
  if (col >= 4 && row <= 2) return "red";
  if (col >= 3 && row >= 3) return "violet";
  return null;
}

function deriveCells(cells: MetaCell[], edges: MetaEdge[]): MetaCell[] {
  const edgeIndex = new Map(edges.map((edge) => [edge.id, edge]));
  return cells.map((cell) => {
    const [nw, ne, se, sw] = cell.corners;
    const owners = [
      edgeIndex.get(metaEdgeId(nw, ne))?.owner,
      edgeIndex.get(metaEdgeId(ne, se))?.owner,
      edgeIndex.get(metaEdgeId(sw, se))?.owner,
      edgeIndex.get(metaEdgeId(nw, sw))?.owner,
    ];
    const owner = owners[0] && owners.every((entry) => entry === owners[0]) ? owners[0] : null;
    return { ...cell, owner };
  });
}

export function createMetaBoardModel(): MetaBoardModel {
  const nodes: MetaNode[] = [];
  for (let row = 0; row < META_ROWS; row += 1) {
    for (let col = 0; col < META_COLUMNS; col += 1) {
      const isCapital = (col === 1 && row === 3) || (col === 5 && row === 1) || (col === 5 && row === 4);
      const isSanctuary = (col === 3 && row === 2) || (col === 2 && row === 1) || (col === 4 && row === 3);
      nodes.push({ id: metaNodeId(col, row), col, row, kind: isCapital ? "capital" : isSanctuary ? "sanctuary" : "normal" });
    }
  }

  const edges: MetaEdge[] = [];
  const kaelOpeningEdge = metaEdgeId(metaNodeId(1, 3), metaNodeId(1, 2));
  const pushEdge = (aCol: number, aRow: number, bCol: number, bRow: number) => {
    const a = metaNodeId(aCol, aRow);
    const b = metaNodeId(bCol, bRow);
    const leftOwner = initialOwner(aCol, aRow);
    const rightOwner = initialOwner(bCol, bRow);
    const edgeId = metaEdgeId(a, b);
    const owner = edgeId === kaelOpeningEdge ? null : leftOwner === rightOwner ? leftOwner : null;
    edges.push({ id: edgeId, a, b, owner });
  };

  for (let row = 0; row < META_ROWS; row += 1) {
    for (let col = 0; col < META_COLUMNS; col += 1) {
      if (col < META_COLUMNS - 1) pushEdge(col, row, col + 1, row);
      if (row < META_ROWS - 1) pushEdge(col, row, col, row + 1);
    }
  }

  const cells: MetaCell[] = [];
  for (let row = 0; row < META_ROWS - 1; row += 1) {
    for (let col = 0; col < META_COLUMNS - 1; col += 1) {
      const nw = metaNodeId(col, row);
      const ne = metaNodeId(col + 1, row);
      const sw = metaNodeId(col, row + 1);
      const se = metaNodeId(col + 1, row + 1);
      cells.push({ id: `c-${col}-${row}`, col, row, corners: [nw, ne, se, sw], owner: null });
    }
  }

  return { columns: META_COLUMNS, rows: META_ROWS, nodes, edges, cells: deriveCells(cells, edges) };
}

export function connectedNodeIds(board: MetaBoardModel, nodeId: string): string[] {
  return board.edges.flatMap((edge) => edge.a === nodeId ? [edge.b] : edge.b === nodeId ? [edge.a] : []);
}

export function canClaimEdge(board: MetaBoardModel, fromNodeId: string, toNodeId: string): boolean {
  const edge = board.edges.find((entry) => entry.id === metaEdgeId(fromNodeId, toNodeId));
  return Boolean(edge && edge.owner === null);
}

export function claimEdge(board: MetaBoardModel, fromNodeId: string, toNodeId: string, owner: MetaFaction): MetaBoardModel {
  if (!canClaimEdge(board, fromNodeId, toNodeId)) return board;
  const edgeId = metaEdgeId(fromNodeId, toNodeId);
  const edges = board.edges.map((edge) => edge.id === edgeId ? { ...edge, owner } : edge);
  return { ...board, edges, cells: deriveCells(board.cells, edges) };
}

export function countFactionCells(board: MetaBoardModel, faction: MetaFaction): number {
  return board.cells.filter((cell) => cell.owner === faction).length;
}

export function metaCellPolygon(cell: MetaCell): string {
  return cell.corners.map((id) => {
    const [, col, row] = id.split("-");
    const point = metaIsoPoint(Number(col), Number(row));
    return `${point.x},${point.y}`;
  }).join(" ");
}
