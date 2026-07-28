import { useEffect, useMemo, useState } from "react";

import { progressiveBoardPosition } from "./progressive-board-projection";
import {
  loadPack99RuntimeState,
  pack99PublicUrl,
  resolvePack99MissionAsset,
  type Pack99MissionAssetReference,
} from "./pack99-runtime";
import type { LivingTile } from "./living-board-data";

type PropKind = "tree" | "rock" | "ruin" | "shrub" | "water" | "camp" | "crystal";

type PropAssetMap = Partial<Record<PropKind, string | null>>;

const REFERENCES: Record<PropKind, Pack99MissionAssetReference> = {
  tree: {
    canonicalId: "PROP_TREE_GREEN_A_01",
    sourceSuffixes: ["PROP_TREE_GREEN_A_01.png"],
    required: ["prop", "tree", "green", "a"],
    preferred: ["base", "01"],
  },
  rock: {
    canonicalId: "PROP_ROCK_A_01",
    sourceSuffixes: ["PROP_ROCK_A_01.png"],
    required: ["prop", "rock", "a"],
    preferred: ["base", "01"],
  },
  ruin: {
    canonicalId: "PROP_RUIN_SMALL_01",
    sourceSuffixes: ["PROP_RUIN_SMALL_01.png"],
    required: ["prop", "ruin", "small"],
    preferred: ["base", "01"],
  },
  shrub: {
    canonicalId: "PROP_TREE_GREEN_C_01",
    sourceSuffixes: ["PROP_TREE_GREEN_C_01.png"],
    required: ["prop", "tree", "green", "c"],
    preferred: ["base", "01"],
  },
  water: {
    canonicalId: "TILE_WATER_FLAT_CENTER_B_01",
    sourceSuffixes: ["TILE_WATER_FLAT_CENTER_B_01.png"],
    required: ["tile", "water", "flat", "center", "b"],
    preferred: ["base", "01"],
  },
  camp: {
    canonicalId: "TERR_CAMP_NEUTRAL_01",
    sourceSuffixes: ["TERR_CAMP_NEUTRAL_01.png"],
    required: ["territory", "camp", "neutral"],
    preferred: ["base", "01"],
  },
  crystal: {
    canonicalId: "RES_OCTARINE_CRYSTAL_SMALL_01",
    sourceSuffixes: ["RES_OCTARINE_CRYSTAL_SMALL_01.png"],
    required: ["res", "octarine", "crystal", "small"],
    preferred: ["base", "01"],
  },
};

interface DensityProp {
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  dx: number;
  dy: number;
  scale: number;
  depth: number;
}

function propsForTile(tile: LivingTile): DensityProp[] {
  const seed = tile.x * 17 + tile.y * 31;
  const props: DensityProp[] = [];
  const push = (kind: PropKind, index: number, dx: number, dy: number, scale = 1) => {
    props.push({ id: `${tile.id}-${kind}-${index}`, kind, x: tile.x, y: tile.y, dx, dy, scale, depth: tile.x + tile.y + index / 10 });
  };

  if (tile.terrain === "forest") {
    push("tree", 0, -4 - (seed % 3), -5, 1.15);
    push("tree", 1, 5, -1 - (seed % 4), 0.92);
    push("shrub", 2, 0, 7, 0.8);
  } else if (tile.terrain === "mountain") {
    push("rock", 0, -5, 1, 1.18);
    push("rock", 1, 5, 5, 0.84);
  } else if (tile.terrain === "ruins") {
    push("ruin", 0, -2, -4, 1.2);
    push("rock", 1, 7, 6, 0.72);
  } else if (tile.terrain === "river") {
    push("water", 0, 0, 2, 1.3);
  } else if (tile.terrain === "village") {
    push("camp", 0, 1, -4, 1.05);
    push("shrub", 1, -7, 7, 0.7);
  } else if (tile.resource === "crystal") {
    push("crystal", 0, 4, -3, 0.9);
  } else if ((seed % 3) === 0) {
    push(seed % 2 === 0 ? "shrub" : "rock", 0, (seed % 9) - 4, 5, 0.65);
  }
  return props;
}

export function Pack99EnvironmentalDensity({ tiles }: { tiles: LivingTile[] }) {
  const [assets, setAssets] = useState<PropAssetMap>({});
  const [strictFullRuntime, setStrictFullRuntime] = useState(
    () => document.documentElement.dataset.pack99Full === "true",
  );

  useEffect(() => {
    let active = true;
    void loadPack99RuntimeState()
      .then((state) => {
        if (active) setStrictFullRuntime(state.isFullRuntime);
      })
      .catch(() => {
        if (active) setStrictFullRuntime(false);
      });
    void Promise.all((Object.keys(REFERENCES) as PropKind[]).map(async (kind) => {
      const asset = await resolvePack99MissionAsset(REFERENCES[kind]);
      return [kind, pack99PublicUrl(asset)] as const;
    })).then((entries) => {
      if (active) setAssets(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const props = useMemo(() => tiles.flatMap(propsForTile), [tiles]);

  return (
    <div className="pack99-environmental-density" aria-hidden="true">
      {props.map((prop) => {
        const position = progressiveBoardPosition(prop.x, prop.y);
        const source = assets[prop.kind] ?? null;
        if (!source && strictFullRuntime) return null;
        return (
          <span
            key={prop.id}
            className={`pack99-density-prop kind-${prop.kind} ${source ? "has-asset" : "fallback"}`}
            data-pack99-canonical-id={REFERENCES[prop.kind].canonicalId}
            data-pack99-asset-error={!source && strictFullRuntime ? "canonical-payload-missing" : undefined}
            style={{
              left: `calc(${position.left}% + ${prop.dx}px)`,
              top: `calc(${position.top}% + ${prop.dy}px)`,
              zIndex: Math.round(prop.depth * 10),
              transform: `translate(-50%, -50%) scale(${prop.scale})`,
            }}
          >
            {source ? <img src={source} alt="" draggable={false} /> : <i />}
          </span>
        );
      })}
    </div>
  );
}
