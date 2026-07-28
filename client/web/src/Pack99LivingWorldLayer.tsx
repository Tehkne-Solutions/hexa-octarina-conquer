import { useEffect, useMemo, useState } from "react";

import { progressiveBoardPosition } from "./progressive-board-projection";
import {
  ASH_BRIDGE_RESOURCES,
  ASH_BRIDGE_TERRAIN,
  type Pack99MissionAssetRef,
} from "./pack99-ash-bridge-manifest";
import { pack99PublicUrl, resolvePack99MissionAsset } from "./pack99-runtime";
import type { LivingTile } from "./living-board-data";

interface Pack99LivingWorldLayerProps {
  tiles: LivingTile[];
  collectedTileIds: Set<string>;
}

type AssetMap = Record<string, string | null>;

async function resolve(reference: Pack99MissionAssetRef): Promise<string | null> {
  return pack99PublicUrl(await resolvePack99MissionAsset(reference));
}

export function Pack99LivingWorldLayer({ tiles, collectedTileIds }: Pack99LivingWorldLayerProps) {
  const [terrainAssets, setTerrainAssets] = useState<AssetMap>({});
  const [resourceAssets, setResourceAssets] = useState<AssetMap>({});
  const [loading, setLoading] = useState(true);
  const [failedKeys, setFailedKeys] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void Promise.all([
      Promise.all(Object.entries(ASH_BRIDGE_TERRAIN).map(async ([terrain, reference]) => [terrain, await resolve(reference)] as const)),
      Promise.all(Object.entries(ASH_BRIDGE_RESOURCES).map(async ([resource, reference]) => [resource, await resolve(reference)] as const)),
    ]).then(([terrainEntries, resourceEntries]) => {
      if (!active) return;
      const nextTerrain = Object.fromEntries(terrainEntries);
      const nextResources = Object.fromEntries(resourceEntries);
      const missing = [
        ...terrainEntries.filter(([, source]) => !source).map(([key]) => `terrain:${key}`),
        ...resourceEntries.filter(([, source]) => !source).map(([key]) => `resource:${key}`),
      ];
      setTerrainAssets(nextTerrain);
      setResourceAssets(nextResources);
      setFailedKeys(missing);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setFailedKeys(["runtime-index"]);
      setLoading(false);
    });

    return () => { active = false; };
  }, []);

  const requiredTerrains = useMemo(() => new Set(tiles.map((tile) => tile.terrain)), [tiles]);
  const requiredResources = useMemo(
    () => new Set(tiles.map((tile) => tile.resource).filter((resource): resource is NonNullable<LivingTile["resource"]> => Boolean(resource))),
    [tiles],
  );
  const resolvedRequiredTerrains = useMemo(
    () => [...requiredTerrains].filter((terrain) => Boolean(terrainAssets[terrain])).length,
    [requiredTerrains, terrainAssets],
  );
  const resolvedRequiredResources = useMemo(
    () => [...requiredResources].filter((resource) => Boolean(resourceAssets[resource])).length,
    [requiredResources, resourceAssets],
  );
  const requiredCount = requiredTerrains.size + requiredResources.size;
  const resolvedCount = resolvedRequiredTerrains + resolvedRequiredResources;
  const ready = !loading && requiredTerrains.size > 0 && resolvedRequiredTerrains === requiredTerrains.size;

  const worldTiles = useMemo(() => tiles.map((tile) => ({
    tile,
    position: progressiveBoardPosition(tile.x, tile.y),
    terrainSource: terrainAssets[tile.terrain] ?? null,
    resourceSource: tile.resource ? resourceAssets[tile.resource] ?? null : null,
  })), [tiles, terrainAssets, resourceAssets]);

  return (
    <div
      className={`pack99-living-world ${ready ? "is-ready" : loading ? "is-loading" : "is-incomplete"}`}
      aria-hidden="true"
      data-pack99-ready={ready ? "true" : "false"}
      data-resolved-assets={resolvedCount}
      data-required-assets={requiredCount}
      data-missing-assets={failedKeys.join(",")}
    >
      <div className="pack99-world-atmosphere"><i /><i /><i /><b /><b /></div>
      {worldTiles.map(({ tile, position, terrainSource, resourceSource }) => (
        <div
          key={tile.id}
          className={`pack99-world-cell terrain-${tile.terrain} ${tile.landmark ? "has-landmark" : ""} ${terrainSource ? "has-pack99-terrain" : "needs-fallback"}`}
          style={{ left: `${position.left}%`, top: `${position.top}%`, zIndex: tile.x + tile.y }}
          data-mission-asset={ASH_BRIDGE_TERRAIN[tile.terrain].id}
          data-pack99-canonical-id={ASH_BRIDGE_TERRAIN[tile.terrain].canonicalId}
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
