import { useEffect, useMemo, useState } from "react";

import { metaIsoPoint } from "./meta-board-model";
import { runtimeAssetUrl } from "./runtime-assets";

type AssetKey =
  | "grass"
  | "forest"
  | "water"
  | "bridge"
  | "ruins"
  | "outpost"
  | "camp"
  | "rock"
  | "crystal"
  | "kael"
  | "lyra"
  | "varg"
  | "brakk";

type AssetMap = Record<AssetKey, string | null>;

export type MetaUnitId = "kael" | "lyra" | "varg" | "brakk";

interface MetaPack99WorldProps {
  unitNodes?: Record<MetaUnitId, string>;
  selectedUnit?: MetaUnitId;
  onUnitSelect?: (unitId: MetaUnitId) => void;
}

const ASSET_IDS: Record<AssetKey, string> = {
  grass: "TILE_GRASS_FLAT_CENTER_A_01",
  forest: "TILE_FOREST_FLAT_CENTER_A_01",
  water: "TILE_WATER_FLAT_CENTER_A_01",
  bridge: "PROP_STONE_BRIDGE_BUILT_NW_SE_01",
  ruins: "PROP_RUIN_LARGE_01",
  outpost: "TERR_OUTPOST_NEUTRAL_01",
  camp: "TERR_CAMP_NEUTRAL_01",
  rock: "PROP_ROCK_C_01",
  crystal: "RES_OCTARINE_CRYSTAL_ABUNDANT_01",
  kael: "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
  lyra: "HERO_RANGER_01_IDLE_BASE_NE_01",
  varg: "UNIT_RECRUIT_01_IDLE_BASE_NW_01",
  brakk: "CHAMP_BERSERKER_01_IDLE_BASE_NW_01",
};

const BIOME_PATCHES = [
  [18, 20, 34, 26, "forest"],
  [78, 21, 30, 24, "forest"],
  [17, 70, 30, 22, "forest"],
  [82, 68, 32, 25, "forest"],
] as const;

const PROPS = [
  ["camp", 24, 43, "Fortaleza de Orun", "blue"],
  ["ruins", 43, 35, "Observatório", "blue"],
  ["crystal", 54, 61, "Santuário Octarino", "violet"],
  ["outpost", 75, 42, "Cidadela Rubra", "red"],
  ["rock", 84, 24, "Escarpas Rubras", "red"],
  ["rock", 17, 65, "Penhascos de Orun", "blue"],
] as const;

const DEFAULT_UNIT_NODES: Record<MetaUnitId, string> = {
  kael: "n-1-3",
  lyra: "n-2-3",
  varg: "n-5-2",
  brakk: "n-5-1",
};

const UNIT_META: Record<MetaUnitId, { label: string; faction: "blue" | "red" }> = {
  kael: { label: "Kael", faction: "blue" },
  lyra: { label: "Lyra", faction: "blue" },
  varg: { label: "Varg", faction: "red" },
  brakk: { label: "Brakk", faction: "red" },
};

const EMPTY_ASSETS = Object.fromEntries(Object.keys(ASSET_IDS).map((key) => [key, null])) as AssetMap;

function nodePosition(nodeId: string): { left: string; top: string } {
  const [, col, row] = nodeId.split("-");
  const point = metaIsoPoint(Number(col), Number(row));
  return { left: `${point.x / 10.8}%`, top: `${point.y / 6.2}%` };
}

export function MetaPack99World({ unitNodes = DEFAULT_UNIT_NODES, selectedUnit, onUnitSelect }: MetaPack99WorldProps) {
  const [assets, setAssets] = useState<AssetMap>(EMPTY_ASSETS);

  useEffect(() => {
    let active = true;
    void Promise.all(
      (Object.entries(ASSET_IDS) as Array<[AssetKey, string]>).map(async ([key, id]) => [key, await runtimeAssetUrl(id)] as const),
    ).then((entries) => {
      if (active) setAssets(Object.fromEntries(entries) as AssetMap);
    });
    return () => { active = false; };
  }, []);

  const resolved = useMemo(() => Object.values(assets).filter(Boolean).length, [assets]);

  return (
    <div className="meta-pack99-world" aria-hidden="true" data-resolved-assets={resolved}>
      <div
        className="meta-world-ground"
        style={assets.grass ? { backgroundImage: `url(${assets.grass})` } : undefined}
      />

      <div className="meta-world-biomes">
        {BIOME_PATCHES.map(([left, top, width, height, key], index) => {
          const source = assets[key];
          return source ? (
            <div
              key={`${key}-${index}`}
              className={`meta-world-biome biome-${key}`}
              style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, backgroundImage: `url(${source})` }}
            />
          ) : null;
        })}
      </div>

      <div className="meta-pack99-water-band">
        {assets.water ? <img src={assets.water} alt="" draggable={false} /> : null}
      </div>

      {assets.bridge ? <img className="meta-world-bridge" src={assets.bridge} alt="" draggable={false} /> : null}

      <div className="meta-world-props">
        {PROPS.map(([key, left, top, label, faction]) => {
          const source = assets[key];
          return source ? (
            <div key={label} className={`meta-world-prop prop-${key} owner-${faction}`} style={{ left: `${left}%`, top: `${top}%` }}>
              <img src={source} alt="" draggable={false} />
              <span>{label}</span>
            </div>
          ) : null;
        })}
      </div>

      <div className="meta-world-units">
        {(Object.keys(UNIT_META) as MetaUnitId[]).map((unitId) => {
          const source = assets[unitId];
          const meta = UNIT_META[unitId];
          return source ? (
            <button
              type="button"
              key={unitId}
              className={`meta-world-unit unit-${unitId} owner-${meta.faction} ${selectedUnit === unitId ? "is-selected" : ""}`}
              style={nodePosition(unitNodes[unitId])}
              onClick={() => onUnitSelect?.(unitId)}
              aria-label={`Selecionar ${meta.label}`}
            >
              <span className="meta-world-unit-ring" />
              <img src={source} alt="" draggable={false} />
              <b>{meta.label}</b>
            </button>
          ) : null;
        })}
      </div>

      <div className={`meta-pack99-world-status ${resolved >= 10 ? "is-ready" : "is-partial"}`}>
        PACK 99 · {resolved}/{Object.keys(ASSET_IDS).length}
      </div>
    </div>
  );
}
