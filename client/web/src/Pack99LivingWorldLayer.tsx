import { useEffect, useMemo, useState } from "react";

import { progressiveBoardPosition } from "./progressive-board-projection";
import { ASH_BRIDGE_RESOURCES, ASH_BRIDGE_TERRAIN } from "./pack99-ash-bridge-manifest";
import { pack99PublicUrl, resolvePack99MissionAsset } from "./pack99-runtime";
import type { LivingTile } from "./living-board-data";

interface Pack99LivingWorldLayerProps {
  tiles: LivingTile[];
  collectedTileIds: Set<string>;
}

type AssetMap = Record<string, string | null>;

async function resolve(reference: { sourceSuffixes: string[]; required: string[]; preferred: string[] }): Promise<string | null> {
  return pack99PublicUrl(await resolvePack99MissionAsset(reference));
}

export function Pack99LivingWorldLayer({ tiles, collectedTileIds }: Pack99LivingWorldLayerProps) {
  const [terrainAssets, setTerrainAssets] = useState<AssetMap>({});
  const [resourceAssets, setResourceAssets] = useState<AssetMap>({});
  const [resolvedCount, setResolvedCount] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all(Object.entries(ASH_BRIDGE_TERRAIN).map(async ([terrain, reference]) => [terrain, await resolve(reference)] as const))
      .then((entries) => {
        if (!active) return;
        const next = Object.fromEntries(entries);
        setTerrainAssets(next);
        setResolvedCount((current) => current + Object.values(next).filter(Boolean).length);
      });
    void Promise.all(Object.entries(ASH_BRIDGE_RESOURCES).map(async ([resource, reference]) => [resource, await resolve(reference)] as const))
      .then((entries) => {
        if (!active) return;
        const next = Object.fromEntries(entries);
        setResourceAssets(next);
        setResolvedCount((current) => current + Object.values(next).filter(Boolean).length);
      });
    return () => { active = false; };
  }, []);

  const worldTiles = useMemo(() => tiles.map((tile) => ({
    tile,
    position: progressiveBoardPosition(tile.x, tile.y),
    terrainSource: terrainAssets[tile.terrain] ?? null,
    resourceSource: tile.resource ? resourceAssets[tile.resource] ?? null : null,
  })), [tiles, terrainAssets, resourceAssets]);

  return (
    <div className="pack99-living-world" aria-hidden="true" data-resolved-assets={resolvedCount}>
      <div className="pack99-world-atmosphere"><i /><i /><i /><b /><b /></div>
      {worldTiles.map(({ tile, position, terrainSource, resourceSource }) => (
        <div
          key={tile.id}
          className={`pack99-world-cell terrain-${tile.terrain} ${tile.landmark ? "has-landmark" : ""}`}
          style={{ left: `${position.left}%`, top: `${position.top}%`, zIndex: tile.x + tile.y }}
          data-mission-asset={ASH_BRIDGE_TERRAIN[tile.terrain].id}
        >
          {terrainSource ? <img className="pack99-world-terrain" src={terrainSource} alt="" draggable={false} /> : null}
          {resourceSource && !collectedTileIds.has(tile.id) ? (
            <img className={`pack99-world-resource resource-${tile.resource}`} src={resourceSource} alt="" draggable={false} />
          ) : null}
          {tile.landmark ? <span className="pack99-world-landmark-label">{tile.landmark}</span> : null}
        </div>
      ))}
    </div>
  );
}
