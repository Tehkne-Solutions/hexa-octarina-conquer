import { useMemo } from "react";

import type { HexaFilter } from "./HexaOverlay";

export type Hoc2Hex = {
  q: number;
  r: number;
  terrain: "plain" | "forest" | "mountain" | "water" | "road";
  label?: string;
  owner?: "alliance" | "rubra" | "neutral";
  landmark?: "city" | "fortress" | "mine" | "bridge" | "octarina";
  influence?: { alliance?: number; rubra?: number };
  goStatus?: "stable" | "isolated" | "surrounded";
  libertyCount?: number;
};

export type StrategicNodeView = { id: string; q: number; r: number; kind: string; owner?: "alliance" | "rubra" | "neutral"; state?: "active" | "broken" | "contested" };
export type StrategicEdgeView = { a: string; b: string; state?: "connected" | "broken" | "blocked" | "contested" };

const SQRT3 = Math.sqrt(3);
function hexCenter(q: number, r: number, size: number) { return { x: size * SQRT3 * (q + r / 2), y: size * 1.5 * r }; }
function hexPoints(cx: number, cy: number, size: number) {
  return Array.from({ length: 6 }, (_, index) => { const angle = ((60 * index - 30) * Math.PI) / 180; return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`; }).join(" ");
}
function Landmark({ hex, x, y }: { hex: Hoc2Hex; x: number; y: number }) {
  if (!hex.landmark) return null;
  const glyph = { city: "♜", fortress: "♛", mine: "◆", bridge: "═", octarina: "✦" }[hex.landmark];
  return <g className={`hoc2-landmark hoc2-landmark-${hex.landmark}`} transform={`translate(${x} ${y - 2})`}><circle r="24" className="hoc2-landmark-base" /><text textAnchor="middle" dominantBaseline="central" className="hoc2-landmark-glyph">{glyph}</text>{hex.label ? <text y="38" textAnchor="middle" className="hoc2-landmark-label">{hex.label}</text> : null}</g>;
}
function InfluenceMark({ hex }: { hex: Hoc2Hex }) {
  const alliance = hex.influence?.alliance ?? 0, rubra = hex.influence?.rubra ?? 0;
  const dominant = alliance === rubra ? "contested" : alliance > rubra ? "alliance" : "rubra";
  const intensity = Math.max(alliance, rubra);
  return <g className={`hoc2-influence-mark influence-${dominant} status-${hex.goStatus ?? "stable"}`}>{intensity > 0 ? <circle r={18 + Math.min(intensity, 4) * 5} className="hoc2-influence-halo" /> : null}<text y="-4" textAnchor="middle" className="hoc2-influence-value">{alliance}:{rubra}</text>{hex.libertyCount !== undefined ? <text y="13" textAnchor="middle" className="hoc2-liberty-value">L {hex.libertyCount}</text> : null}</g>;
}

export function LivingMap({ hexes, hexaMode = false, hexaFilter = "domain", networkNodes = [], networkEdges = [] }: {
  hexes: Hoc2Hex[]; hexaMode?: boolean; hexaFilter?: HexaFilter; networkNodes?: StrategicNodeView[]; networkEdges?: StrategicEdgeView[];
}) {
  const size = 58;
  const geometry = useMemo(() => hexes.map((hex) => ({ hex, ...hexCenter(hex.q, hex.r, size) })), [hexes]);
  const nodeGeometry = useMemo(() => new Map(networkNodes.map((node) => [node.id, { node, ...hexCenter(node.q, node.r, size) }])), [networkNodes]);
  const minX = Math.min(...geometry.map((item) => item.x)) - 100, maxX = Math.max(...geometry.map((item) => item.x)) + 100;
  const minY = Math.min(...geometry.map((item) => item.y)) - 100, maxY = Math.max(...geometry.map((item) => item.y)) + 100;
  return <svg className={`hoc2-living-map${hexaMode ? " is-hexa" : ""}`} data-hexa-filter={hexaFilter} viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} role="img" aria-label={hexaMode ? "Mapa estratégico em Modo Hexa" : "Mapa vivo experimental do HOC2"}>
    <defs><linearGradient id="hoc2-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#526244" /><stop offset="1" stopColor="#293525" /></linearGradient><filter id="hoc2-soft-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodOpacity="0.38" /></filter></defs>
    <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="url(#hoc2-ground)" />
    <g className="hoc2-world-layer">{geometry.map(({ hex, x, y }) => <g key={`${hex.q},${hex.r}`} transform={`translate(${x} ${y})`}><polygon points={hexPoints(0, 0, size - 1.5)} className={`hoc2-terrain hoc2-terrain-${hex.terrain}`} /><polygon points={hexPoints(0, 0, size - 5)} className="hoc2-terrain-inset" /></g>)}</g>
    <g className="hoc2-road-layer">{geometry.filter((item) => item.hex.terrain === "road").map(({ hex, x, y }) => <path key={`road-${hex.q},${hex.r}`} d={`M ${x - 42} ${y + 18} Q ${x} ${y - 8} ${x + 42} ${y - 18}`} className="hoc2-road" />)}</g>
    {hexaMode && hexaFilter === "connections" ? <g className="hoc2-network-layer">{networkEdges.map((edge) => { const a=nodeGeometry.get(edge.a), b=nodeGeometry.get(edge.b); if(!a||!b) return null; return <line key={`${edge.a}-${edge.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`hoc2-network-edge state-${edge.state ?? "connected"}`} />; })}{[...nodeGeometry.values()].map(({node,x,y}) => <g key={node.id} transform={`translate(${x} ${y})`} className={`hoc2-network-node owner-${node.owner ?? "neutral"} state-${node.state ?? "active"}`}><circle r="13"/><text y="4" textAnchor="middle">●</text><text y="28" textAnchor="middle" className="hoc2-network-label">{node.kind}</text></g>)}</g> : null}
    {hexaMode ? <g className={`hoc2-hexa-layer hoc2-hexa-${hexaFilter}`}>{geometry.map(({ hex, x, y }) => <g key={`hexa-${hex.q},${hex.r}`} transform={`translate(${x} ${y})`} className={`hoc2-hexa-cell owner-${hex.owner ?? "neutral"}`}>{hexaFilter === "domain" ? <polygon points={hexPoints(0, 0, size - 3)} className="hoc2-domain-fill" /> : null}{hexaFilter === "influence" ? <InfluenceMark hex={hex} /> : null}<polygon points={hexPoints(0, 0, size - 2)} className="hoc2-grid-outline" /><text y={hexaFilter === "influence" ? 34 : 5} textAnchor="middle" className="hoc2-coordinate">{hex.q},{hex.r}</text></g>)}</g> : null}
    <g className="hoc2-landmark-layer" filter="url(#hoc2-soft-shadow)">{geometry.map(({ hex, x, y }) => <Landmark key={`landmark-${hex.q},${hex.r}`} hex={hex} x={x} y={y} />)}</g>
  </svg>;
}
