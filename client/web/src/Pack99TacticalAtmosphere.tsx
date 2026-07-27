import { useMemo } from "react";

import { progressiveBoardPosition } from "./progressive-board-projection";
import type { LivingUnit } from "./living-board-data";

interface Pack99TacticalAtmosphereProps {
  units: LivingUnit[];
  selectedUnitId: string | null;
  objectiveTargetId: string;
  enemyPhase: boolean;
  battleActive?: boolean;
}

function parseTileId(tileId: string): { x: number; y: number } | null {
  const match = tileId.match(/(\d+)[^\d]+(\d+)/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

export function Pack99TacticalAtmosphere({
  units,
  selectedUnitId,
  objectiveTargetId,
  enemyPhase,
  battleActive = false,
}: Pack99TacticalAtmosphereProps) {
  const revealPoints = useMemo(() => units
    .filter((unit) => unit.faction === "player" && unit.active && !unit.defeated && unit.hp > 0)
    .map((unit) => ({ id: unit.id, ...progressiveBoardPosition(unit.x, unit.y), selected: unit.id === selectedUnitId })), [units, selectedUnitId]);

  const objective = useMemo(() => {
    const point = parseTileId(objectiveTargetId);
    return point ? progressiveBoardPosition(point.x, point.y) : null;
  }, [objectiveTargetId]);

  return (
    <div className={`pack99-tactical-atmosphere ${enemyPhase ? "is-enemy-phase" : "is-player-phase"} ${battleActive ? "is-battle-active" : ""}`} aria-hidden="true">
      <div className="pack99-global-light"><i /><b /></div>
      <div className="pack99-weather-layer"><i /><i /><i /><i /><i /><i /></div>
      <div className="pack99-fog-field" />
      <div className="pack99-fog-reveals">
        {revealPoints.map((point) => (
          <span
            key={point.id}
            className={point.selected ? "selected" : ""}
            style={{ left: `${point.left}%`, top: `${point.top}%` }}
          />
        ))}
        {objective ? <span className="objective" style={{ left: `${objective.left}%`, top: `${objective.top}%` }} /> : null}
      </div>
      <div className="pack99-faction-light player-light" />
      <div className="pack99-faction-light enemy-light" />
      <div className="pack99-camera-vignette" />
    </div>
  );
}
