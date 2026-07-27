import { useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";

import type { ClaimedCell, InfluenceEdge } from "./go-dots-logic";
import { tileId, type LivingTile, type LivingUnit } from "./living-board-data";
import {
  loadProgressiveBoardRegistry,
  progressiveBoardAsset,
  progressiveBoardAssetUrl,
  progressiveEdgeAssetId,
  progressivePillarAssetId,
  progressiveTerritoryAssetId,
} from "./progressive-board";
import { progressiveBoardMidpoint, progressiveBoardPosition } from "./progressive-board-projection";

interface ProgressiveBoardLayerProps {
  tiles: LivingTile[];
  units: LivingUnit[];
  selectedUnitId: string | null;
  validNodeIds: Set<string>;
  recommendedNodeId: string | null;
  influenceEdges: InfluenceEdge[];
  claimedCells: ClaimedCell[];
  disabled: boolean;
  onAvailabilityChange?: (available: boolean) => void;
}

interface BoardAssetSpriteProps {
  assetId: string;
  className: string;
  style: CSSProperties;
}

function BoardAssetSprite({ assetId, className, style }: BoardAssetSpriteProps) {
  const asset = progressiveBoardAsset(assetId);
  const file = progressiveBoardAssetUrl(assetId, "file");
  const shadow = progressiveBoardAssetUrl(assetId, "shadow");
  const emissive = progressiveBoardAssetUrl(assetId, "emissive");
  if (!asset || !file) return null;
  const shared = {
    ...style,
    "--board-anchor-x": String(asset.anchor[0]),
    "--board-anchor-y": String(asset.anchor[1]),
  } as CSSProperties;
  const hideBroken = (event: SyntheticEvent<HTMLImageElement>) => { event.currentTarget.hidden = true; };
  return (
    <span className={`progressive-board-asset ${className}`} style={shared} data-asset-id={assetId}>
      {shadow && <img src={shadow} alt="" className="progressive-board-channel is-shadow" draggable={false} onError={hideBroken} />}
      <img src={file} alt="" className="progressive-board-channel is-base" draggable={false} onError={hideBroken} />
      {emissive && <img src={emissive} alt="" className="progressive-board-channel is-emissive" draggable={false} onError={hideBroken} />}
    </span>
  );
}

export function ProgressiveBoardLayer({
  tiles,
  units,
  selectedUnitId,
  validNodeIds,
  recommendedNodeId,
  influenceEdges,
  claimedCells,
  disabled,
  onAvailabilityChange,
}: ProgressiveBoardLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void loadProgressiveBoardRegistry().then((registry) => {
      if (!active) return;
      const ready = Boolean(registry);
      setAvailable(ready);
      onAvailabilityChange?.(ready);
    });
    return () => { active = false; };
  }, [onAvailabilityChange]);

  const occupied = useMemo(() => new Map(units.map((unit) => [tileId(unit.x, unit.y), unit])), [units]);
  const claimedByOwner = useMemo(() => claimedCells.reduce<Record<"player" | "enemy", number>>((counts, cell) => {
    counts[cell.owner] += 1;
    return counts;
  }, { player: 0, enemy: 0 }), [claimedCells]);

  if (!available) {
    return <div ref={layerRef} className="progressive-board-layer is-unavailable" data-pack-id="HOC_PACK_02_BOARD_SYSTEM_FINAL" aria-hidden="true" />;
  }

  return (
    <div ref={layerRef} className="progressive-board-layer is-ready" data-pack-id="HOC_PACK_02_BOARD_SYSTEM_FINAL" aria-hidden="true">
      {influenceEdges.map((edge) => {
        const assetId = progressiveEdgeAssetId(edge.owner, edge.start, edge.end);
        const position = progressiveBoardMidpoint(edge.start, edge.end);
        return (
          <BoardAssetSprite
            key={edge.id}
            assetId={assetId}
            className={`is-edge owner-${edge.owner}`}
            style={{ left: `${position.left}%`, top: `${position.top}%`, zIndex: 200 + Math.round(position.top) }}
          />
        );
      })}

      {claimedCells.map((cell) => {
        const stage = Math.max(1, Math.min(5, claimedByOwner[cell.owner]));
        const assetId = progressiveTerritoryAssetId(stage, cell.owner);
        const position = progressiveBoardPosition(cell.x + 0.5, cell.y + 0.5);
        return (
          <BoardAssetSprite
            key={cell.id}
            assetId={assetId}
            className={`is-territory owner-${cell.owner} stage-${stage}`}
            style={{ left: `${position.left}%`, top: `${position.top}%`, zIndex: 500 + Math.round(position.top) }}
          />
        );
      })}

      {tiles.map((tile) => {
        const unit = occupied.get(tile.id);
        const selected = selectedUnitId === unit?.id;
        const assetId = progressivePillarAssetId({
          selected,
          valid: validNodeIds.has(tile.id),
          recommended: recommendedNodeId === tile.id,
          disabled,
          faction: unit?.faction,
        });
        const position = progressiveBoardPosition(tile.x, tile.y);
        return (
          <BoardAssetSprite
            key={tile.id}
            assetId={assetId}
            className={`is-pillar ${selected ? "is-selected" : ""}`}
            style={{ left: `${position.left}%`, top: `${position.top}%`, zIndex: 600 + tile.x + tile.y }}
          />
        );
      })}
    </div>
  );
}
