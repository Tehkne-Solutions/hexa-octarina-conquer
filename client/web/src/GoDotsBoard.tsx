import { useMemo } from "react";

import { FantasyUnitSprite } from "./FantasyUnitSprite";
import { type ClaimedCell, type InfluenceEdge } from "./go-dots-logic";
import { tileId, type LivingTile, type LivingUnit } from "./living-board-data";
import { progressiveBoardPosition, progressiveBoardSvgPosition } from "./progressive-board-projection";

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

function terrainLabel(tile: LivingTile): string | null {
  if (tile.terrain === "bridge") return "Ponte";
  if (tile.terrain === "ruins") return "Observatório";
  if (tile.terrain === "mill") return "Moinho";
  return null;
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

  return (
    <section className="go-dots-board-shell vertical-slice-arena" aria-label="Campo de batalha">
      <div className="vertical-slice-arena-surface">
        <div className="vertical-slice-arena-ground" />
        <div className="vertical-slice-river" aria-hidden="true" />
        <div className="vertical-slice-bridge" aria-hidden="true"><i /><i /><i /></div>
        <div className="vertical-slice-ruins" aria-hidden="true"><i /><b /></div>
        <div className={`vertical-slice-mill ${building ? `is-${building}` : ""}`} aria-hidden="true"><i /><b /></div>

        {claimedCells.map((cell) => {
          const center = progressiveBoardPosition(cell.x + 0.5, cell.y + 0.5);
          return (
            <span
              key={cell.id}
              className={`vertical-slice-territory owner-${cell.owner}`}
              style={{ left: `${center.left}%`, top: `${center.top}%` }}
              aria-hidden="true"
            />
          );
        })}

        <svg className="vertical-slice-routes" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <g>
            {influenceEdges.map((edge) => {
              const start = progressiveBoardSvgPosition(edge.start.x, edge.start.y);
              const end = progressiveBoardSvgPosition(edge.end.x, edge.end.y);
              return (
                <line
                  key={edge.id}
                  className={`owner-${edge.owner}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                />
              );
            })}
          </g>
        </svg>

        <div className="vertical-slice-node-layer">
          {tiles.map((tile) => {
            const unit = occupied.get(tile.id);
            const valid = validNodeIds.has(tile.id);
            const recommended = recommendedNodeId === tile.id;
            const target = objectiveTargetId === tile.id;
            const selected = selectedUnitId === unit?.id;
            const attackable = Boolean(valid && unit?.faction === "enemy");
            const movable = Boolean(valid && !unit);
            const visible = Boolean(unit || valid || recommended || target || terrainLabel(tile));
            if (!visible) return null;

            const position = progressiveBoardPosition(tile.x, tile.y);
            const label = terrainLabel(tile);
            const actionLabel = attackable ? "ATACAR" : movable ? "MOVER" : null;

            return (
              <button
                key={tile.id}
                type="button"
                className={`vertical-slice-node ${valid ? "is-valid" : ""} ${recommended ? "is-recommended" : ""} ${target ? "is-target" : ""} ${selected ? "is-selected" : ""} ${unit ? "is-occupied" : ""} ${unit?.faction === "enemy" ? "is-enemy" : ""} ${attackable ? "is-attackable" : ""}`}
                style={{ left: `${position.left}%`, top: `${position.top}%` }}
                onClick={() => onNodeClick(tile)}
                disabled={disabled || (!unit && !valid)}
                aria-label={`${actionLabel ? `${actionLabel}: ` : ""}${label ?? `Posição ${tile.x + 1}, ${tile.y + 1}`}${unit ? `, ${unit.name}` : ""}`}
              >
                <span className="vertical-slice-node-marker" aria-hidden="true" />
                {label ? <small>{label}</small> : null}
                {actionLabel ? <strong className={attackable ? "attack-action" : "move-action"}>{actionLabel}</strong> : null}
                {unit ? (
                  <span className="vertical-slice-unit">
                    <FantasyUnitSprite unit={unit} selected={selected} compact />
                    <b>{unit.name}</b>
                    <em>{unit.hp}/{unit.maxHp}</em>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
