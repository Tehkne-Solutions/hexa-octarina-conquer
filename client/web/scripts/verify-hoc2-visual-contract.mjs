import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const webRoot=path.resolve(here,"..");
const repoRoot=path.resolve(webRoot,"../..");

function sourceCandidates(relative){
  const candidates=[
    path.resolve(repoRoot,relative),
    path.resolve(webRoot,relative),
  ];
  if(relative.startsWith("client/web/")){
    candidates.push(path.resolve(webRoot,relative.slice("client/web/".length)));
  }
  return [...new Set(candidates)];
}
function read(relative){
  const candidates=sourceCandidates(relative);
  const source=candidates.find((candidate)=>fs.existsSync(candidate));
  if(!source) throw new Error(`HOC2_VISUAL_CONTRACT_SOURCE_MISSING:${relative}:${candidates.join("|")}`);
  return fs.readFileSync(source,"utf8");
}
function requireMatch(value, pattern, marker){if(!pattern.test(value)) throw new Error(`HOC2_VISUAL_CONTRACT_FAIL:${marker}`)}
function requireText(value, text, marker){if(!value.includes(text)) throw new Error(`HOC2_VISUAL_CONTRACT_FAIL:${marker}`)}

const contract=JSON.parse(read("docs/hoc2/HOC2_VISUAL_CONTRACT_v1.json"));
if(contract.status!=="P0_BLOCKING") throw new Error("HOC2_VISUAL_CONTRACT_FAIL:contract-not-blocking");
if(contract.worldArchitecture?.vs01VisualMap!=="MAP_FOREST_FRONTIER_8X8_01") throw new Error("HOC2_VISUAL_CONTRACT_FAIL:wrong-world-source");

const catalog=read("client/web/src/pack99-strategic-catalog.ts");
for (const id of ["TILE_GRASS_FLAT_CENTER_A_01","TILE_FOREST_FLAT_CENTER_A_01","TILE_WATER_FLAT_CENTER_A_01","PROP_ROCK_C_01","TERR_OUTPOST_NEUTRAL_01","TERR_CAMP_NEUTRAL_01","RES_OCTARINE_CRYSTAL_ABUNDANT_01"]) {
  requireText(catalog,id,`composed-world-asset-missing:${id}`);
}
if(catalog.includes("worldPreview")) throw new Error("HOC2_VISUAL_CONTRACT_FAIL:flattened-world-preview-returned");

const game=read("client/web/src/hoc2/Hoc2Game.tsx");
requireMatch(game,/for \(let r=0;r<8;r\+=1\)/,"strategic-region-not-8x8");
requireMatch(game,/for \(let q=0;q<8;q\+=1\)/,"strategic-region-not-8x8");
requireText(game,"FRONTIER_TERRAIN","authored-8x8-terrain-composition-missing");
requireText(game,"Mapa Vivo · Explorar e Gerenciar","approved-map-mode-label-missing");
if(/const BASE_HEXES:\s*Hoc2Hex\[\]\s*=\s*\[/.test(game)) throw new Error("HOC2_VISUAL_CONTRACT_FAIL:flat-hardcoded-base-hex-fixture-returned");

const livingMap=read("client/web/src/hoc2/LivingMap.tsx");
requireText(livingMap,'data-world-source={hasComposedWorld?"MAP_FOREST_FRONTIER_8X8_01":"fallback"}',"world-source-marker-missing");
requireText(livingMap,'data-world-renderer={hasComposedWorld?"PACK99_COMPOSED_TILES":"fallback"}',"composed-world-renderer-missing");
requireText(livingMap,'data-projection="axial-isometric-diamond"',"visual-projection-not-isometric-diamond");
requireText(livingMap,'className="hoc2-authored-world" data-world-grid="hidden"',"grid-hidden-world-layer-missing");
requireText(livingMap,"terrainAsset(hex,assets)","terrain-piece-composition-missing");
requireText(livingMap,"depthGeometry.map","world-depth-order-missing");
requireText(livingMap,"x: size * 1.5 * (q + r)","axial-isometric-x-projection-missing");
requireText(livingMap,"y: size * (SQRT3 / 2) * (r - q)","axial-isometric-y-projection-missing");
if(livingMap.includes("assets.worldPreview")) throw new Error("HOC2_VISUAL_CONTRACT_FAIL:flattened-preview-renderer-returned");

const camera=read("client/web/src/hoc2/MapCamera.tsx");
requireText(camera,"const MIN_ZOOM = 0.82;","unsafe-min-zoom");
requireText(camera,"const MAX_ZOOM = 1.45;","unsafe-max-zoom");
requireMatch(camera,/edgeRef\.current = \{ x: 0, y: 0 \};\s*\n\s*endDrag\(event\)/,"edge-scroll-not-cleared-on-leave");
requireMatch(camera,/function clampCamera\(/,"camera-clamp-missing");

const recoveryCss=read("client/web/src/hoc2/p0-visual-recovery.css");
requireMatch(recoveryCss,/\.hoc2-camera-help\s*\{\s*display:none;/,"permanent-camera-debug-card-visible");
requireMatch(recoveryCss,/\.hoc2-authored-world/,"authored-world-style-missing");

const entry=read("client/web/src/hoc2-entry.tsx");
const remediationIndex=entry.indexOf('import "./hoc2/hoc2-remediation.css";');
const recoveryIndex=entry.indexOf('import "./hoc2/p0-visual-recovery.css";');
if(remediationIndex<0||recoveryIndex<0||recoveryIndex<remediationIndex) throw new Error("HOC2_VISUAL_CONTRACT_FAIL:recovery-css-not-last");

console.log("HOC2_VISUAL_CONTRACT=PASS map=MAP_FOREST_FRONTIER_8X8_01 strategic=8x8 renderer=PACK99_COMPOSED_TILES grid=hidden projection=isometric-diamond camera=bounded sources=portable");
