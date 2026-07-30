import { useEffect, useMemo, useState } from "react";

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

const TILE_PATCHES = [
  [12, 13, "grass"], [23, 11, "grass"], [34, 10, "forest"], [45, 12, "grass"],
  [56, 14, "grass"], [68, 13, "forest"], [80, 15, "grass"], [18, 30, "forest"],
  [30, 29, "grass"], [42, 31, "grass"], [55, 30, "grass"], [68, 31, "grass"],
  [81, 30, "forest"], [13, 48, "grass"], [25, 49, "forest"], [38, 48, "grass"],
  [51, 50, "grass"], [64, 48, "grass"], [77, 50, "forest"], [88, 48, "grass"],
  [20, 68, "forest"], [34, 67, "grass"], [48, 69, "grass"], [62, 67, "grass"],
  [76, 68, "forest"], [88, 66, "grass"],
] as const;

const PROPS = [
  ["camp", 23, 40, "Fortaleza de Orun", "blue"],
  ["ruins", 44, 36, "Observatório", "blue"],
  ["crystal", 53, 58, "Santuário Octarino", "violet"],
  ["outpost", 73, 39, "Cidadela Rubra", "red"],
  ["rock", 82, 24, "Escarpas Rubras", "red"],
  ["rock", 18, 61, "Penhascos de Orun", "blue"],
] as const;

const UNITS = [
  ["kael", 31, 45, "Kael", "blue"],
  ["lyra", 40, 53, "Lyra", "blue"],
  ["varg", 67, 46, "Varg", "red"],
  ["brakk", 77, 31, "Brakk", "red"],
] as const;

const EMPTY_ASSETS = Object.fromEntries(Object.keys(ASSET_IDS).map((key) => [key, null])) as AssetMap;

export function MetaPack99World() {
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
      <div className="meta-pack99-water-band">
        {assets.water ? <img src={assets.water} alt="" draggable={false} /> : null}
      </div>

      <div className="meta-pack99-tile-field">
        {TILE_PATCHES.map(([left, top, key], index) => {
          const source = assets[key];
          return source ? <img key={`${key}-${index}`} className={`meta-world-tile tile-${key}`} src={source} alt="" style={{ left: `${left}%`, top: `${top}%` }} draggable={false} /> : null;
        })}
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
        {UNITS.map(([key, left, top, label, faction]) => {
          const source = assets[key];
          return source ? (
            <div key={label} className={`meta-world-unit owner-${faction}`} style={{ left: `${left}%`, top: `${top}%` }}>
              <span className="meta-world-unit-ring" />
              <img src={source} alt="" draggable={false} />
              <b>{label}</b>
            </div>
          ) : null;
        })}
      </div>

      <div className={`meta-pack99-world-status ${resolved >= 10 ? "is-ready" : "is-partial"}`}>
        PACK 99 · {resolved}/{Object.keys(ASSET_IDS).length}
      </div>
    </div>
  );
}
