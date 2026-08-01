import { chromium } from "playwright";

const productionUrl = (process.env.HEXA_PRODUCTION_URL || "https://hexa-octarina-conquer.onrender.com").replace(/\/$/, "");
const attempts = Number(process.env.HEXA_PRODUCTION_ATTEMPTS || 6);
const delayMs = Number(process.env.HEXA_PRODUCTION_DELAY_MS || 15000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(path) {
  const response = await fetch(`${productionUrl}${path}`, { redirect: "follow" });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

async function verifyRuntimeFiles() {
  const [install, manifest, registry, aliases] = await Promise.all([
    fetchJson("/assets/runtime/runtime-install.json"),
    fetchJson("/assets/runtime/pack-manifest.json"),
    fetchJson("/assets/runtime/registry/assets-runtime.json"),
    fetchJson("/assets/runtime/registry/canonical-runtime-aliases.json"),
  ]);

  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const unresolved = Array.isArray(registry.unresolved) ? registry.unresolved : [];

  if (install.packId !== "HOC_PACK_99_FINAL_RUNTIME" || install.profile !== "full" || install.assetCount !== 1037 || install.unresolvedReferences !== 0) {
    throw new Error(`invalid runtime-install: ${JSON.stringify(install)}`);
  }
  if (registry.packId !== install.packId || registry.profile !== "full" || registry.assetCount !== 1037 || assets.length !== 1037) {
    throw new Error(`invalid runtime registry: reported=${registry.assetCount} actual=${assets.length}`);
  }
  if (unresolved.length !== 0) throw new Error(`unresolved runtime references: ${unresolved.length}`);
  if (!manifest.version) throw new Error("pack-manifest version missing");

  const requiredAliases = [
    "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
    "HERO_RANGER_01_IDLE_BASE_NE_01",
    "UNIT_RECRUIT_01_IDLE_BASE_NW_01",
    "CHAMP_BERSERKER_01_IDLE_BASE_NW_01",
  ];
  for (const id of requiredAliases) {
    if (!aliases.aliases?.[id]) throw new Error(`canonical alias missing: ${id}`);
  }

  return { canonical: assets.length, materialized: assets.length };
}

async function verifyRenderedGame() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const failedAssets = [];
    page.on("response", (response) => {
      if (response.status() >= 400 && response.url().includes("/assets/runtime/")) {
        failedAssets.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(productionUrl, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector("#hexa-build-marker", { timeout: 30000 });
    await page.waitForFunction(() => document.documentElement.dataset.pack99Full !== undefined, null, { timeout: 30000 });

    const snapshot = await page.evaluate(() => ({
      full: document.documentElement.dataset.pack99Full,
      runtime: document.documentElement.dataset.pack99Runtime,
      canonical: document.documentElement.dataset.pack99CanonicalCount,
      materialized: document.documentElement.dataset.pack99AssetCount,
      fallbacks: document.documentElement.dataset.pack99Fallbacks,
      blocked: document.documentElement.dataset.productionBlocked,
      marker: document.getElementById("hexa-build-marker")?.textContent ?? "",
      unitFallbacks: document.querySelectorAll(".strategic-unit-fallback").length,
      unitImages: [...document.querySelectorAll(".strategic-unit-image")].map((image) => ({
        complete: image.complete,
        width: image.naturalWidth,
        src: image.currentSrc || image.src,
      })),
    }));

    if (snapshot.full !== "true" || snapshot.runtime !== "full" || snapshot.canonical !== "1037" || Number(snapshot.materialized) !== 1037 || snapshot.fallbacks !== "false") {
      throw new Error(`rendered runtime invalid: ${JSON.stringify(snapshot)}`);
    }
    if (snapshot.blocked === "true") throw new Error("production guard blocked the published build");
    if (!snapshot.marker.includes("PACK 99 1037/1037")) throw new Error(`build marker invalid: ${snapshot.marker}`);
    if (snapshot.unitFallbacks !== 0) throw new Error(`unit fallbacks visible: ${snapshot.unitFallbacks}`);
    if (snapshot.unitImages.length < 4 || snapshot.unitImages.some((image) => !image.complete || image.width <= 0)) {
      throw new Error(`canonical unit images invalid: ${JSON.stringify(snapshot.unitImages)}`);
    }
    if (failedAssets.length) throw new Error(`runtime asset HTTP failures:\n${failedAssets.join("\n")}`);

    return snapshot;
  } finally {
    await browser.close();
  }
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    console.log(`PRODUCTION_GATE_ATTEMPT=${attempt}/${attempts} url=${productionUrl}`);
    const runtime = await verifyRuntimeFiles();
    const rendered = await verifyRenderedGame();
    console.log(`PRODUCTION_GATE=PASS canonical=${runtime.canonical} materialized=${runtime.materialized} marker=${rendered.marker}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`PRODUCTION_GATE_ATTEMPT_FAILED=${attempt}:`, error instanceof Error ? error.message : error);
    if (attempt < attempts) await sleep(delayMs);
  }
}

console.error("PRODUCTION_GATE=FAIL", lastError);
process.exit(1);
