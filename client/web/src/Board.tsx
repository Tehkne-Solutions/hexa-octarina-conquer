import { useEffect, useMemo, useState } from "react";

import {
  canonicalEdge,
  isAdjacent,
  type Point,
  type RoomSnapshot,
  type UnitState,
} from "./protocol";

interface BoardProps {
  snapshot: RoomSnapshot;
  localPlayerId: string | null;
  disabled?: boolean;
  onPlayEdge: (start: Point, end: Point) => void;
  onSelectProvince: (provinceId: string) => void;
  selectedProvinceId?: string | null;
}

type EdgePair = [Point, Point];
type PixelPoint = { x: number; y: number };

const PLAYER_COLORS = ["#ff5d73", "#4fc3ff", "#e6c55d", "#8ee66b"];

function samePoint(left: Point, right: Point): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function edgeContains(edge: EdgePair, point: Point): boolean {
  return samePoint(edge[0], point) || samePoint(edge[1], point);
}

function shade(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  const adjusted = channels.map((channel) => {
    const target = amount >= 0 ? 255 : 0;
    return Math.round(channel + (target - channel) * Math.abs(amount));
  });
  return `#${adjusted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function RuneWall({ start, end, color }: { start: PixelPoint; end: PixelPoint; color: string }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const dark = shade(color, -0.62);
  const mid = shade(color, -0.18);
  const light = shade(color, 0.58);
  const stones = [0.18, 0.36, 0.54, 0.72, 0.9];

  return (
    <g className="rune-wall" pointerEvents="none">
      <line
        x1={start.x}
        y1={start.y + 8}
        x2={end.x}
        y2={end.y + 8}
        stroke="#01030a"
        strokeWidth="28"
        strokeLinecap="round"
        opacity="0.8"
      />
      <line
        className="wall-build wall-foundation"
        pathLength={1}
        x1={start.x}
        y1={start.y + 3}
        x2={end.x}
        y2={end.y + 3}
        stroke={dark}
        strokeWidth="24"
        strokeLinecap="round"
      />
      <line
        className="wall-build wall-body"
        pathLength={1}
        x1={start.x}
        y1={start.y - 2}
        x2={end.x}
        y2={end.y - 2}
        stroke={mid}
        strokeWidth="17"
        strokeLinecap="round"
      />
      <line
        className="wall-build wall-rune-channel"
        pathLength={1}
        x1={start.x}
        y1={start.y - 5}
        x2={end.x}
        y2={end.y - 5}
        stroke={light}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.82"
      />

      {stones.map((ratio, index) => {
        const x = start.x + dx * ratio;
        const y = start.y + dy * ratio - 3;
        return (
          <g
            key={ratio}
            className="wall-stone"
            transform={`translate(${x} ${y}) rotate(${angle})`}
            style={{ animationDelay: `${index * 55}ms` }}
          >
            <rect x="-8" y="-10" width="16" height="20" rx="3" fill={dark} stroke={light} strokeWidth="2" />
            <path d="M -4 -5 L 0 -9 L 4 -5 L 0 0 Z" fill={light} opacity="0.9" />
            <line x1="0" y1="1" x2="0" y2="7" stroke={color} strokeWidth="2" opacity="0.9" />
          </g>
        );
      })}

      <g className="wall-cap" transform={`translate(${start.x} ${start.y - 2})`}>
        <circle r="13" fill={dark} stroke={light} strokeWidth="3" />
        <path d="M 0 -8 L 7 0 L 0 8 L -7 0 Z" fill={color} stroke={light} strokeWidth="1.5" />
      </g>
      <g className="wall-cap" transform={`translate(${end.x} ${end.y - 2})`}>
        <circle r="13" fill={dark} stroke={light} strokeWidth="3" />
        <path d="M 0 -8 L 7 0 L 0 8 L -7 0 Z" fill={color} stroke={light} strokeWidth="1.5" />
      </g>
    </g>
  );
}

function HpBadge({ x, y, hp, color }: { x: number; y: number; hp: number; color: string }) {
  return (
    <g className="entity-hp-badge" transform={`translate(${x} ${y})`} pointerEvents="none">
      <rect x="-17" y="-10" width="34" height="20" rx="10" fill="#080b18" stroke={shade(color, 0.55)} strokeWidth="2" />
      <path d="M -10 -1 C -10 -7 -2 -8 0 -3 C 2 -8 10 -7 10 -1 C 10 4 4 7 0 10 C -4 7 -10 4 -10 -1 Z" fill="#ff7187" transform="scale(.45) translate(-11 -1)" />
      <text x="5" y="1" dominantBaseline="middle" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">
        {hp}
      </text>
    </g>
  );
}

function RecruitEntity({ cx, cy, color, unit }: { cx: number; cy: number; color: string; unit: UnitState }) {
  const dark = shade(color, -0.68);
  const armor = shade(color, -0.16);
  const light = shade(color, 0.55);

  return (
    <g className="territory-entity recruit-entity" pointerEvents="none">
      <ellipse cx={cx} cy={cy + 28} rx="31" ry="13" fill="#02040c" opacity="0.72" />
      <ellipse cx={cx} cy={cy + 21} rx="29" ry="12" fill={dark} stroke={light} strokeWidth="2.5" />
      <ellipse cx={cx} cy={cy + 18} rx="21" ry="8" fill={color} opacity="0.5" />

      <line x1={cx + 18} y1={cy - 24} x2={cx + 22} y2={cy + 22} stroke={light} strokeWidth="4" strokeLinecap="round" />
      <path d={`M ${cx + 18} ${cy - 29} L ${cx + 25} ${cy - 19} L ${cx + 13} ${cy - 20} Z`} fill={light} stroke={dark} strokeWidth="1.5" />

      <path
        d={`M ${cx - 18} ${cy + 17} L ${cx - 13} ${cy - 7} L ${cx} ${cy - 16} L ${cx + 13} ${cy - 7} L ${cx + 18} ${cy + 17} Z`}
        fill={armor}
        stroke={light}
        strokeWidth="3"
      />
      <path d={`M ${cx - 13} ${cy + 10} L ${cx} ${cy - 5} L ${cx + 13} ${cy + 10} L ${cx} ${cy + 18} Z`} fill={color} opacity="0.88" />
      <circle cx={cx} cy={cy - 24} r="10" fill="#d7b38c" stroke={dark} strokeWidth="3" />
      <path d={`M ${cx - 11} ${cy - 26} Q ${cx} ${cy - 39} ${cx + 11} ${cy - 26} L ${cx + 7} ${cy - 18} L ${cx - 7} ${cy - 18} Z`} fill={dark} stroke={light} strokeWidth="2" />

      <circle cx={cx - 19} cy={cy + 2} r="13" fill={dark} stroke={light} strokeWidth="3" />
      <path d={`M ${cx - 19} ${cy - 6} L ${cx - 11} ${cy + 2} L ${cx - 19} ${cy + 10} L ${cx - 27} ${cy + 2} Z`} fill={color} />
      <circle cx={cx} cy={cy + 6} r="4" fill={light} className="entity-core" />
      <HpBadge x={cx} y={cy + 42} hp={unit.hp} color={color} />
    </g>
  );
}

function FortressEntity({ cx, cy, color, unit }: { cx: number; cy: number; color: string; unit: UnitState }) {
  const dark = shade(color, -0.72);
  const stone = shade(color, -0.28);
  const light = shade(color, 0.62);

  return (
    <g className="territory-entity fortress-entity" pointerEvents="none">
      <ellipse cx={cx} cy={cy + 30} rx="39" ry="16" fill="#02040c" opacity="0.75" />
      <path d={`M ${cx - 38} ${cy + 14} L ${cx} ${cy - 2} L ${cx + 38} ${cy + 14} L ${cx + 28} ${cy + 31} L ${cx - 28} ${cy + 31} Z`} fill={dark} stroke={light} strokeWidth="2.5" />

      <rect x={cx - 22} y={cy - 18} width="44" height="39" rx="4" fill={stone} stroke={light} strokeWidth="3" />
      <rect x={cx - 34} y={cy - 9} width="18" height="34" rx="3" fill={dark} stroke={light} strokeWidth="3" />
      <rect x={cx + 16} y={cy - 9} width="18" height="34" rx="3" fill={dark} stroke={light} strokeWidth="3" />

      {[-30, -22, -14, 14, 22, 30].map((offset) => (
        <rect key={offset} x={cx + offset - 3} y={cy - 15} width="7" height="9" rx="1" fill={stone} stroke={light} strokeWidth="1.5" />
      ))}
      {[-16, -5, 6, 17].map((offset) => (
        <rect key={offset} x={cx + offset - 3} y={cy - 25} width="7" height="10" rx="1" fill={stone} stroke={light} strokeWidth="1.5" />
      ))}

      <path d={`M ${cx - 8} ${cy + 21} Q ${cx} ${cy + 4} ${cx + 8} ${cy + 21} Z`} fill="#050713" stroke={light} strokeWidth="2" />
      <path d={`M ${cx} ${cy - 9} L ${cx + 9} ${cy} L ${cx} ${cy + 9} L ${cx - 9} ${cy} Z`} fill={color} stroke={light} strokeWidth="2" className="entity-core" />

      <line x1={cx} y1={cy - 28} x2={cx} y2={cy - 48} stroke={light} strokeWidth="3" />
      <path d={`M ${cx + 2} ${cy - 47} L ${cx + 22} ${cy - 40} L ${cx + 2} ${cy - 32} Z`} fill={color} stroke={light} strokeWidth="1.5" />
      <HpBadge x={cx} y={cy + 47} hp={unit.hp} color={color} />
    </g>
  );
}

function OutpostEntity({ cx, cy, color, unit }: { cx: number; cy: number; color: string; unit: UnitState }) {
  const dark = shade(color, -0.7);
  const light = shade(color, 0.62);
  return (
    <g className="territory-entity outpost-entity" pointerEvents="none">
      <ellipse cx={cx} cy={cy + 22} rx="25" ry="10" fill="#02040c" opacity="0.65" />
      <ellipse cx={cx} cy={cy + 17} rx="24" ry="10" fill={dark} stroke={light} strokeWidth="2" />
      <path d={`M ${cx} ${cy - 27} L ${cx + 13} ${cy + 10} L ${cx} ${cy + 18} L ${cx - 13} ${cy + 10} Z`} fill={color} stroke={light} strokeWidth="3" />
      <path d={`M ${cx} ${cy - 18} L ${cx + 6} ${cy + 4} L ${cx} ${cy + 10} L ${cx - 6} ${cy + 4} Z`} fill={light} opacity="0.82" className="entity-core" />
      <HpBadge x={cx} y={cy + 37} hp={unit.hp} color={color} />
    </g>
  );
}

export function Board({
  snapshot,
  localPlayerId,
  disabled = false,
  onPlayEdge,
  onSelectProvince,
  selectedProvinceId,
}: BoardProps) {
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [pendingEdge, setPendingEdge] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
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

  const candidateEdges = useMemo(() => {
    const edges: EdgePair[] = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (x < size - 1) edges.push([[x, y], [x + 1, y]]);
        if (y < size - 1) edges.push([[x, y], [x, y + 1]]);
      }
    }
    return edges;
  }, [size]);

  const availableEdges = useMemo(
    () => candidateEdges.filter(([start, end]) => !occupiedEdges.has(canonicalEdge(start, end))),
    [candidateEdges, occupiedEdges],
  );

  const validEdgesFromSelection = useMemo(() => {
    if (!selectedPoint) return [];
    return availableEdges.filter((edge) => edgeContains(edge, selectedPoint));
  }, [availableEdges, selectedPoint]);

  const tutorialActive = snapshot.mode === "campaign"
    && snapshot.campaign?.mission.order === 1
    && board.edges.length === 0;
  const center = Math.max(0, Math.floor((size - 1) / 2));
  const suggestedEdge: EdgePair = center > 0
    ? [[center - 1, center], [center, center]]
    : [[0, 0], [1, 0]];
  const suggestedEdgeKey = tutorialActive ? canonicalEdge(suggestedEdge[0], suggestedEdge[1]) : null;

  const points = Array.from({ length: size * size }, (_, index): Point => [index % size, Math.floor(index / size)]);
  const canAct = !disabled && board.currentPlayerId === localPlayerId;

  useEffect(() => {
    setSelectedPoint(null);
    if (pendingEdge) {
      if (occupiedEdges.has(pendingEdge)) setFeedback("Muro rúnico erguido. Aguarde a resposta da IA.");
      setPendingEdge(null);
    }
  }, [snapshot.revision]);

  useEffect(() => {
    if (!pendingEdge) return;
    const timer = window.setTimeout(() => {
      setPendingEdge(null);
      setFeedback("A construção não foi confirmada. Tente novamente ou aguarde a conexão estabilizar.");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [pendingEdge]);

  useEffect(() => {
    if (disabled) setSelectedPoint(null);
  }, [disabled]);

  const requestEdge = (start: Point, end: Point) => {
    if (!canAct) {
      setFeedback(board.currentPlayerId === localPlayerId ? "Aguarde a partida ficar pronta." : "Aguarde a jogada da IA.");
      return;
    }
    const key = canonicalEdge(start, end);
    if (occupiedEdges.has(key)) {
      setFeedback("Esse muro já existe. Escolha outro segmento pontilhado.");
      return;
    }
    setPendingEdge(key);
    setSelectedPoint(null);
    setFeedback("Construindo muro rúnico...");
    onPlayEdge(start, end);
  };

  const tapPoint = (point: Point) => {
    if (!canAct) {
      setFeedback(board.currentPlayerId === localPlayerId ? "A partida ainda não está pronta." : "Agora é a vez da IA.");
      return;
    }
    if (!selectedPoint) {
      setSelectedPoint(point);
      setFeedback("Pilar selecionado. Agora toque em um pilar verde ao lado.");
      return;
    }
    if (samePoint(selectedPoint, point)) {
      setSelectedPoint(null);
      setFeedback("Seleção cancelada. Você também pode tocar diretamente em um segmento pontilhado.");
      return;
    }
    if (!isAdjacent(selectedPoint, point)) {
      setFeedback("Esse pilar não é vizinho. Escolha um dos pilares verdes ligados à seleção.");
      return;
    }
    if (occupiedEdges.has(canonicalEdge(selectedPoint, point))) {
      setFeedback("Já existe um muro entre esses pilares.");
      return;
    }
    requestEdge(selectedPoint, point);
  };

  const position = ([x, y]: Point): PixelPoint => ({ x: padding + x * spacing, y: padding + y * spacing });

  const guideMessage = feedback
    ?? (tutorialActive
      ? "TOQUE NA LINHA DOURADA. Ela crescerá como um muro rúnico permanente."
      : selectedPoint
        ? "Agora toque em um dos pilares verdes vizinhos."
        : board.cells.length === 0
          ? "Toque em um segmento pontilhado para erguer um muro. Feche quatro lados para criar uma unidade."
          : "Feche quadrados para criar unidades e fortalezas dentro do território.");

  return (
    <div className={`board-shell ${tutorialActive ? "tutorial-board" : ""}`} aria-label="Tabuleiro tático">
      <div className={`board-guide ${pendingEdge ? "pending" : ""}`} role="status" aria-live="polite">
        <strong>{tutorialActive ? "PRIMEIRO MURO" : pendingEdge ? "CONSTRUINDO" : selectedPoint ? "PILAR SELECIONADO" : "COMO JOGAR"}</strong>
        <span>{guideMessage}</span>
      </div>
      <svg
        className="board"
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="application"
        aria-label={`Tabuleiro ${size} por ${size}`}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
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
          const selected = selectedProvinceId === cell.provinceId;
          return (
            <g key={`tile-${cell.id}`} onClick={() => onSelectProvince(cell.provinceId)} className="province-cell" role="button">
              <rect
                x={x}
                y={y}
                width={spacing - 14}
                height={spacing - 14}
                rx="18"
                className="territory-tile"
                fill={shade(color, -0.72)}
                stroke={selected ? "#ffffff" : shade(color, 0.28)}
                strokeWidth={selected ? 5 : 2.5}
              />
              <rect
                x={x + 7}
                y={y + 7}
                width={spacing - 28}
                height={spacing - 28}
                rx="13"
                fill={color}
                fillOpacity={selected ? 0.28 : 0.13}
                stroke={color}
                strokeOpacity="0.45"
                strokeWidth="1.5"
              />
            </g>
          );
        })}

        {availableEdges.map(([startPoint, endPoint]) => {
          const start = position(startPoint);
          const end = position(endPoint);
          const key = canonicalEdge(startPoint, endPoint);
          const fromSelection = selectedPoint ? edgeContains([startPoint, endPoint], selectedPoint) : false;
          const suggested = key === suggestedEdgeKey;
          const pending = key === pendingEdge;
          return (
            <g key={`option-${key}`} className={`edge-option ${fromSelection ? "valid" : ""} ${suggested ? "suggested" : ""} ${pending ? "pending" : ""}`}>
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                className="edge-option-visible"
                strokeWidth={suggested || fromSelection ? 9 : 4}
                strokeLinecap="round"
                strokeDasharray={suggested || fromSelection ? "14 9" : "7 13"}
                pointerEvents="none"
              />
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                className="edge-option-hit"
                stroke="transparent"
                strokeWidth="34"
                strokeLinecap="round"
                pointerEvents="stroke"
                role="button"
                tabIndex={0}
                aria-label={`Erguer muro de ${startPoint.join(",")} até ${endPoint.join(",")}`}
                onClick={() => requestEdge(startPoint, endPoint)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") requestEdge(startPoint, endPoint);
                }}
              />
            </g>
          );
        })}

        {board.edges.map((edge) => {
          const color = playerColors.get(edge.ownerId) ?? "#9ba6ce";
          return (
            <RuneWall
              key={`wall-${canonicalEdge(edge.start, edge.end)}`}
              start={position(edge.start)}
              end={position(edge.end)}
              color={color}
            />
          );
        })}

        {board.cells.map((cell) => {
          const province = board.provinces.find((item) => item.id === cell.provinceId);
          if (!province) return null;
          const color = playerColors.get(cell.ownerId) ?? "#6f789e";
          const cx = padding + cell.x * spacing + spacing / 2;
          const cy = padding + cell.y * spacing + spacing / 2 - 4;
          const anchor = province.cellIds[0] === cell.id;
          const isFortress = province.unit.kind === "fortress" || province.unit.level >= 3;
          return (
            <g key={`entity-${cell.id}`} onClick={() => onSelectProvince(cell.provinceId)} className="province-entity-hit" role="button">
              {isFortress && anchor ? (
                <FortressEntity cx={cx} cy={cy} color={color} unit={province.unit} />
              ) : anchor ? (
                <RecruitEntity cx={cx} cy={cy} color={color} unit={province.unit} />
              ) : (
                <OutpostEntity cx={cx} cy={cy} color={color} unit={province.unit} />
              )}
            </g>
          );
        })}

        {points.map((point) => {
          const { x, y } = position(point);
          const selected = selectedPoint?.[0] === point[0] && selectedPoint?.[1] === point[1];
          const validNeighbor = validEdgesFromSelection.some((edge) => edgeContains(edge, point) && !samePoint(point, selectedPoint!));
          return (
            <g key={`${point[0]}-${point[1]}`} onClick={() => tapPoint(point)} className={`board-point ${validNeighbor ? "valid-neighbor" : ""}`} role="button">
              <circle cx={x} cy={y + 7} r="19" fill="#02040c" opacity="0.78" />
              {validNeighbor && <circle cx={x} cy={y} r="27" className="neighbor-pulse" />}
              <circle
                cx={x}
                cy={y}
                r={selected ? 20 : validNeighbor ? 18 : 15}
                fill={selected ? "#ffe99a" : validNeighbor ? "#86f2b5" : "#d9e4ff"}
                stroke={selected ? "#ffffff" : validNeighbor ? "#d8ffe8" : "#4d5b8b"}
                strokeWidth={selected ? 6 : validNeighbor ? 5 : 4}
                filter={selected || validNeighbor ? "url(#glow)" : undefined}
              />
              <path d={`M ${x} ${y - 7} L ${x + 7} ${y} L ${x} ${y + 7} L ${x - 7} ${y} Z`} fill="#7786b6" opacity="0.62" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
