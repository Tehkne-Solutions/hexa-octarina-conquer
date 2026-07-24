import { useMemo } from "react";

import { FantasyUnitSprite } from "./FantasyUnitSprite";
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

interface GoDotsBoardProps {
  tiles: LivingTile[];
  units: LivingUnit[];
  selectedUnitId: string | null;
  validNodeIds: Set<string>;
  recommendedNodeId: string | null;
  objectiveTargetId: string;
  influenceEdges: InfluenceEdge[];
  claimedCells: ClaimedCell[];
  building: "farm" | "tower" | null;
  disabled?: boolean;
  onNodeClick: (tile: LivingTile) => void;
}

function svgCoordinate(value: number): number {
  return gridPercent(value, LIVING_BOARD_SIZE) * 10;
}

function WorldLandmarks({ building }: { building: "farm" | "tower" | null }) {
  return (
    <div className="go-world-landmarks" aria-hidden="true">
      <div className="landmark landmark-village">
        <span className="house house-one"><i /></span>
        <span className="house house-two"><i /></span>
        <small>Vila de Orun</small>
      </div>
      <div className="landmark landmark-forest">
        <span className="tree tree-one"><i /></span>
        <span className="tree tree-two"><i /></span>
        <span className="tree tree-three"><i /></span>
        <small>Bosque Cinzento</small>
      </div>
      <div className="landmark landmark-ruins">
        <span className="ruin-column left" />
        <span className="ruin-column right" />
        <span className="ruin-arch" />
        <small>Observatório</small>
      </div>
      <div className={`landmark landmark-mill ${building ? `has-${building}` : ""}`}>
        {building === "tower" ? (
          <span className="tower-building"><i /><b /></span>
        ) : building === "farm" ? (
          <span className="farm-building"><i /><b /><em /></span>
        ) : (
          <span className="windmill"><i /><b /><em /><u /></span>
        )}
        <small>{building === "tower" ? "Torre Rúnica" : building === "farm" ? "Fazenda Arcana" : "Moinho do Norte"}</small>
      </div>
      <div className="landmark landmark-mountains">
        <span className="mountain mountain-one" />
        <span className="mountain mountain-two" />
        <span className="mountain mountain-three" />
        <small>Escarpas de Ferro</small>
      </div>
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
  building,
  disabled = false,
  onNodeClick,
}: GoDotsBoardProps) {
  const occupied = useMemo(() => new Map(units.map((unit) => [tileId(unit.x, unit.y), unit])), [units]);
  const baseLines = useMemo(() => {
    const lines: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];
    for (let y = 0; y < LIVING_BOARD_SIZE; y += 1) {
      for (let x = 0; x < LIVING_BOARD_SIZE; x += 1) {
        if (x < LIVING_BOARD_SIZE - 1) lines.push({ id: `h-${x}-${y}`, x1: svgCoordinate(x), y1: svgCoordinate(y), x2: svgCoordinate(x + 1), y2: svgCoordinate(y) });
        if (y < LIVING_BOARD_SIZE - 1) lines.push({ id: `v-${x}-${y}`, x1: svgCoordinate(x), y1: svgCoordinate(y), x2: svgCoordinate(x), y2: svgCoordinate(y + 1) });
      }
    }
    return lines;
  }, []);

  return (
    <section className="go-dots-board-shell">
      <div className="go-dots-world">
        <div className="world-sky-glow" />
        <div className="world-river"><span /><i /><b /></div>
        <div className="world-bridge"><span /><i /><b /></div>
        <WorldLandmarks building={building} />

        {claimedCells.map((cell) => {
          const left = gridPercent(cell.x, LIVING_BOARD_SIZE);
          const top = gridPercent(cell.y, LIVING_BOARD_SIZE);
          const right = gridPercent(cell.x + 1, LIVING_BOARD_SIZE);
          const bottom = gridPercent(cell.y + 1, LIVING_BOARD_SIZE);
          return (
            <div
              key={cell.id}
              className={`claimed-territory owner-${cell.owner}`}
              style={{ left: `${left}%`, top: `${top}%`, width: `${right - left}%`, height: `${bottom - top}%` }}
            >
              <span className="territory-rune">⬡</span>
            </div>
          );
        })}

        <svg className="go-dots-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <g className="base-go-grid">
            {baseLines.map((line) => <line key={line.id} {...line} />)}
          </g>
          <g className="influence-paths">
            {influenceEdges.map((edge) => {
              const coordinates = {
                x1: svgCoordinate(edge.start.x),
                y1: svgCoordinate(edge.start.y),
                x2: svgCoordinate(edge.end.x),
                y2: svgCoordinate(edge.end.y),
              };
              return (
                <g key={edge.id} className={`influence-edge owner-${edge.owner}`}>
                  <line className="influence-foundation" {...coordinates} />
                  <line className="influence-wall" {...coordinates} />
                  <line className="influence-runes" {...coordinates} />
                </g>
              );
            })}
          </g>
        </svg>

        <div className="go-node-layer">
          {tiles.map((tile) => {
            const unit = occupied.get(tile.id);
            const valid = validNodeIds.has(tile.id);
            const recommended = recommendedNodeId === tile.id;
            const target = objectiveTargetId === tile.id;
            const selected = selectedUnitId === unit?.id;
            return (
              <button
                key={tile.id}
                type="button"
                className={`go-node ${valid ? "valid" : ""} ${recommended ? "recommended" : ""} ${target ? "objective-target" : ""} ${selected ? "selected" : ""} ${unit ? "occupied" : ""} ${unit?.faction === "enemy" ? "enemy-node" : ""}`}
                style={{ left: `${gridPercent(tile.x, LIVING_BOARD_SIZE)}%`, top: `${gridPercent(tile.y, LIVING_BOARD_SIZE)}%` }}
                onClick={() => onNodeClick(tile)}
                disabled={disabled}
                aria-label={`${tile.landmark ?? `Nó ${tile.x + 1}, ${tile.y + 1}`}${unit ? `, ocupado por ${unit.name}` : ""}`}
              >
                <span className="node-stone"><i /><b /></span>
                {recommended && <span className="node-callout">PRÓXIMO</span>}
                {target && !recommended && <span className="node-target-ring" />}
                {unit && <FantasyUnitSprite unit={unit} selected={selected} />}
              </button>
            );
          })}
        </div>
      </div>

      <footer className="go-dots-legend">
        <span><i className="legend-node" /> Nó de invocação</span>
        <span><i className="legend-path" /> Trilha ou muralha</span>
        <span><i className="legend-cell" /> Território fechado</span>
        <span><i className="legend-valid" /> Liberdade válida</span>
      </footer>
    </section>
  );
}
