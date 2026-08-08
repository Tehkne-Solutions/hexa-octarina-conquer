import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const productionUrl = (process.env.HEXA_PRODUCTION_URL || "https://hexa-octarina-conquer.onrender.com").replace(/\/$/, "");
const attempts = Number(process.env.HEXA_PRODUCTION_ATTEMPTS || 24);
const delayMs = Number(process.env.HEXA_PRODUCTION_DELAY_MS || 15000);
const outputDir = path.resolve(process.env.HOC2_PRODUCTION_CAPTURE_DIR || "artifacts/hoc2-production-gate");

const REQUIRED_MISSION_FILES = [
  "/assets/runtime/packages/PACK_07_HERO_ROSTER/guardian/directions/HERO_GUARDIAN_01_IDLE_BASE_SW_01.png",
  "/assets/runtime/packages/PACK_07_HERO_ROSTER/ranger/directions/HERO_RANGER_01_IDLE_BASE_NE_01.png",
  "/assets/runtime/packages/PACK_08_BASIC_UNITS/recruit/directions/UNIT_RECRUIT_01_IDLE_BASE_NW_01.png",
  "/assets/runtime/packages/PACK_09_CHAMPIONS_ADVANCED/berserker/directions/CHAMP_BERSERKER_01_IDLE_BASE_NW_01.png",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(resourcePath) {
  const response = await fetch(`${productionUrl}${resourcePath}`, { redirect: "follow" });
  if (!response.ok) throw new Error(`${resourcePath} returned HTTP ${response.status}`);
  return response.json();
}

async function verifyRuntimeFiles() {
  const [install, manifest, registry] = await Promise.all([
    fetchJson("/assets/runtime/runtime-install.json"),
    fetchJson("/assets/runtime/pack-manifest.json"),
    fetchJson("/assets/runtime/registry/assets-runtime.json"),
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

  for (const resourcePath of REQUIRED_MISSION_FILES) {
    const response = await fetch(`${productionUrl}${resourcePath}`, { redirect: "follow" });
    if (!response.ok) throw new Error(`required mission asset ${resourcePath} returned HTTP ${response.status}`);
  }

  return { canonical: assets.length, materialized: assets.length, version: manifest.version };
}

async function waitForAuthoredWorldAssets(page) {
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => undefined);

  const tileHrefs = await page.locator(".hoc2-authored-world .hoc2-world-tile").evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute("href") || node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
      .filter(Boolean),
  );
  if (tileHrefs.length !== 64) {
    throw new Error(`authored world tile hrefs incomplete: ${tileHrefs.length}/64`);
  }

  const worldHrefs = await page.locator(".hoc2-authored-world image").evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute("href") || node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
      .filter(Boolean),
  );
  const uniqueHrefs = [...new Set(worldHrefs)];
  if (uniqueHrefs.length === 0) throw new Error("authored world image hrefs missing");

  const decoded = await page.evaluate(async (sources) => {
    const load = (source) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ source, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error(`WORLD_IMAGE_LOAD_FAILED:${source}`));
      image.src = source;
    });
    return Promise.all(sources.map(load));
  }, uniqueHrefs);

  const broken = decoded.filter((image) => image.width <= 0 || image.height <= 0);
  if (broken.length > 0) {
    throw new Error(`authored world image decode failed: ${broken.map((image) => image.source).join(",")}`);
  }

  // SVG <image> elements are not represented by document.images. Force the same
  // resources through HTML Image decoding above, then allow two paint frames so the
  // authored SVG world is actually rasterized before evidence is captured.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(250);

  return { tileHrefCount: tileHrefs.length, sourceCount: uniqueHrefs.length };
}

async function captureBlockedEvidence(page, error) {
  const reason = error instanceof Error ? error.message : String(error);
  const metadata = {
    capturedAt: new Date().toISOString(),
    productionUrl,
    pageUrl: page.url(),
    title: await page.title().catch(() => "unknown"),
    reason,
  };

  await mkdir(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, "00-render-blocked.png"), fullPage: false }).catch(() => undefined);
  await writeFile(
    path.join(outputDir, "00-render-blocked.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
}

async function verifyRenderedHoc2() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const failedAssets = [];
    page.on("response", (response) => {
      if (response.status() >= 400 && response.url().includes("/assets/runtime/")) {
        failedAssets.push(`${response.status()} ${response.url()}`);
      }
    });

    // Detect an old Render deployment immediately instead of waiting for HOC2 selectors
    // that cannot exist in the legacy shell. Once the HOC2 identity is live, continue
    // with the full visual/world contract below.
    await page.goto(productionUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    const title = await page.title();
    if (!title.includes("HOC — Hexa Octarina Conquer · Fronteira Verde")) {
      throw new Error(`production identity invalid: ${title}`);
    }
    if (title.includes("Sandbox")) throw new Error("legacy sandbox identity leaked into production title");

    await page.getByText("Mapa Vivo · Explorar e Gerenciar").waitFor({ timeout: 15000 });
    if ((await page.getByText("Living Map Sandbox").count()) > 0) {
      throw new Error("legacy sandbox identity leaked into production UI");
    }

    const world = page.locator('.hoc2-living-map[data-world-source="MAP_FOREST_FRONTIER_8X8_01"][data-world-renderer="PACK99_COMPOSED_TILES"]');
    await world.waitFor({ state: "visible", timeout: 15000 });
    const authoredWorld = page.locator('.hoc2-authored-world[data-world-grid="hidden"]');
    await authoredWorld.waitFor({ state: "visible", timeout: 15000 });

    const cellCount = await page.locator(".hoc2-authored-world .hoc2-world-cell").count();
    const tileCount = await page.locator(".hoc2-authored-world .hoc2-world-tile").count();
    if (cellCount !== 64 || tileCount !== 64) {
      throw new Error(`composed world incomplete: cells=${cellCount} tiles=${tileCount}`);
    }

    const worldAssets = await waitForAuthoredWorldAssets(page);

    const worldBox = await world.boundingBox();
    if (!worldBox || worldBox.width < 700 || worldBox.height < 450) {
      throw new Error(`living map too small or missing: ${JSON.stringify(worldBox)}`);
    }

    const camera = page.locator(".hoc2-map-camera");
    const mapViewBoxBefore = await world.getAttribute("viewBox");
    const cameraStyleBefore = await camera.getAttribute("style");
    const livingGridCount = await page.locator(".hoc2-hexa-layer .hoc2-grid-outline").count();
    if (livingGridCount !== 0) throw new Error(`Living Map analytical grid leaked: ${livingGridCount}`);

    const cameraHelp = page.locator(".hoc2-camera-help");
    if ((await cameraHelp.count()) > 0) {
      const cameraHelpDisplay = await cameraHelp.evaluate((element) => getComputedStyle(element).display);
      if (cameraHelpDisplay !== "none") throw new Error(`camera debug card visible: ${cameraHelpDisplay}`);
    }

    await page.screenshot({ path: path.join(outputDir, "01-render-living-map.png"), fullPage: false });

    await page.getByRole("button", { name: "Modo Hexa" }).click();
    await page.getByText("DOMÍNIO · Aliança, Rubra e território neutro").waitFor({ timeout: 10000 });

    const sameWorld = page.locator('.hoc2-living-map[data-world-source="MAP_FOREST_FRONTIER_8X8_01"][data-world-renderer="PACK99_COMPOSED_TILES"]');
    const mapViewBoxAfter = await sameWorld.getAttribute("viewBox");
    const cameraStyleAfter = await camera.getAttribute("style");
    const hexaGridCount = await page.locator(".hoc2-hexa-layer .hoc2-grid-outline").count();
    if (hexaGridCount !== 64) throw new Error(`Hexa grid incomplete: ${hexaGridCount}`);
    if (mapViewBoxBefore !== mapViewBoxAfter || cameraStyleBefore !== cameraStyleAfter) {
      throw new Error(`Living Map/Hexa world-camera continuity broken: viewBox=${mapViewBoxBefore}->${mapViewBoxAfter} camera=${cameraStyleBefore}->${cameraStyleAfter}`);
    }

    await page.screenshot({ path: path.join(outputDir, "02-render-hexa-domain.png"), fullPage: false });

    if (failedAssets.length) throw new Error(`runtime asset HTTP failures:\n${failedAssets.join("\n")}`);

    return {
      title,
      cellCount,
      tileCount,
      hexaGridCount,
      worldWidth: Math.round(worldBox.width),
      worldHeight: Math.round(worldBox.height),
      sameCamera: true,
      worldAssetsReady: true,
      worldAssetSources: worldAssets.sourceCount,
    };
  } catch (error) {
    if (page) await captureBlockedEvidence(page, error).catch(() => undefined);
    throw error;
  } finally {
    await browser.close();
  }
}

// Keep the final production acceptance explicitly fail-closed. This named contract is
// consumed by the historical VS74 release gate and now covers the promoted HOC2 surface.
function productionBlocked(runtime, rendered) {
  return runtime.canonical !== 1037
    || runtime.materialized !== 1037
    || rendered.cellCount !== 64
    || rendered.tileCount !== 64
    || rendered.hexaGridCount !== 64
    || rendered.sameCamera !== true
    || rendered.worldAssetsReady !== true
    || rendered.worldWidth < 700
    || rendered.worldHeight < 450
    || !rendered.title.includes("HOC — Hexa Octarina Conquer · Fronteira Verde");
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    console.log(`PRODUCTION_GATE_ATTEMPT=${attempt}/${attempts} url=${productionUrl}`);
    const runtime = await verifyRuntimeFiles();
    const rendered = await verifyRenderedHoc2();
    if (productionBlocked(runtime, rendered)) {
      throw new Error(`production blocked after verification: runtime=${JSON.stringify(runtime)} rendered=${JSON.stringify(rendered)}`);
    }
    console.log(`PRODUCTION_GATE=PASS canonical=${runtime.canonical} materialized=${runtime.materialized} pack=${runtime.version} world=MAP_FOREST_FRONTIER_8X8_01 renderer=PACK99_COMPOSED_TILES cells=${rendered.cellCount} hexa=${rendered.hexaGridCount} camera=shared assets=ready sources=${rendered.worldAssetSources} identity=HOC`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`PRODUCTION_GATE_ATTEMPT_FAILED=${attempt}:`, error instanceof Error ? error.message : error);
    if (attempt < attempts) await sleep(delayMs);
  }
}

console.error("PRODUCTION_GATE=FAIL", lastError);
process.exit(1);
