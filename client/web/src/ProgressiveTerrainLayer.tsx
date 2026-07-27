import { useEffect, useMemo, useRef, useState } from "react";

import { isBoardThemeId, type BoardThemeId } from "./board-theme";
import type { LivingTile } from "./living-board-data";
import { progressiveBoardPosition } from "./progressive-board-projection";
import {
  loadProgressiveTerrainRegistry,
  progressiveTerrainAssetUrl,
  progressiveTerrainCenterAssetId,
} from "./progressive-terrain";

interface ProgressiveTerrainLayerProps {
  tiles: LivingTile[];
  onAvailabilityChange?: (available: boolean) => void;
}

function readTheme(element: HTMLElement | null): BoardThemeId {
  const value = element?.closest<HTMLElement>(".go-dots-board-shell")?.dataset.boardTheme;
  return isBoardThemeId(value) ? value : "orun-mill";
}

export function ProgressiveTerrainLayer({ tiles, onAvailabilityChange }: ProgressiveTerrainLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(false);
  const [theme, setTheme] = useState<BoardThemeId>("orun-mill");

  useEffect(() => {
    let active = true;
    void loadProgressiveTerrainRegistry().then((registry) => {
      if (!active) return;
      const ready = Boolean(registry);
      setAvailable(ready);
      onAvailabilityChange?.(ready);
    });
    return () => { active = false; };
  }, [onAvailabilityChange]);

  useEffect(() => {
    const shell = layerRef.current?.closest<HTMLElement>(".go-dots-board-shell") ?? null;
    if (!shell) return;
    const synchronize = () => setTheme(readTheme(layerRef.current));
    const observer = new MutationObserver(synchronize);
    observer.observe(shell, { attributes: true, attributeFilter: ["data-board-theme"] });
    synchronize();
    return () => observer.disconnect();
  }, []);

  const renderedTiles = useMemo(() => tiles.map((tile) => {
    const assetId = progressiveTerrainCenterAssetId(theme, tile.terrain, tile.x, tile.y);
    const position = progressiveBoardPosition(tile.x, tile.y);
    return {
      ...tile,
      assetId,
      source: progressiveTerrainAssetUrl(assetId),
      left: position.left,
      top: position.top,
      depth: tile.x + tile.y,
    };
  }), [theme, tiles, available]);

  return (
    <div
      ref={layerRef}
      className={`progressive-terrain-layer ${available ? "is-ready" : "is-unavailable"}`}
      data-pack-id="HOC_PACK_01_TERRAIN_CORE_FINAL"
      data-terrain-theme={theme}
      aria-hidden="true"
    >
      {available && renderedTiles.map((tile) => tile.source ? (
        <img
          key={tile.id}
          src={tile.source}
          alt=""
          className="progressive-terrain-tile"
          data-asset-id={tile.assetId}
          data-terrain={tile.terrain}
          style={{ left: `${tile.left}%`, top: `${tile.top}%`, zIndex: tile.depth }}
          draggable={false}
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      ) : null)}
    </div>
  );
}
