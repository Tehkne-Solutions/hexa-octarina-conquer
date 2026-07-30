import { useEffect, useMemo, useState } from "react";

import { metaIsoPoint } from "./meta-board-model";
import { runtimeAssetUrl } from "./runtime-assets";

type AssetKey =
  | "grass" | "forest" | "water" | "bridge" | "ruins" | "outpost" | "camp" | "rock" | "crystal"
  | "kael" | "lyra" | "varg" | "brakk";

type AssetMap = Record<AssetKey, string | null>;
export type MetaUnitId = "kael" | "lyra" | "varg" | "brakk";

interface MetaPack99WorldProps {
  unitNodes?: Record<MetaUnitId, string>;
  unitHp?: Record<MetaUnitId, number>;
  selectedUnit?: MetaUnitId;
  defeatedUnits?: Set<MetaUnitId>;
  onUnitSelect?: (unitId: MetaUnitId) => void;
}

const ASSET_IDS: Record<AssetKey, string> = {
  grass: "TILE_GRASS_FLAT_CENTER_A_01", forest: "TILE_FOREST_FLAT_CENTER_A_01", water: "TILE_WATER_FLAT_CENTER_A_01",
  bridge: "PROP_STONE_BRIDGE_BUILT_NW_SE_01", ruins: "PROP_RUIN_LARGE_01", outpost: "TERR_OUTPOST_NEUTRAL_01",
  camp: "TERR_CAMP_NEUTRAL_01", rock: "PROP_ROCK_C_01", crystal: "RES_OCTARINE_CRYSTAL_ABUNDANT_01",
  kael: "HERO_GUARDIAN_01_IDLE_BASE_SW_01", lyra: "HERO_RANGER_01_IDLE_BASE_NE_01",
  varg: "UNIT_RECRUIT_01_IDLE_BASE_NW_01", brakk: "CHAMP_BERSERKER_01_IDLE_BASE_NW_01",
};

const SITES = [
  ["camp", "n-1-3", "Fortaleza de Orun", "blue"],
  ["ruins", "n-2-1", "Observatório", "blue"],
  ["crystal", "n-4-3", "Santuário Octarino", "violet"],
  ["outpost", "n-5-1", "Cidadela Rubra", "red"],
  ["rock", "n-6-0", "Escarpas Rubras", "red"],
  ["rock", "n-0-4", "Penhascos de Orun", "blue"],
] as const;

const DEFAULT_UNIT_NODES: Record<MetaUnitId,string> = { kael:"n-1-3", lyra:"n-2-3", varg:"n-5-2", brakk:"n-5-1" };
const DEFAULT_HP: Record<MetaUnitId,number> = { kael:18, lyra:14, varg:12, brakk:16 };
const UNIT_META: Record<MetaUnitId,{label:string; faction:"blue"|"red"; maxHp:number}> = {
  kael:{label:"Kael",faction:"blue",maxHp:18}, lyra:{label:"Lyra",faction:"blue",maxHp:14},
  varg:{label:"Varg",faction:"red",maxHp:12}, brakk:{label:"Brakk",faction:"red",maxHp:16},
};
const EMPTY_ASSETS = Object.fromEntries(Object.keys(ASSET_IDS).map((key)=>[key,null])) as AssetMap;

function nodePosition(nodeId:string){ const [,col,row]=nodeId.split("-"); const p=metaIsoPoint(Number(col),Number(row)); return {left:`${p.x/10.8}%`,top:`${p.y/6.2}%`}; }

export function MetaPack99World({ unitNodes=DEFAULT_UNIT_NODES, unitHp=DEFAULT_HP, selectedUnit, defeatedUnits=new Set(), onUnitSelect }:MetaPack99WorldProps){
  const [assets,setAssets]=useState<AssetMap>(EMPTY_ASSETS);
  useEffect(()=>{ let active=true; void Promise.all((Object.entries(ASSET_IDS) as Array<[AssetKey,string]>).map(async([key,id])=>[key,await runtimeAssetUrl(id)] as const)).then((entries)=>{if(active)setAssets(Object.fromEntries(entries) as AssetMap);}); return()=>{active=false;};},[]);
  const resolved=useMemo(()=>Object.values(assets).filter(Boolean).length,[assets]);
  return <div className="meta-pack99-world" data-resolved-assets={resolved}>
    <div className="meta-world-ground" style={assets.grass?{backgroundImage:`url(${assets.grass})`}:undefined}/>
    <div className="meta-world-biome-map" style={assets.forest?{backgroundImage:`url(${assets.forest})`}:undefined}/>
    <div className="meta-pack99-water-band">{assets.water?<img src={assets.water} alt="" draggable={false}/>:null}</div>
    {assets.bridge?<img className="meta-world-bridge" src={assets.bridge} alt="" draggable={false}/>:null}
    <div className="meta-world-sites">{SITES.map(([key,nodeId,label,faction])=>assets[key]?<div key={label} className={`meta-world-site site-${key} owner-${faction}`} style={nodePosition(nodeId)}><img src={assets[key]!} alt="" draggable={false}/><span>{label}</span></div>:null)}</div>
    <div className="meta-world-units">{(Object.keys(UNIT_META) as MetaUnitId[]).map((unitId)=>{
      if(defeatedUnits.has(unitId)) return null;
      const source=assets[unitId]; const meta=UNIT_META[unitId]; if(!source)return null;
      const hp=Math.max(0,unitHp[unitId]??meta.maxHp); const pct=Math.max(0,Math.min(100,hp/meta.maxHp*100));
      return <button type="button" key={unitId} className={`meta-world-unit unit-${unitId} owner-${meta.faction} ${selectedUnit===unitId?"is-selected":""}`} style={nodePosition(unitNodes[unitId])} onClick={()=>onUnitSelect?.(unitId)} aria-label={`Selecionar ${meta.label}`}>
        <span className="meta-world-unit-ring"/><img src={source} alt="" draggable={false}/><b>{meta.label}</b><span className="meta-unit-hp"><i style={{width:`${pct}%`}}/>{hp}/{meta.maxHp}</span>
      </button>;
    })}</div>
    <div className={`meta-pack99-world-status ${resolved>=10?"is-ready":"is-partial"}`}>PACK 99 · {resolved}/{Object.keys(ASSET_IDS).length}</div>
  </div>;
}
