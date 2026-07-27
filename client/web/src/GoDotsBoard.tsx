import { useMemo, useState } from "react";

import { FantasyBuildingSprite } from "./FantasyBuildingSprite";
import {
  gridPercent,
  type ClaimedCell,
  type InfluenceEdge,
} from "./go-dots-logic";
import {
  LIVING_BOARD_SIZE,
  tileId,
  type LivingTile,
  type LivingUnit,
} from "./living-board-data";
import { Pack99LivingWorldLayer } from "./Pack99LivingWorldLayer";
import { Pack99UnitSprite } from "./Pack99UnitSprite";
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
  collectedTileIds: string[];
  building: "farm" | "tower" | null;
  disabled?: boolean;
  onNodeClick: (tile: LivingTile) => void;
}

function squareSvgCoordinate(value: number): number {
  return gridPercent(value, LIVING_BOARD_SIZE) * 10;
}

function WorldLandmarks({ building }: { building: "farm" | "tower" | null }) {
  const millAsset = building ?? "mill";
  const millLabel = building === "tower" ? "Torre Rúnica" : building === "farm" ? "Fazenda Arcana" : "Moinho do Norte";
  return (
    <div className="go-world-landmarks legacy-world-fallback" aria-hidden="true">
      <div className="landmark landmark-village"><span className="house house-one"><i /></span><span className="house house-two"><i /></span><small>Vila de Orun</small></div>
      <div className="landmark landmark-forest"><span className="tree tree-one"><i /></span><span className="tree tree-two"><i /></span><span className="tree tree-three"><i /></span><small>Bosque Cinzento</small></div>
      <div className="landmark landmark-ruins"><span className="ruin-column left" /><span className="ruin-column right" /><span className="ruin-arch" /><small>Observatório</small></div>
      <div className={`landmark landmark-mill ${building ? `has-${building}` : ""}`}><FantasyBuildingSprite type={millAsset} state={building ? "built" : "neutral"} compact label={millLabel} /><small>{millLabel}</small></div>
      <div className="landmark landmark-mountains"><span className="mountain mountain-one" /><span className="mountain mountain-two" /><span className="mountain mountain-three" /><small>Escarpas de Ferro</small></div>
    </div>
  );
}

export function GoDotsBoard({
  tiles,
  units,
  selectedUnitId,
  validNodeIds,
  recommendedNodeId,
  objectiveTargetId,
  influenceEdges,
  claimedCells,
  collectedTileIds,
  building,
  disabled = false,
  onNodeClick,
}: GoDotsBoardProps) {
  const [terrainReady, setTerrainReady] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const progressiveProjection = terrainReady || boardReady;
  const occupied = useMemo(() => new Map(units.map((unit) => [tileId(unit.x, unit.y), unit])), [units]);
  const collected = useMemo(() => new Set(collectedTileIds), [collectedTileIds]);
  const interactionActive = selectedUnitId !== null || validNodeIds.size > 0;

  const point = (x: number, y: number) => progressiveProjection
    ? progressiveBoardPosition(x, y)
    : { left: gridPercent(x, LIVING_BOARD_SIZE), top: gridPercent(y, LIVING_BOARD_SIZE) };
  const svgPoint = (x: number, y: number) => progressiveProjection
    ? progressiveBoardSvgPosition(x, y)
    : { x: squareSvgCoordinate(x), y: squareSvgCoordinate(y) };

  const baseLines = useMemo(() => {
    const lines: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];
    for (let y = 0; y < LIVING_BOARD_SIZE; y += 1) {
      for (let x = 0; x < LIVING_BOARD_SIZE; x += 1) {
        if (x < LIVING_BOARD_SIZE - 1) {
          const start = progressiveProjection ? progressiveBoardSvgPosition(x, y) : { x: squareSvgCoordinate(x), y: squareSvgCoordinate(y) };
          const end = progressiveProjection ? progressiveBoardSvgPosition(x + 1, y) : { x: squareSvgCoordinate(x + 1), y: squareSvgCoordinate(y) };
          lines.push({ id: `h-${x}-${y}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y });
        }
        if (y < LIVING_BOARD_SIZE - 1) {
          const start = progressiveProjection ? progressiveBoardSvgPosition(x, y) : { x: squareSvgCoordinate(x), y: squareSvgCoordinate(y) };
          const end = progressiveProjection ? progressiveBoardSvgPosition(x, y + 1) : { x: squareSvgCoordinate(x), y: squareSvgCoordinate(y + 1) };
          lines.push({ id: `v-${x}-${y}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y });
        }
      }
    }
    return lines;
  }, [progressiveProjection]);

  return (
    <section className={`go-dots-board-shell pack99-world-active ${interactionActive ? "is-interacting" : "is-resting"} ${progressiveProjection ? "has-progressive-projection" : ""} ${boardReady ? "has-progressive-board" : ""}`}>
      <div className="go-dots-world">
        <div className="world-sky-glow" />
        <Pack99LivingWorldLayer tiles={tiles} collectedTileIds={collected} />
        <div className="legacy-world-fallback"><ProgressiveTerrainLayer tiles={tiles} onAvailabilityChange={setTerrainReady} /></div>
        <div className="world-river legacy-world-fallback"><span /><i /><b /></div>
        <div className="world-bridge legacy-world-fallback"><span /><i /><b /></div>
        <WorldLandmarks building={building} />

        {claimedCells.map((cell) => {
          if (progressiveProjection) {
            const center = point(cell.x + 0.5, cell.y + 0.5);
            return <div key={cell.id} className={`claimed-territory is-progressive owner-${cell.owner}`} style={{ left: `${center.left}%`, top: `${center.top}%` }}><span className="territory-rune">⬡</span></div>;
          }
          const left = gridPercent(cell.x, LIVING_BOARD_SIZE);
          const top = gridPercent(cell.y, LIVING_BOARD_SIZE);
          const right = gridPercent(cell.x + 1, LIVING_BOARD_SIZE);
          const bottom = gridPercent(cell.y + 1, LIVING_BOARD_SIZE);
          return <div key={cell.id} className={`claimed-territory owner-${cell.owner}`} style={{ left: `${left}%`, top: `${top}%`, width: `${right - left}%`, height: `${bottom - top}%` }}><span className="territory-rune">⬡</span></div>;
        })}

        <div className="legacy-board-fallback"><ProgressiveBoardLayer tiles={tiles} units={units} selectedUnitId={selectedUnitId} validNodeIds={validNodeIds} recommendedNodeId={recommendedNodeId} influenceEdges={influenceEdges} claimedCells={claimedCells} disabled={disabled} onAvailabilityChange={setBoardReady} /></div>

        <svg className="go-dots-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <g className="base-go-grid">{baseLines.map((line) => <line key={line.id} {...line} />)}</g>
          <g className="influence-paths">{influenceEdges.map((edge) => {
            const start = svgPoint(edge.start.x, edge.start.y);
            const end = svgPoint(edge.end.x, edge.end.y);
            const coordinates = { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
            return <g key={edge.id} className={`influence-edge owner-${edge.owner}`}><line className="influence-foundation" {...coordinates} /><line className="influence-wall" {...coordinates} /><line className="influence-runes" {...coordinates} /></g>;
          })}</g>
        </svg>

        <div className="go-node-layer">
          {tiles.map((tile) => {
            const unit = occupied.get(tile.id);
            const valid = validNodeIds.has(tile.id);
            const recommended = recommendedNodeId === tile.id;
            const target = objectiveTargetId === tile.id;
            const selected = selectedUnitId === unit?.id;
            const position = point(tile.x, tile.y);
            return (
              <button key={tile.id} type="button" className={`go-node ${valid ? "valid" : ""} ${recommended ? "recommended" : ""} ${target ? "objective-target" : ""} ${selected ? "selected" : ""} ${unit ? "occupied" : ""} ${unit?.faction === "enemy" ? "enemy-node" : ""}`} style={{ left: `${position.left}%`, top: `${position.top}%` }} onClick={() => onNodeClick(tile)} disabled={disabled} aria-label={`${tile.landmark ?? `Nó ${tile.x + 1}, ${tile.y + 1}`}${unit ? `, ocupado por ${unit.name}` : ""}`}>
                <span className="node-stone"><i /><b /></span>
                {recommended && <span className="node-callout">PRÓXIMO</span>}
                {target && !recommended && <span className="node-target-ring" />}
                {unit && <Pack99UnitSprite unit={unit} selected={selected} />}
              </button>
            );
          })}
        </div>
      </div>
      <footer className="go-dots-legend"><span><i className="legend-node" /> Nó de invocação</span><span><i className="legend-path" /> Trilha ou muralha</span><span><i className="legend-cell" /> Território fechado</span><span><i className="legend-valid" /> Liberdade válida</span></footer>
    </section>
  );
}
