import { useEffect, useMemo, useState } from "react";

import { canonicalEdge, isAdjacent, type Point, type RoomSnapshot } from "./protocol";

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
      if (occupiedEdges.has(pendingEdge)) setFeedback("Linha criada. A IA fará a jogada dela quando o turno mudar.");
      setPendingEdge(null);
    }
  }, [snapshot.revision]);

  useEffect(() => {
    if (!pendingEdge) return;
    const timer = window.setTimeout(() => {
      setPendingEdge(null);
      setFeedback("A jogada não foi confirmada. Tente novamente ou aguarde a conexão estabilizar.");
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
      setFeedback("Essa linha já foi criada. Escolha outro segmento pontilhado.");
      return;
    }
    setPendingEdge(key);
    setSelectedPoint(null);
    setFeedback("Jogada enviada. Aguarde a confirmação do servidor...");
    onPlayEdge(start, end);
  };

  const tapPoint = (point: Point) => {
    if (!canAct) {
      setFeedback(board.currentPlayerId === localPlayerId ? "A partida ainda não está pronta." : "Agora é a vez da IA.");
      return;
    }
    if (!selectedPoint) {
      setSelectedPoint(point);
      setFeedback("Primeiro pilar selecionado. Agora toque em um pilar verde ao lado.");
      return;
    }
    if (samePoint(selectedPoint, point)) {
      setSelectedPoint(null);
      setFeedback("Seleção cancelada. Você também pode tocar diretamente em uma linha pontilhada.");
      return;
    }
    if (!isAdjacent(selectedPoint, point)) {
      setFeedback("Esse pilar não é vizinho. Escolha um dos pilares verdes ligados à seleção.");
      return;
    }
    if (occupiedEdges.has(canonicalEdge(selectedPoint, point))) {
      setFeedback("Essa linha já existe. Escolha outro pilar verde.");
      return;
    }
    requestEdge(selectedPoint, point);
  };

  const position = ([x, y]: Point) => ({ x: padding + x * spacing, y: padding + y * spacing });

  const guideMessage = feedback
    ?? (tutorialActive
      ? "TOQUE NA LINHA DOURADA entre dois pilares. Uma única jogada conclui o objetivo principal."
      : selectedPoint
        ? "Agora toque em um dos pilares verdes vizinhos."
        : board.cells.length === 0
          ? "Toque diretamente em qualquer linha pontilhada. Outra opção é tocar em dois pilares vizinhos."
          : "Continue criando linhas para fechar quadrados e conquistar territórios.");

  return (
    <div className={`board-shell ${tutorialActive ? "tutorial-board" : ""}`} aria-label="Tabuleiro tático">
      <div className={`board-guide ${pendingEdge ? "pending" : ""}`} role="status" aria-live="polite">
        <strong>{tutorialActive ? "PRIMEIRA JOGADA" : pendingEdge ? "ENVIANDO" : selectedPoint ? "PILAR SELECIONADO" : "COMO JOGAR"}</strong>
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
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="boardFloor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#161b35" />
            <stop offset="1" stopColor="#090c1b" />
          </linearGradient>
        </defs>

        <rect x="8" y="8" width={dimension - 16} height={dimension - 16} rx="38" fill="url(#boardFloor)" stroke="#31395f" strokeWidth="3" />

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
                aria-label={`Criar linha de ${startPoint.join(",")} até ${endPoint.join(",")}`}
                onClick={() => requestEdge(startPoint, endPoint)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") requestEdge(startPoint, endPoint);
                }}
              />
            </g>
          );
        })}

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
          const validNeighbor = validEdgesFromSelection.some((edge) => edgeContains(edge, point) && !samePoint(point, selectedPoint!));
          return (
            <g key={`${point[0]}-${point[1]}`} onClick={() => tapPoint(point)} className={`board-point ${validNeighbor ? "valid-neighbor" : ""}`} role="button">
              <circle cx={x} cy={y + 5} r="18" fill="#02040c" opacity="0.65" />
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
            </g>
          );
        })}
      </svg>
    </div>
  );
}
