import { useEffect, useMemo, useState } from "react";

import { progressiveBoardPosition } from "./progressive-board-projection";
import { resolvePack99Asset, pack99PublicUrl } from "./pack99-runtime";
import type { LivingTile } from "./living-board-data";

interface Pack99LivingWorldLayerProps {
  tiles: LivingTile[];
  collectedTileIds: Set<string>;
}

type AssetMap = Record<string, string | null>;

const TERRAIN_QUERY: Record<LivingTile["terrain"], { required: string[]; preferred: string[] }> = {
  grass: { required: ["tile", "grass", "flat", "center"], preferred: ["ancestral", "a_01"] },
  forest: { required: ["tile", "forest", "flat", "center"], preferred: ["a_01"] },
  river: { required: ["tile", "water", "flat", "center"], preferred: ["a_01"] },
  bridge: { required: ["bridge"], preferred: ["active", "base", "01"] },
  ruins: { required: ["ruin"], preferred: ["observatory", "base", "01"] },
  mill: { required: ["mill"], preferred: ["base", "01"] },
  village: { required: ["village"], preferred: ["house", "base", "01"] },
  mountain: { required: ["mountain"], preferred: ["base", "01"] },
};

const RESOURCE_QUERY: Record<NonNullable<LivingTile["resource"]>, { required: string[]; preferred: string[] }> = {
  wood: { required: ["resource", "wood"], preferred: ["node", "base", "01"] },
  food: { required: ["resource", "food"], preferred: ["node", "base", "01"] },
  crystal: { required: ["octarine", "crystal"], preferred: ["abundant", "base", "01"] },
};

async function resolve(query: { required: string[]; preferred: string[] }): Promise<string | null> {
  return pack99PublicUrl(await resolvePack99Asset(query.required, query.preferred));
}

export function Pack99LivingWorldLayer({ tiles, collectedTileIds }: Pack99LivingWorldLayerProps) {
  const [terrainAssets, setTerrainAssets] = useState<AssetMap>({});
  const [resourceAssets, setResourceAssets] = useState<AssetMap>({});

  useEffect(() => {
    let active = true;
    void Promise.all(Object.entries(TERRAIN_QUERY).map(async ([terrain, query]) => [terrain, await resolve(query)] as const))
      .then((entries) => { if (active) setTerrainAssets(Object.fromEntries(entries)); });
    void Promise.all(Object.entries(RESOURCE_QUERY).map(async ([resource, query]) => [resource, await resolve(query)] as const))
      .then((entries) => { if (active) setResourceAssets(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, []);

  const worldTiles = useMemo(() => tiles.map((tile) => ({
    tile,
    position: progressiveBoardPosition(tile.x, tile.y),
    terrainSource: terrainAssets[tile.terrain] ?? null,
    resourceSource: tile.resource ? resourceAssets[tile.resource] ?? null : null,
  })), [tiles, terrainAssets, resourceAssets]);

  return (
    <div className="pack99-living-world" aria-hidden="true">
      <div className="pack99-world-atmosphere"><i /><i /><i /><b /><b /></div>
      {worldTiles.map(({ tile, position, terrainSource, resourceSource }) => (
        <div
          key={tile.id}
          className={`pack99-world-cell terrain-${tile.terrain}`}
          style={{ left: `${position.left}%`, top: `${position.top}%`, zIndex: tile.x + tile.y }}
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
