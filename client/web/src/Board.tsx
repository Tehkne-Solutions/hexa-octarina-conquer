import { useEffect, useMemo, useState } from "react";

import { canonicalEdge, isAdjacent, type Point, type ProvinceState, type RoomSnapshot } from "./protocol";

interface BoardProps {
  snapshot: RoomSnapshot;
  localPlayerId: string | null;
  disabled?: boolean;
  onPlayEdge: (start: Point, end: Point) => void;
  onSelectProvince: (provinceId: string) => void;
  selectedProvinceId?: string | null;
}

type EdgePair = [Point, Point];

const PLAYER_COLORS = ["#ff5d73", "#4fc3ff", "#e6c55d", "#8ee66b"];

function samePoint(left: Point, right: Point): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function edgeContains(edge: EdgePair, point: Point): boolean {
  return samePoint(edge[0], point) || samePoint(edge[1], point);
}

function TerritoryStructure({ province, color, x, y, selected }: {
  province: ProvinceState;
  color: string;
  x: number;
  y: number;
  selected: boolean;
}) {
  const fortress = province.unit.kind === "fortress";
  const level = Math.max(1, province.unit.level || 1);
  const hp = Math.max(0, province.unit.hp || 0);

  return (
    <g className={`territory-structure ${fortress ? "fortress" : "unit"} ${selected ? "selected" : ""}`}>
      <ellipse cx={x} cy={y + 25} rx="31" ry="12" fill="#02040b" opacity="0.72" />
      <path d={`M ${x - 35} ${y + 17} L ${x - 25} ${y - 2} L ${x + 25} ${y - 2} L ${x + 35} ${y + 17} L ${x + 23} ${y + 29} L ${x - 23} ${y + 29} Z`} fill="#10172b" stroke={color} strokeWidth={selected ? 4 : 2.5} />
      <path d={`M ${x - 25} ${y + 7} L ${x + 25} ${y + 7}`} stroke={color} strokeWidth="4" opacity="0.72" />

      {fortress ? (
        <>
          <rect x={x - 22} y={y - 34} width="44" height="43" rx="5" fill="#1a2440" stroke={color} strokeWidth="3" />
          <rect x={x - 31} y={y - 25} width="14" height="35" rx="3" fill="#202c4b" stroke={color} strokeWidth="3" />
          <rect x={x + 17} y={y - 25} width="14" height="35" rx="3" fill="#202c4b" stroke={color} strokeWidth="3" />
          <path d={`M ${x - 31} ${y - 25} l 7 -9 l 7 9 M ${x + 17} ${y - 25} l 7 -9 l 7 9 M ${x - 22} ${y - 34} l 11 -10 l 11 10 l 11 -10 l 11 10`} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
          <circle cx={x} cy={y - 13} r="9" fill={color} className="structure-core" />
          <rect x={x - 5} y={y - 2} width="10" height="14" rx="5" fill="#050713" />
          <path d={`M ${x} ${y - 44} V ${y - 63} l 18 7 l -18 7`} fill={color} stroke="#fff" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <path d={`M ${x} ${y - 40} L ${x - 18} ${y - 12} L ${x - 12} ${y + 11} L ${x + 12} ${y + 11} L ${x + 18} ${y - 12} Z`} fill="#1c2746" stroke={color} strokeWidth="3" />
          <circle cx={x} cy={y - 30} r="10" fill={color} stroke="#f5f8ff" strokeWidth="2" />
          <path d={`M ${x - 17} ${y - 10} L ${x - 31} ${y + 4} L ${x - 16} ${y + 11} M ${x + 17} ${y - 10} L ${x + 31} ${y + 4}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
          <path d={`M ${x + 29} ${y + 4} L ${x + 29} ${y - 25} M ${x + 22} ${y - 18} L ${x + 36} ${y - 18}`} stroke="#eaf3ff" strokeWidth="3" strokeLinecap="round" />
          <path d={`M ${x - 13} ${y + 10} L ${x - 19} ${y + 25} M ${x + 13} ${y + 10} L ${x + 19} ${y + 25}`} stroke={color} strokeWidth="6" strokeLinecap="round" />
        </>
      )}

      <g className="structure-hud">
        <rect x={x - 28} y={y + 33} width="56" height="18" rx="9" fill="#050712" stroke={color} strokeWidth="1.5" />
        <text x={x} y={y + 46} textAnchor="middle">NV {level} · ♥ {hp}</text>
      </g>
    </g>
  );
}

export function Board({ snapshot, localPlayerId, disabled = false, onPlayEdge, onSelectProvince, selectedProvinceId }: BoardProps) {
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [pendingEdge, setPendingEdge] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const board = snapshot.board;
  const size = board.boardSize;
  const spacing = 100;
  const padding = 46;
  const dimension = (size - 1) * spacing + padding * 2;

  const playerColors = useMemo(() => new Map(snapshot.players.map((player, index) => [player.id, PLAYER_COLORS[index % PLAYER_COLORS.length]])), [snapshot.players]);
  const occupiedEdges = useMemo(() => new Set(board.edges.map((edge) => canonicalEdge(edge.start, edge.end))), [board.edges]);
  const candidateEdges = useMemo(() => {
    const edges: EdgePair[] = [];
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      if (x < size - 1) edges.push([[x, y], [x + 1, y]]);
      if (y < size - 1) edges.push([[x, y], [x, y + 1]]);
    }
    return edges;
  }, [size]);
  const availableEdges = useMemo(() => candidateEdges.filter(([start, end]) => !occupiedEdges.has(canonicalEdge(start, end))), [candidateEdges, occupiedEdges]);
  const validEdgesFromSelection = useMemo(() => selectedPoint ? availableEdges.filter((edge) => edgeContains(edge, selectedPoint)) : [], [availableEdges, selectedPoint]);

  const tutorialActive = snapshot.mode === "campaign" && snapshot.campaign?.mission.order === 1 && board.edges.length === 0;
  const center = Math.max(0, Math.floor((size - 1) / 2));
  const suggestedEdge: EdgePair = center > 0 ? [[center - 1, center], [center, center]] : [[0, 0], [1, 0]];
  const suggestedEdgeKey = tutorialActive ? canonicalEdge(suggestedEdge[0], suggestedEdge[1]) : null;
  const points = Array.from({ length: size * size }, (_, index): Point => [index % size, Math.floor(index / size)]);
  const canAct = !disabled && board.currentPlayerId === localPlayerId;

  useEffect(() => {
    setSelectedPoint(null);
    if (pendingEdge) {
      if (occupiedEdges.has(pendingEdge)) setFeedback("Muralha erguida. Aguarde a jogada da IA.");
      setPendingEdge(null);
    }
  }, [snapshot.revision]);

  useEffect(() => {
    if (!pendingEdge) return;
    const timer = window.setTimeout(() => {
      setPendingEdge(null);
      setFeedback("A construção não foi confirmada. Tente novamente.");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [pendingEdge]);

  useEffect(() => { if (disabled) setSelectedPoint(null); }, [disabled]);

  const requestEdge = (start: Point, end: Point) => {
    if (!canAct) {
      setFeedback(board.currentPlayerId === localPlayerId ? "Aguarde a partida ficar pronta." : "Aguarde a jogada da IA.");
      return;
    }
    const key = canonicalEdge(start, end);
    if (occupiedEdges.has(key)) {
      setFeedback("Já existe uma muralha nesse trecho.");
      return;
    }
    setPendingEdge(key);
    setSelectedPoint(null);
    setFeedback("Construindo muralha rúnica...");
    onPlayEdge(start, end);
  };

  const tapPoint = (point: Point) => {
    if (!canAct) {
      setFeedback(board.currentPlayerId === localPlayerId ? "A partida ainda não está pronta." : "Agora é a vez da IA.");
      return;
    }
    if (!selectedPoint) {
      setSelectedPoint(point);
      setFeedback("Pilar selecionado. Toque em um pilar verde vizinho.");
      return;
    }
    if (samePoint(selectedPoint, point)) {
      setSelectedPoint(null);
      setFeedback("Seleção cancelada.");
      return;
    }
    if (!isAdjacent(selectedPoint, point)) {
      setFeedback("Esse pilar não é vizinho. Escolha um pilar verde.");
      return;
    }
    if (occupiedEdges.has(canonicalEdge(selectedPoint, point))) {
      setFeedback("Esse trecho já possui muralha.");
      return;
    }
    requestEdge(selectedPoint, point);
  };

  const position = ([x, y]: Point) => ({ x: padding + x * spacing, y: padding + y * spacing });
  const guideMessage = feedback ?? (tutorialActive ? "TOQUE NA MURALHA DOURADA para erguer sua primeira defesa." : selectedPoint ? "Agora toque em um pilar verde vizinho." : board.cells.length === 0 ? "Toque diretamente em qualquer segmento pontilhado para construir uma muralha." : "Feche quatro muralhas para fundar um território com unidade própria.");

  return (
    <div className={`board-shell ${tutorialActive ? "tutorial-board" : ""}`} aria-label="Tabuleiro tático">
      <div className={`board-guide ${pendingEdge ? "pending" : ""}`} role="status" aria-live="polite">
        <strong>{tutorialActive ? "PRIMEIRA CONSTRUÇÃO" : pendingEdge ? "CONSTRUINDO" : selectedPoint ? "PILAR SELECIONADO" : "COMO JOGAR"}</strong>
        <span>{guideMessage}</span>
      </div>
      <svg className="board" viewBox={`0 0 ${dimension} ${dimension}`} role="application" aria-label={`Tabuleiro ${size} por ${size}`}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="wallShadow" x="-30%" y="-80%" width="160%" height="260%"><feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#000" floodOpacity="0.8" /></filter>
          <linearGradient id="boardFloor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#161b35" /><stop offset="1" stopColor="#090c1b" /></linearGradient>
        </defs>

        <rect x="8" y="8" width={dimension - 16} height={dimension - 16} rx="38" fill="url(#boardFloor)" stroke="#31395f" strokeWidth="3" />

        {availableEdges.map(([startPoint, endPoint]) => {
          const start = position(startPoint); const end = position(endPoint); const key = canonicalEdge(startPoint, endPoint);
          const fromSelection = selectedPoint ? edgeContains([startPoint, endPoint], selectedPoint) : false;
          const suggested = key === suggestedEdgeKey; const pending = key === pendingEdge;
          return <g key={`option-${key}`} className={`edge-option ${fromSelection ? "valid" : ""} ${suggested ? "suggested" : ""} ${pending ? "pending" : ""}`}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="edge-option-visible" strokeWidth={suggested || fromSelection ? 9 : 4} strokeLinecap="round" strokeDasharray={suggested || fromSelection ? "14 9" : "7 13"} pointerEvents="none" />
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="edge-option-hit" stroke="transparent" strokeWidth="34" strokeLinecap="round" pointerEvents="stroke" role="button" tabIndex={0} onClick={() => requestEdge(startPoint, endPoint)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") requestEdge(startPoint, endPoint); }} />
          </g>;
        })}

        {board.cells.map((cell) => {
          const color = playerColors.get(cell.ownerId) ?? "#6f789e";
          const province = board.provinces.find((item) => item.id === cell.provinceId);
          const selected = selectedProvinceId === cell.provinceId;
          const cx = padding + cell.x * spacing + spacing / 2;
          const cy = padding + cell.y * spacing + spacing / 2;
          return <g key={cell.id} onClick={() => onSelectProvince(cell.provinceId)} className="province-cell" role="button">
            <rect x={padding + cell.x * spacing + 5} y={padding + cell.y * spacing + 5} width={spacing - 10} height={spacing - 10} rx="22" fill={color} fillOpacity={selected ? 0.34 : 0.16} stroke={selected ? "#fff" : color} strokeWidth={selected ? 4 : 2} className="territory-platform" />
            <path d={`M ${cx - 36} ${cy + 30} L ${cx} ${cy + 43} L ${cx + 36} ${cy + 30}`} fill="none" stroke={color} strokeWidth="3" opacity="0.5" />
            {province && <TerritoryStructure province={province} color={color} x={cx} y={cy - 4} selected={selected} />}
          </g>;
        })}

        {board.edges.map((edge) => {
          const start = position(edge.start); const end = position(edge.end); const color = playerColors.get(edge.ownerId) ?? "#9ba6ce";
          const key = canonicalEdge(edge.start, edge.end);
          const horizontal = edge.start[1] === edge.end[1];
          const mx = (start.x + end.x) / 2; const my = (start.y + end.y) / 2;
          return <g key={key} className="rune-wall" filter="url(#wallShadow)">
            <line x1={start.x} y1={start.y + 8} x2={end.x} y2={end.y + 8} stroke="#02040b" strokeWidth="24" strokeLinecap="round" opacity="0.9" />
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#17213a" strokeWidth="20" strokeLinecap="round" />
            <line x1={start.x} y1={start.y - 2} x2={end.x} y2={end.y - 2} stroke={color} strokeWidth="13" strokeLinecap="round" className="wall-color" />
            <line x1={start.x} y1={start.y - 3} x2={end.x} y2={end.y - 3} stroke="#f5fbff" strokeWidth="3" strokeLinecap="round" opacity="0.78" />
            {[0.25, 0.5, 0.75].map((ratio) => {
              const x = start.x + (end.x - start.x) * ratio; const y = start.y + (end.y - start.y) * ratio;
              return <g key={ratio}><rect x={x - (horizontal ? 5 : 9)} y={y - (horizontal ? 9 : 5)} width={horizontal ? 10 : 18} height={horizontal ? 18 : 10} rx="3" fill="#10172a" stroke={color} strokeWidth="2" /><circle cx={x} cy={y} r="3" fill="#fff" className="wall-rune" /></g>;
            })}
            <circle cx={mx} cy={my} r="7" fill={color} opacity="0.7" className="wall-core" />
          </g>;
        })}

        {points.map((point) => {
          const { x, y } = position(point); const selected = selectedPoint?.[0] === point[0] && selectedPoint?.[1] === point[1];
          const validNeighbor = validEdgesFromSelection.some((edge) => edgeContains(edge, point) && !samePoint(point, selectedPoint!));
          return <g key={`${point[0]}-${point[1]}`} onClick={() => tapPoint(point)} className={`board-point ${validNeighbor ? "valid-neighbor" : ""}`} role="button">
            <circle cx={x} cy={y + 7} r="21" fill="#02040c" opacity="0.8" />
            {validNeighbor && <circle cx={x} cy={y} r="27" className="neighbor-pulse" />}
            <circle cx={x} cy={y} r={selected ? 21 : validNeighbor ? 19 : 16} fill={selected ? "#ffe99a" : validNeighbor ? "#86f2b5" : "#d9e4ff"} stroke={selected ? "#fff" : validNeighbor ? "#d8ffe8" : "#4d5b8b"} strokeWidth={selected ? 6 : validNeighbor ? 5 : 4} filter={selected || validNeighbor ? "url(#glow)" : undefined} />
            <path d={`M ${x - 7} ${y + 2} L ${x} ${y - 8} L ${x + 7} ${y + 2} L ${x} ${y + 9} Z`} fill="#5f6e9e" opacity="0.75" />
          </g>;
        })}
      </svg>
    </div>
  );
}
