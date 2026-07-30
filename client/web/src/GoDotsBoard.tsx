import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { FantasyBuildingSprite } from "./FantasyBuildingSprite";
import { FantasyUnitSprite } from "./FantasyUnitSprite";
import { gridPercent, type ClaimedCell, type InfluenceEdge } from "./go-dots-logic";
import { LIVING_BOARD_SIZE, tileId, type LivingTile, type LivingUnit } from "./living-board-data";
import { Pack99EnvironmentalDensity } from "./Pack99EnvironmentalDensity";
import { Pack99LivingWorldLayer } from "./Pack99LivingWorldLayer";
import { Pack99StrategicStructures } from "./Pack99StrategicStructures";
import { Pack99TacticalAtmosphere } from "./Pack99TacticalAtmosphere";
import { ProgressiveBoardLayer } from "./ProgressiveBoardLayer";
import { progressiveBoardPosition, progressiveBoardSvgPosition } from "./progressive-board-projection";
import { ProgressiveTerrainLayer } from "./ProgressiveTerrainLayer";

interface GoDotsBoardProps {
  tiles: LivingTile[];
  units: LivingUnit[];
  selectedUnitId: string | null;
  validNodeIds: Set<string>;
  recommendedNodeId: string | null;
  objectiveTargetId: string;
  influenceEdges: InfluenceEdge[];
  claimedCells: ClaimedCell[];
  collectedTileIds?: string[];
  building: "farm" | "tower" | null;
  disabled?: boolean;
  onNodeClick: (tile: LivingTile) => void;
}

interface CameraState { x: number; y: number; zoom: number; }
const DEFAULT_CAMERA: CameraState = { x: 0, y: 0, zoom: 1 };

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function squareSvgCoordinate(value: number): number { return gridPercent(value, LIVING_BOARD_SIZE) * 10; }

function WorldLandmarks({ building }: { building: "farm" | "tower" | null }) {
  const millAsset = building ?? "mill";
  const millLabel = building === "tower" ? "Torre Rúnica" : building === "farm" ? "Fazenda Arcana" : "Moinho do Norte";
  return <div className="go-world-landmarks legacy-world-fallback" aria-hidden="true">
    <div className="landmark landmark-village"><span className="house house-one"><i /></span><span className="house house-two"><i /></span><small>Vila de Orun</small></div>
    <div className="landmark landmark-forest"><span className="tree tree-one"><i /></span><span className="tree tree-two"><i /></span><span className="tree tree-three"><i /></span><small>Bosque Cinzento</small></div>
    <div className="landmark landmark-ruins"><span className="ruin-column left" /><span className="ruin-column right" /><span className="ruin-arch" /><small>Observatório</small></div>
    <div className={`landmark landmark-mill ${building ? `has-${building}` : ""}`}><FantasyBuildingSprite type={millAsset} state={building ? "built" : "neutral"} compact label={millLabel} /><small>{millLabel}</small></div>
    <div className="landmark landmark-mountains"><span className="mountain mountain-one" /><span className="mountain mountain-two" /><span className="mountain mountain-three" /><small>Escarpas de Ferro</small></div>
  </div>;
}

export function GoDotsBoard({ tiles, units, selectedUnitId, validNodeIds, recommendedNodeId, objectiveTargetId, influenceEdges, claimedCells, collectedTileIds = [], building, disabled = false, onNodeClick }: GoDotsBoardProps) {
  const [terrainReady, setTerrainReady] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef({ pointerX: 0, pointerY: 0, cameraX: 0, cameraY: 0 });
  const dragged = useRef(false);
  const progressiveProjection = terrainReady || boardReady;
  const occupied = useMemo(() => new Map(units.map((unit) => [tileId(unit.x, unit.y), unit])), [units]);
  const collected = useMemo(() => new Set(collectedTileIds), [collectedTileIds]);
  const interactionActive = selectedUnitId !== null || validNodeIds.size > 0;

  const point = (x: number, y: number) => progressiveProjection ? progressiveBoardPosition(x, y) : { left: gridPercent(x, LIVING_BOARD_SIZE), top: gridPercent(y, LIVING_BOARD_SIZE) };
  const svgPoint = (x: number, y: number) => progressiveProjection ? progressiveBoardSvgPosition(x, y) : { x: squareSvgCoordinate(x), y: squareSvgCoordinate(y) };

  const focusGridPoint = (x: number, y: number, zoom = Math.max(camera.zoom, 1.28)) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const position = point(x, y);
    const bounds = viewport.getBoundingClientRect();
    setCamera({ x: (50 - position.left) * bounds.width / 100, y: (50 - position.top) * bounds.height / 100, zoom: clamp(zoom, .82, 1.85) });
  };
  const focusSelected = () => { const unit = units.find((entry) => entry.id === selectedUnitId) ?? units.find((entry) => entry.faction === "player" && !entry.defeated); if (unit) focusGridPoint(unit.x, unit.y); };
  const focusObjective = () => { const tile = tiles.find((entry) => entry.id === objectiveTargetId); if (tile) focusGridPoint(tile.x, tile.y, 1.22); };
  const resetCamera = () => setCamera(DEFAULT_CAMERA);
  const changeZoom = (delta: number) => setCamera((current) => ({ ...current, zoom: clamp(current.zoom + delta, .82, 1.85) }));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const step = event.shiftKey ? 80 : 42;
      if (["w", "W", "ArrowUp"].includes(event.key)) setCamera((value) => ({ ...value, y: value.y + step }));
      else if (["s", "S", "ArrowDown"].includes(event.key)) setCamera((value) => ({ ...value, y: value.y - step }));
      else if (["a", "A", "ArrowLeft"].includes(event.key)) setCamera((value) => ({ ...value, x: value.x + step }));
      else if (["d", "D", "ArrowRight"].includes(event.key)) setCamera((value) => ({ ...value, x: value.x - step }));
      else if (["f", "F"].includes(event.key)) focusSelected();
      else if (event.key === "Home") resetCamera();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, cameraX: camera.x, cameraY: camera.y };
    dragged.current = false;
    setDragging(true);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = event.clientX - dragStart.current.pointerX;
    const dy = event.clientY - dragStart.current.pointerY;
    if (Math.abs(dx) + Math.abs(dy) > 5) dragged.current = true;
    setCamera((value) => ({ ...value, x: dragStart.current.cameraX + dx, y: dragStart.current.cameraY + dy }));
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false); };
  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => { event.preventDefault(); changeZoom(event.deltaY > 0 ? -.1 : .1); };

  const baseLines = useMemo(() => {
    const lines: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];
    for (let y = 0; y < LIVING_BOARD_SIZE; y += 1) for (let x = 0; x < LIVING_BOARD_SIZE; x += 1) {
      if (x < LIVING_BOARD_SIZE - 1) { const start = progressiveProjection ? progressiveBoardSvgPosition(x, y) : { x: squareSvgCoordinate(x), y: squareSvgCoordinate(y) }; const end = progressiveProjection ? progressiveBoardSvgPosition(x + 1, y) : { x: squareSvgCoordinate(x + 1), y: squareSvgCoordinate(y) }; lines.push({ id: `h-${x}-${y}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y }); }
      if (y < LIVING_BOARD_SIZE - 1) { const start = progressiveProjection ? progressiveBoardSvgPosition(x, y) : { x: squareSvgCoordinate(x), y: squareSvgCoordinate(y) }; const end = progressiveProjection ? progressiveBoardSvgPosition(x, y + 1) : { x: squareSvgCoordinate(x), y: squareSvgCoordinate(y + 1) }; lines.push({ id: `v-${x}-${y}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y }); }
    }
    return lines;
  }, [progressiveProjection]);

  return <section className={`go-dots-board-shell pack99-world-active ${interactionActive ? "is-interacting" : "is-resting"} ${progressiveProjection ? "has-progressive-projection" : ""} ${boardReady ? "has-progressive-board" : ""}`}>
    <div ref={viewportRef} className={`pack99-rts-viewport ${dragging ? "is-dragging" : ""}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onWheel={onWheel} onClickCapture={(event) => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); dragged.current = false; } }}>
      <div className="pack99-rts-stage" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})` }}>
        <div className="go-dots-world">
          <div className="world-sky-glow" />
          <Pack99LivingWorldLayer tiles={tiles} collectedTileIds={collected} />
          <Pack99EnvironmentalDensity tiles={tiles} />
          <Pack99StrategicStructures influenceEdges={influenceEdges} claimedCells={claimedCells} building={building} />
          <div className="legacy-world-fallback"><ProgressiveTerrainLayer tiles={tiles} onAvailabilityChange={setTerrainReady} /></div>
          <div className="world-river legacy-world-fallback"><span /><i /><b /></div><div className="world-bridge legacy-world-fallback"><span /><i /><b /></div><WorldLandmarks building={building} />
          {claimedCells.map((cell) => { if (progressiveProjection) { const center = point(cell.x + .5, cell.y + .5); return <div key={cell.id} className={`claimed-territory is-progressive owner-${cell.owner}`} style={{ left: `${center.left}%`, top: `${center.top}%` }}><span className="territory-rune">⬡</span></div>; } const left = gridPercent(cell.x, LIVING_BOARD_SIZE); const top = gridPercent(cell.y, LIVING_BOARD_SIZE); const right = gridPercent(cell.x + 1, LIVING_BOARD_SIZE); const bottom = gridPercent(cell.y + 1, LIVING_BOARD_SIZE); return <div key={cell.id} className={`claimed-territory owner-${cell.owner}`} style={{ left: `${left}%`, top: `${top}%`, width: `${right-left}%`, height: `${bottom-top}%` }}><span className="territory-rune">⬡</span></div>; })}
          <div className="legacy-board-fallback"><ProgressiveBoardLayer tiles={tiles} units={units} selectedUnitId={selectedUnitId} validNodeIds={validNodeIds} recommendedNodeId={recommendedNodeId} influenceEdges={influenceEdges} claimedCells={claimedCells} disabled={disabled} onAvailabilityChange={setBoardReady} /></div>
          <svg className="go-dots-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><g className="base-go-grid">{baseLines.map((line) => <line key={line.id} {...line} />)}</g><g className="influence-paths">{influenceEdges.map((edge) => { const start = svgPoint(edge.start.x, edge.start.y); const end = svgPoint(edge.end.x, edge.end.y); const coordinates = { x1: start.x, y1: start.y, x2: end.x, y2: end.y }; return <g key={edge.id} className={`influence-edge owner-${edge.owner}`}><line className="influence-foundation" {...coordinates} /><line className="influence-wall" {...coordinates} /><line className="influence-runes" {...coordinates} /></g>; })}</g></svg>
          <div className="go-node-layer">{tiles.map((tile) => { const unit = occupied.get(tile.id); const valid = validNodeIds.has(tile.id); const recommended = recommendedNodeId === tile.id; const target = objectiveTargetId === tile.id; const selected = selectedUnitId === unit?.id; const position = point(tile.x, tile.y); return <button key={tile.id} type="button" className={`go-node ${valid ? "valid" : ""} ${recommended ? "recommended" : ""} ${target ? "objective-target" : ""} ${selected ? "selected" : ""} ${unit ? "occupied" : ""} ${unit?.faction === "enemy" ? "enemy-node" : ""}`} style={{ left: `${position.left}%`, top: `${position.top}%` }} onClick={() => onNodeClick(tile)} disabled={disabled} aria-label={`${tile.landmark ?? `Nó ${tile.x + 1}, ${tile.y + 1}`}${unit ? `, ocupado por ${unit.name}` : ""}`}><span className="node-stone"><i /><b /></span>{recommended && <span className="node-callout">PRÓXIMO</span>}{target && !recommended && <span className="node-target-ring" />}{unit && <FantasyUnitSprite unit={unit} selected={selected} compact />}</button>; })}</div>
          <Pack99TacticalAtmosphere units={units} selectedUnitId={selectedUnitId} objectiveTargetId={objectiveTargetId} enemyPhase={disabled} />
        </div>
      </div>
      <nav className="pack99-rts-camera-controls" aria-label="Controles da câmera"><button type="button" onClick={() => changeZoom(-.12)} aria-label="Diminuir zoom">−</button><button type="button" className="camera-label" onClick={resetCamera} title="Visão geral (Home)">{Math.round(camera.zoom * 100)}%</button><button type="button" onClick={() => changeZoom(.12)} aria-label="Aumentar zoom">+</button><button type="button" onClick={focusSelected} title="Focar unidade (F)">Unidade</button><button type="button" onClick={focusObjective}>Objetivo</button></nav>
    </div>
  </section>;
}
