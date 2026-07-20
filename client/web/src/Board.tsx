import { useMemo, useState } from "react";

import { canonicalEdge, isAdjacent, type Point, type RoomSnapshot } from "./protocol";

interface BoardProps {
  snapshot: RoomSnapshot;
  localPlayerId: string | null;
  disabled?: boolean;
  onPlayEdge: (start: Point, end: Point) => void;
  onSelectProvince: (provinceId: string) => void;
  selectedProvinceId?: string | null;
}

const PLAYER_COLORS = ["#ff5d73", "#4fc3ff", "#e6c55d", "#8ee66b"];

export function Board({
  snapshot,
  localPlayerId,
  disabled = false,
  onPlayEdge,
  onSelectProvince,
  selectedProvinceId,
}: BoardProps) {
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const board = snapshot.board;
  const size = board.boardSize;
  const spacing = 100;
  const padding = 46;
  const dimension = (size - 1) * spacing + padding * 2;

  const playerColors = useMemo(() => {
    return new Map(snapshot.players.map((player, index) => [player.id, PLAYER_COLORS[index % PLAYER_COLORS.length]]));
  }, [snapshot.players]);

  const occupiedEdges = useMemo(
    () => new Set(board.edges.map((edge) => canonicalEdge(edge.start, edge.end))),
    [board.edges],
  );

  const points = Array.from({ length: size * size }, (_, index): Point => [index % size, Math.floor(index / size)]);

  const tapPoint = (point: Point) => {
    if (disabled || board.currentPlayerId !== localPlayerId) return;
    if (!selectedPoint) {
      setSelectedPoint(point);
      return;
    }
    if (selectedPoint[0] === point[0] && selectedPoint[1] === point[1]) {
      setSelectedPoint(null);
      return;
    }
    if (!isAdjacent(selectedPoint, point) || occupiedEdges.has(canonicalEdge(selectedPoint, point))) {
      setSelectedPoint(point);
      return;
    }
    onPlayEdge(selectedPoint, point);
    setSelectedPoint(null);
  };

  const position = ([x, y]: Point) => ({ x: padding + x * spacing, y: padding + y * spacing });

  return (
    <div className="board-shell" aria-label="Tabuleiro tático">
      <svg
        className="board"
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="application"
        aria-label={`Tabuleiro ${size} por ${size}`}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="boardFloor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#161b35" />
            <stop offset="1" stopColor="#090c1b" />
          </linearGradient>
        </defs>

        <rect x="8" y="8" width={dimension - 16} height={dimension - 16} rx="38" fill="url(#boardFloor)" stroke="#31395f" strokeWidth="3" />

        {board.cells.map((cell) => {
          const x = padding + cell.x * spacing + 7;
          const y = padding + cell.y * spacing + 7;
          const color = playerColors.get(cell.ownerId) ?? "#6f789e";
          const province = board.provinces.find((item) => item.id === cell.provinceId);
          const selected = selectedProvinceId === cell.provinceId;
          return (
            <g key={cell.id} onClick={() => onSelectProvince(cell.provinceId)} className="province-cell" role="button">
              <rect
                x={x}
                y={y}
                width={spacing - 14}
                height={spacing - 14}
                rx="18"
                fill={color}
                fillOpacity={selected ? 0.48 : 0.25}
                stroke={selected ? "#ffffff" : color}
                strokeWidth={selected ? 5 : 2}
                filter={selected ? "url(#glow)" : undefined}
              />
              {province && (
                <text x={x + (spacing - 14) / 2} y={y + 51} textAnchor="middle" className="province-label">
                  {province.unit.kind === "fortress" ? "♜" : "◆"} {province.unit.hp}
                </text>
              )}
            </g>
          );
        })}

        {board.edges.map((edge) => {
          const start = position(edge.start);
          const end = position(edge.end);
          const color = playerColors.get(edge.ownerId) ?? "#9ba6ce";
          return (
            <line
              key={canonicalEdge(edge.start, edge.end)}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              filter="url(#glow)"
            />
          );
        })}

        {points.map((point) => {
          const { x, y } = position(point);
          const selected = selectedPoint?.[0] === point[0] && selectedPoint?.[1] === point[1];
          return (
            <g key={`${point[0]}-${point[1]}`} onClick={() => tapPoint(point)} className="board-point" role="button">
              <circle cx={x} cy={y + 5} r="18" fill="#02040c" opacity="0.65" />
              <circle
                cx={x}
                cy={y}
                r={selected ? 20 : 15}
                fill={selected ? "#ffe99a" : "#d9e4ff"}
                stroke={selected ? "#ffffff" : "#4d5b8b"}
                strokeWidth={selected ? 6 : 4}
                filter={selected ? "url(#glow)" : undefined}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
