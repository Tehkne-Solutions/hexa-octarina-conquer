import { useEffect, useMemo, useState } from "react";

import { emptyPack99StrategicCatalog, loadPack99StrategicCatalog, type Pack99StrategicCatalog } from "../pack99-strategic-catalog";
import type { HexaFilter } from "./HexaOverlay";

export type Hoc2Hex = {
  q: number; r: number; terrain: "plain" | "forest" | "mountain" | "water" | "road";
  label?: string; owner?: "alliance" | "rubra" | "neutral";
  landmark?: "city" | "fortress" | "mine" | "bridge" | "octarina";
  influence?: { alliance?: number; rubra?: number }; goStatus?: "stable" | "isolated" | "surrounded"; libertyCount?: number;
};
export type StrategicNodeView = { id: string; q: number; r: number; kind: string; owner?: "alliance" | "rubra" | "neutral"; state?: "active" | "broken" | "contested" };
export type StrategicEdgeView = { a: string; b: string; state?: "connected" | "broken" | "blocked" | "contested" };
export type OctarinaNodeView = { id: string; q: number; r: number; kind: "source" | "conductor" | "core"; owner?: "alliance" | "rubra" | "neutral"; state?: "active" | "contested" | "unstable" | "disabled"; charge?: number };
export type OctarinaEdgeView = { a: string; b: string; state?: "connected" | "broken" | "contested" | "disabled" };
export type OctarinaFormationView = { coreId: string; slots: number; maxSlots: number; flow: number; resonance: boolean };
export type ArmyView = { id: string; q: number; r: number; faction: "alliance" | "rubra"; commander: string; supply: "supplied" | "low" | "cut-off"; movement: number; units: string[] };
export type MovementTargetView = { q: number; r: number; cost: number; contact?: boolean; zoc?: boolean };

type AmbientKind = "watchtower" | "bastion" | "rocks" | "sanctuary" | "bridge";
type AmbientScenery = { q: number; r: number; kind: AmbientKind; scale?: number; opacity?: number };

const SQRT3 = Math.sqrt(3);
const AMBIENT_SCENERY: AmbientScenery[] = [
  { q: 1, r: 6, kind: "watchtower", scale: .78, opacity: .82 },
  { q: 3, r: 4, kind: "bridge", scale: .9, opacity: .92 },
  { q: 4, r: 6, kind: "sanctuary", scale: .78, opacity: .82 },
  { q: 5, r: 5, kind: "rocks", scale: .82, opacity: .84 },
  { q: 7, r: 4, kind: "bastion", scale: .78, opacity: .82 },
];
const WORLD_ROUTES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0,0],[1,0],[2,0],[3,1],[3,2],[3,3],[3,4],[4,5],[5,5],[6,4],[7,4]],
  [[2,0],[3,0],[4,0],[5,0]],
];

// Visual-only affine projection. HOC2 q/r topology is unchanged; all world,
// analytical and gameplay layers share this exact transform.
function hexCenter(q: number, r: number, size: number) {
  return {
    x: size * 1.5 * (q + r),
    y: size * (SQRT3 / 2) * (r - q),
  };
}
function hexPoints(cx: number, cy: number, size: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a=((60*i-60)*Math.PI)/180;
    return `${cx+size*Math.cos(a)},${cy+size*Math.sin(a)}`;
  }).join(" ");
}
function terrainFill(terrain: Hoc2Hex["terrain"]) {
  if (terrain === "forest") return "url(#hoc2-texture-forest)";
  if (terrain === "water") return "url(#hoc2-texture-water)";
  if (terrain === "mountain") return "url(#hoc2-texture-mountain)";
  return "url(#hoc2-texture-grass)";
}
function pickTerrainVariant(hex: Hoc2Hex, variants: Array<string | null>) {
  const available=variants.filter((variant): variant is string=>Boolean(variant));
  if(!available.length) return null;
  const index=Math.abs(hex.q*17+hex.r*31+(hex.q*hex.r)*7)%available.length;
  return available[index];
}
function terrainAsset(hex: Hoc2Hex, assets: Pack99StrategicCatalog) {
  if (hex.terrain === "water") return pickTerrainVariant(hex,[assets.water,assets.waterB,assets.waterC]);
  if (hex.terrain === "forest") return pickTerrainVariant(hex,[assets.forest,assets.forestB,assets.forestC]);
  return pickTerrainVariant(hex,[assets.grass,assets.grassB,assets.grassC]);
}
function landmarkAsset(hex: Hoc2Hex, assets: Pack99StrategicCatalog) {
  if (hex.landmark === "bridge") return assets.bridge;
  if (hex.landmark === "octarina") return assets.sanctuary;
  if (hex.landmark === "mine") return assets.rocks;
  if (hex.landmark === "fortress") return assets.bastion;
  if (hex.landmark === "city") return assets.watchtower;
  return null;
}
function ambientAsset(kind: AmbientKind, assets: Pack99StrategicCatalog) {
  if (kind === "bridge") return assets.bridge;
  if (kind === "sanctuary") return assets.sanctuary;
  if (kind === "rocks") return assets.rocks;
  if (kind === "bastion") return assets.bastion;
  return assets.watchtower;
}
function routePath(route: ReadonlyArray<readonly [number, number]>, size: number) {
  const points=route.map(([q,r])=>hexCenter(q,r,size));
  if(points.length<2) return "";
  return points.slice(1).reduce((d,p,index)=>{
    const previous=points[index];
    const mx=(previous.x+p.x)/2;
    const my=(previous.y+p.y)/2-4;
    return `${d} Q ${mx} ${my} ${p.x} ${p.y}`;
  },`M ${points[0].x} ${points[0].y}`);
}
function Landmark({ hex, x, y, assets }: { hex: Hoc2Hex; x: number; y: number; assets: Pack99StrategicCatalog }) {
  if (!hex.landmark) return null;
  const glyph={city:"♜",fortress:"♛",mine:"◆",bridge:"═",octarina:"✦"}[hex.landmark];
  const art = landmarkAsset(hex, assets);
  return <g className={`hoc2-landmark hoc2-landmark-${hex.landmark}${art?" has-world-art":""}`} transform={`translate(${x} ${y-7})`}>
    <circle r="27" className="hoc2-landmark-base"/>
    {art ? <image href={art} x="-46" y="-65" width="92" height="92" preserveAspectRatio="xMidYMid meet" className="hoc2-landmark-art"/> : <text textAnchor="middle" dominantBaseline="central" className="hoc2-landmark-glyph">{glyph}</text>}
    {hex.label?<text y="43" textAnchor="middle" className="hoc2-landmark-label">{hex.label}</text>:null}
  </g>;
}
function InfluenceMark({ hex }: { hex: Hoc2Hex }) { const a=hex.influence?.alliance??0,r=hex.influence?.rubra??0; const d=a===r?"contested":a>r?"alliance":"rubra"; const i=Math.max(a,r); return <g className={`hoc2-influence-mark influence-${d} status-${hex.goStatus??"stable"}`}>{i>0?<circle r={18+Math.min(i,4)*5} className="hoc2-influence-halo"/>:null}<text y="-4" textAnchor="middle" className="hoc2-influence-value">{a}:{r}</text>{hex.libertyCount!==undefined?<text y="13" textAnchor="middle" className="hoc2-liberty-value">L {hex.libertyCount}</text>:null}</g>; }

export function LivingMap({ hexes, hexaMode=false, hexaFilter="domain", networkNodes=[], networkEdges=[], octarinaNodes=[], octarinaEdges=[], octarinaFormation, armies=[], movementTargets=[] }: {
  hexes: Hoc2Hex[]; hexaMode?: boolean; hexaFilter?: HexaFilter; networkNodes?: StrategicNodeView[]; networkEdges?: StrategicEdgeView[]; octarinaNodes?: OctarinaNodeView[]; octarinaEdges?: OctarinaEdgeView[]; octarinaFormation?: OctarinaFormationView; armies?: ArmyView[]; movementTargets?: MovementTargetView[];
}) {
  const size=58;
  const tileCanvas=size*3.45;
  const [assets,setAssets]=useState<Pack99StrategicCatalog>(()=>emptyPack99StrategicCatalog());
  useEffect(()=>{let active=true;void loadPack99StrategicCatalog().then((catalog)=>{if(active)setAssets(catalog)});return()=>{active=false}},[]);
  const geometry=useMemo(()=>hexes.map((hex)=>({hex,...hexCenter(hex.q,hex.r,size)})),[hexes]);
  const depthGeometry=useMemo(()=>[...geometry].sort((a,b)=>a.y-b.y||a.x-b.x),[geometry]);
  const nodeGeometry=useMemo(()=>new Map(networkNodes.map((node)=>[node.id,{node,...hexCenter(node.q,node.r,size)}])),[networkNodes]);
  const octGeometry=useMemo(()=>new Map(octarinaNodes.map((node)=>[node.id,{node,...hexCenter(node.q,node.r,size)}])),[octarinaNodes]);
  const movementMap=useMemo(()=>new Map(movementTargets.map((target)=>[`${target.q},${target.r}`,target])),[movementTargets]);
  const minX=Math.min(...geometry.map(i=>i.x))-110,maxX=Math.max(...geometry.map(i=>i.x))+110,minY=Math.min(...geometry.map(i=>i.y))-125,maxY=Math.max(...geometry.map(i=>i.y))+125;
  const worldWidth=maxX-minX,worldHeight=maxY-minY;
  const hasComposedWorld=Boolean(assets.grass&&assets.forest&&assets.water);

  return <svg className={`hoc2-living-map${hexaMode?" is-hexa":""}${hasComposedWorld?" has-authored-world":""}`} data-hexa-filter={hexaFilter} data-world-source={hasComposedWorld?"MAP_FOREST_FRONTIER_8X8_01":"fallback"} data-world-renderer={hasComposedWorld?"PACK99_COMPOSED_TILES":"fallback"} data-projection="axial-isometric-diamond" viewBox={`${minX} ${minY} ${worldWidth} ${worldHeight}`} role="img" aria-label={hexaMode?"Mapa estratégico em Modo Hexa sobre Fronteira Verde":"Mapa Vivo 2,5D Fronteira Verde"} style={hexaMode?{filter:"saturate(.84) contrast(1.08) brightness(.91)"}:undefined}>
    <defs>
      <linearGradient id="hoc2-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#526244"/><stop offset="1" stopColor="#293525"/></linearGradient>
      <filter id="hoc2-soft-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodOpacity="0.38"/></filter>
      <pattern id="hoc2-texture-grass" patternUnits="objectBoundingBox" width="1" height="1"><rect width="100%" height="100%" fill="#65764d"/>{assets.grass?<image href={assets.grass} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" opacity=".98"/>:null}</pattern>
      <pattern id="hoc2-texture-forest" patternUnits="objectBoundingBox" width="1" height="1"><rect width="100%" height="100%" fill="#405538"/>{assets.forest?<image href={assets.forest} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" opacity=".99"/>:null}</pattern>
      <pattern id="hoc2-texture-water" patternUnits="objectBoundingBox" width="1" height="1"><rect width="100%" height="100%" fill="#435f66"/>{assets.water?<image href={assets.water} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" opacity=".99"/>:null}</pattern>
      <pattern id="hoc2-texture-mountain" patternUnits="objectBoundingBox" width="1" height="1"><rect width="100%" height="100%" fill="#5b5a4e"/>{assets.rocks?<image href={assets.rocks} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" opacity=".86"/>:null}</pattern>
    </defs>

    <rect className="hoc2-world-fallback" x={minX} y={minY} width={worldWidth} height={worldHeight} fill="url(#hoc2-ground)"/>

    {hasComposedWorld?<g className="hoc2-authored-world" data-world-grid="hidden">
      {depthGeometry.map(({hex,x,y})=>{
        const tile=terrainAsset(hex,assets);
        return <g key={`world-${hex.q},${hex.r}`} className={`hoc2-world-cell terrain-${hex.terrain}`} transform={`translate(${x} ${y})`}>
          {tile?<image href={tile} x={-tileCanvas/2} y={-tileCanvas/2} width={tileCanvas} height={tileCanvas} preserveAspectRatio="xMidYMid meet" className="hoc2-world-tile" style={{filter:"saturate(.98) contrast(1.035)"}}/>:null}
          {hex.terrain==="mountain"&&assets.rocks?<image href={assets.rocks} x="-38" y="-58" width="76" height="76" preserveAspectRatio="xMidYMid meet" className="hoc2-world-prop hoc2-world-rocks"/>:null}
        </g>;
      })}
      <g className="hoc2-world-road-layer" pointerEvents="none">{WORLD_ROUTES.map((route,index)=>{const d=routePath(route,size);return <g key={`world-route-${index}`}><path d={d} className="hoc2-road-shadow" fill="none" stroke="rgba(45,31,18,.68)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" opacity=".7"/><path d={d} className="hoc2-road" fill="none" style={{strokeWidth:7,opacity:.82}} strokeLinecap="round" strokeLinejoin="round"/></g>})}</g>
      <g className="hoc2-world-ambient-layer" pointerEvents="none">{AMBIENT_SCENERY.map((scenery)=>{const art=ambientAsset(scenery.kind,assets);if(!art)return null;const p=hexCenter(scenery.q,scenery.r,size);const scale=scenery.scale??.75;const width=82*scale,height=82*scale;return <image key={`ambient-${scenery.q}-${scenery.r}-${scenery.kind}`} href={art} x={p.x-width/2} y={p.y-height*.78} width={width} height={height} opacity={scenery.opacity??.78} preserveAspectRatio="xMidYMax meet" className={`hoc2-world-ambient hoc2-world-ambient-${scenery.kind}`}/>})}</g>
    </g>:<>
      <g className="hoc2-world-layer">{geometry.map(({hex,x,y})=><g key={`${hex.q},${hex.r}`} transform={`translate(${x} ${y})`}><polygon points={hexPoints(0,0,size-1.5)} className={`hoc2-terrain hoc2-terrain-${hex.terrain}`} style={{fill:terrainFill(hex.terrain)}}/><polygon points={hexPoints(0,0,size-5)} className="hoc2-terrain-inset"/></g>)}</g>
      <g className="hoc2-road-layer">{geometry.filter(i=>i.hex.terrain==="road").map(({hex,x,y})=><g key={`road-${hex.q},${hex.r}`}><path d={`M ${x-50} ${y+20} Q ${x} ${y-7} ${x+50} ${y-20}`} className="hoc2-road-shadow"/><path d={`M ${x-50} ${y+20} Q ${x} ${y-7} ${x+50} ${y-20}`} className="hoc2-road"/></g>)}</g>
    </>}

    {hexaMode&&hexaFilter==="connections"?<g className="hoc2-network-layer">{networkEdges.map((edge)=>{const a=nodeGeometry.get(edge.a),b=nodeGeometry.get(edge.b);if(!a||!b)return null;return <line key={`${edge.a}-${edge.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`hoc2-network-edge state-${edge.state??"connected"}`}/>})}{[...nodeGeometry.values()].map(({node,x,y})=><g key={node.id} transform={`translate(${x} ${y})`} className={`hoc2-network-node owner-${node.owner??"neutral"} state-${node.state??"active"}`}><circle r="13"/><text y="4" textAnchor="middle">●</text><text y="28" textAnchor="middle" className="hoc2-network-label">{node.kind}</text></g>)}</g>:null}
    {hexaMode&&hexaFilter==="octarina"?<g className="hoc2-octarina-layer">{octarinaEdges.map((edge)=>{const a=octGeometry.get(edge.a),b=octGeometry.get(edge.b);if(!a||!b)return null;return <line key={`${edge.a}-${edge.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`hoc2-octarina-edge state-${edge.state??"connected"}`}/>})}{[...octGeometry.values()].map(({node,x,y})=><g key={node.id} transform={`translate(${x} ${y})`} className={`hoc2-octarina-node kind-${node.kind} owner-${node.owner??"neutral"} state-${node.state??"active"}`}><circle r={node.kind==="core"?19:14} className="hoc2-octarina-node-ring"/><text y="5" textAnchor="middle" className="hoc2-octarina-glyph">✦</text><text y="31" textAnchor="middle" className="hoc2-octarina-label">{node.kind}{node.charge?` · ${node.charge}`:""}</text></g>)}{octarinaFormation&&octGeometry.get(octarinaFormation.coreId)?(()=>{const core=octGeometry.get(octarinaFormation.coreId)!;return <g transform={`translate(${core.x} ${core.y})`} className={`hoc2-formation-status${octarinaFormation.resonance?" is-active":""}`}><circle r="38" className="hoc2-formation-ring"/><text y="-46" textAnchor="middle">HEXA {octarinaFormation.slots}/{octarinaFormation.maxSlots}</text><text y="52" textAnchor="middle">FLOW {octarinaFormation.flow}</text></g>})():null}</g>:null}
    {hexaMode?<g className={`hoc2-hexa-layer hoc2-hexa-${hexaFilter}`}>{geometry.map(({hex,x,y})=>{const move=movementMap.get(`${hex.q},${hex.r}`);return <g key={`hexa-${hex.q},${hex.r}`} transform={`translate(${x} ${y})`} className={`hoc2-hexa-cell owner-${hex.owner??"neutral"}`}>{hexaFilter==="domain"?<polygon points={hexPoints(0,0,size-3)} className="hoc2-domain-fill" style={{opacity:.24}}/>:null}{hexaFilter==="influence"?<InfluenceMark hex={hex}/>:null}{hexaFilter==="movement"&&move?<><polygon points={hexPoints(0,0,size-7)} className={`hoc2-movement-fill${move.contact?" is-contact":move.zoc?" is-zoc":""}`}/><text y="5" textAnchor="middle" className="hoc2-movement-cost">{move.contact?"COMBATE":`MP ${move.cost}`}</text></>:null}<polygon points={hexPoints(0,0,size-2)} className="hoc2-grid-outline" style={{opacity:.5,strokeWidth:1.7}}/>{hexaFilter==="movement"?<text y="28" textAnchor="middle" className="hoc2-coordinate">{hex.q},{hex.r}</text>:null}</g>})}</g>:null}
    <g className="hoc2-landmark-layer" filter="url(#hoc2-soft-shadow)">{geometry.map(({hex,x,y})=><Landmark key={`landmark-${hex.q},${hex.r}`} hex={hex} x={x} y={y} assets={assets}/>)}</g>
    <g className="hoc2-army-layer" filter="url(#hoc2-soft-shadow)">{armies.map((army)=>{const p=hexCenter(army.q,army.r,size);const art=army.id==="kael"?assets.kael:assets.brakk;return <g key={army.id} transform={`translate(${p.x} ${p.y-18})`} className={`hoc2-army owner-${army.faction} supply-${army.supply}`}><circle r="24"/>{art?<image href={art} x="-25" y="-34" width="50" height="56" preserveAspectRatio="xMidYMax meet" className="hoc2-army-art"/>:<text y="5" textAnchor="middle" className="hoc2-army-glyph">⚔</text>}<text y="38" textAnchor="middle" className="hoc2-army-label">{army.commander}</text></g>})}</g>
  </svg>;
}
