import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const webRoot=path.resolve(here,"..");
const repoRoot=path.resolve(webRoot,"../..");

function read(relative){return fs.readFileSync(path.resolve(repoRoot,relative),"utf8")}
function requireMatch(value, pattern, marker){if(!pattern.test(value)) throw new Error(`HOC2_VISUAL_CONTRACT_FAIL:${marker}`)}

const contract=JSON.parse(read("docs/hoc2/HOC2_VISUAL_CONTRACT_v1.json"));
if(contract.status!=="P0_BLOCKING") throw new Error("HOC2_VISUAL_CONTRACT_FAIL:contract-not-blocking");
if(contract.worldArchitecture?.vs01VisualMap!=="MAP_FOREST_FRONTIER_8X8_01") throw new Error("HOC2_VISUAL_CONTRACT_FAIL:wrong-world-source");

const catalog=read("client/web/src/pack99-strategic-catalog.ts");
requireMatch(catalog,/worldPreview:\s*\{\s*id:\s*"previews_MAP_FOREST_FRONTIER_8X8_01_png"/,"authored-world-preview-missing");

const game=read("client/web/src/hoc2/Hoc2Game.tsx");
requireMatch(game,/for \(let r=0;r<8;r\+=1\)/,"strategic-region-not-8x8");
requireMatch(game,/for \(let q=0;q<8;q\+=1\)/,"strategic-region-not-8x8");
requireMatch(game,/Mapa Vivo · Explorar e Gerenciar/,"approved-map-mode-label-missing");
if(/const BASE_HEXES:\s*Hoc2Hex\[\]\s*=\s*\[/.test(game)) throw new Error("HOC2_VISUAL_CONTRACT_FAIL:flat-hardcoded-base-hex-fixture-returned");

const livingMap=read("client/web/src/hoc2/LivingMap.tsx");
requireMatch(livingMap,/data-world-source=\{hasAuthoredWorld\?"MAP_FOREST_FRONTIER_8X8_01":"fallback"\}/,"world-source-marker-missing");
requireMatch(livingMap,/className="hoc2-authored-world"/,"authored-world-layer-missing");
requireMatch(livingMap,/!hasAuthoredWorld\?<></,"technical-world-not-fallback-only");

const camera=read("client/web/src/hoc2/MapCamera.tsx");
requireMatch(camera,/const MIN_ZOOM = 0\.82;/,"unsafe-min-zoom");
requireMatch(camera,/const MAX_ZOOM = 1\.45;/,"unsafe-max-zoom");
requireMatch(camera,/edgeRef\.current = \{ x: 0, y: 0 \};\s*\n\s*endDrag\(event\)/,"edge-scroll-not-cleared-on-leave");
requireMatch(camera,/function clampCamera\(/,"camera-clamp-missing");

const recoveryCss=read("client/web/src/hoc2/p0-visual-recovery.css");
requireMatch(recoveryCss,/\.hoc2-camera-help\s*\{\s*display:none;/,"permanent-camera-debug-card-visible");
requireMatch(recoveryCss,/\.hoc2-authored-world/,"authored-world-style-missing");

console.log("HOC2_VISUAL_CONTRACT=PASS map=MAP_FOREST_FRONTIER_8X8_01 strategic=8x8 camera=bounded authoredWorld=required");
