import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.HOC2_CAPTURE_URL || "http://127.0.0.1:4173/hoc2.html";
const outputDir = path.resolve("artifacts/hoc2-asset-atlas");
await mkdir(outputDir, { recursive: true });

const requested = [
  ["Grass", "TILE_GRASS_FLAT_CENTER_A_01"],
  ["Forest", "TILE_FOREST_FLAT_CENTER_A_01"],
  ["Water", "TILE_WATER_FLAT_CENTER_A_01"],
  ["Rocks", "PROP_ROCK_C_01"],
  ["Bridge", "PROP_STONE_BRIDGE_BUILT_NW_SE_01"],
  ["Outpost", "TERR_OUTPOST_NEUTRAL_01"],
  ["Camp", "TERR_CAMP_NEUTRAL_01"],
  ["Octarina", "RES_OCTARINE_CRYSTAL_ABUNDANT_01"],
  ["Kael", "HERO_GUARDIAN_01_IDLE_BASE_SW_01"],
  ["Brakk alias", "CHAMP_BERSERKER_01_IDLE_BASE_NW_01"],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const rows = await page.evaluate(async (items) => {
    const [registryResponse, aliasResponse] = await Promise.all([
      fetch("/assets/runtime/registry/assets-runtime.json", { cache: "no-cache" }),
      fetch("/assets/runtime/registry/canonical-runtime-aliases.json", { cache: "no-cache" }),
    ]);
    if (!registryResponse.ok) throw new Error("ASSET_ATLAS_REGISTRY_MISSING");
    const registry = await registryResponse.json();
    const aliases = aliasResponse.ok ? (await aliasResponse.json()).aliases ?? {} : {};
    const normalize=(value)=>String(value??"").replaceAll("\\","/").split("/").at(-1).replace(/\.[^.]+$/,"").toUpperCase();
    const index=new Map();
    for(const asset of registry.assets??[]){
      for(const key of [asset.id,asset.canonicalId,asset.file,asset._runtimeFile]){
        if(!key) continue;
        index.set(String(key),asset);
        index.set(String(key).toUpperCase(),asset);
        index.set(normalize(key),asset);
      }
    }
    return items.map(([label,id])=>{
      const asset=index.get(id)??index.get(id.toUpperCase())??index.get(normalize(id));
      const runtime=asset?._runtimeFile ?? aliases[id] ?? aliases[id.toUpperCase()] ?? aliases[normalize(id)] ?? null;
      return {label,id,url:runtime?`/assets/runtime/${runtime}`:null,category:asset?.category??"alias"};
    });
  }, requested);

  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;background:#12130f;color:#f0e7cf;font-family:Georgia,serif;padding:24px}
    h1{margin:0 0 18px;font-size:26px;color:#d9bc73}p{margin:0 0 22px;color:#aaa28e;font:14px system-ui}
    .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
    .card{min-height:310px;background:#20231b;border:1px solid #796b49;border-radius:10px;padding:12px;display:grid;grid-template-rows:auto 1fr auto;gap:8px}
    .card strong{font-size:15px;color:#e3c67d}.asset{display:grid;place-items:center;min-height:220px;background:repeating-conic-gradient(#272b22 0 25%,#1d201a 0 50%) 50%/24px 24px;border-radius:6px;overflow:hidden}
    .asset img{max-width:100%;max-height:240px;object-fit:contain}.missing{font:700 13px system-ui;color:#d77}
    small{font:11px ui-monospace,monospace;color:#8f8a79;overflow-wrap:anywhere}
  </style></head><body><h1>HOC2 · PACK 99 Strategic Asset Atlas</h1><p>QA-only selection for Living Map reconstruction · Tehkné Solutions</p><div class="grid">
  ${rows.map(row=>`<section class="card"><strong>${row.label}</strong><div class="asset">${row.url?`<img src="${row.url}" alt="${row.id}">`:`<span class="missing">MISSING</span>`}</div><small>${row.id}<br>${row.url??"unresolved"}</small></section>`).join("")}
  </div></body></html>`, { waitUntil: "load" });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.waitForTimeout(300);
  const broken = await page.locator("img").evaluateAll((images) => images.filter((image) => image.naturalWidth === 0).map((image) => image.alt));
  if (broken.length) throw new Error(`ASSET_ATLAS_BROKEN:${broken.join(",")}`);
  await page.screenshot({ path: path.join(outputDir, "pack99-strategic-assets.png"), fullPage: true });
  console.log(`HOC2_PACK99_ASSET_ATLAS=PASS resolved=${rows.filter((row)=>row.url).length}/${rows.length}`);
} finally {
  await browser.close();
}
