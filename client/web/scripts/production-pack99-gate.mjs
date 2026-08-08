import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const productionUrl = (process.env.HEXA_PRODUCTION_URL || "https://hexa-octarina-conquer.onrender.com").replace(/\/$/, "");
const expectedSha = String(process.env.HEXA_EXPECTED_SHA || "").trim();
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
  const separator = resourcePath.includes("?") ? "&" : "?";
  const response = await fetch(`${productionUrl}${resourcePath}${separator}gate=${Date.now()}`, {
    redirect: "follow",
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`${resourcePath} returned HTTP ${response.status}`);
  return response.json();
}

function shaMatches(expected, actual) {
  if (!expected) return true;
  if (!actual || actual === "unknown") return false;
  if (expected.length < 7 || actual.length < 7) return false;
  return expected === actual || expected.startsWith(actual) || actual.startsWith(expected);
}

async function verifyDeploymentFreshness() {
  const release = await fetchJson("/release");
  const deployedSha = String(release.sha || "").trim();
  if (!shaMatches(expectedSha, deployedSha)) {
    throw new Error(`production commit stale: expected=${expectedSha || "not-set"} deployed=${deployedSha || "missing"}`);
  }
  if (expectedSha && (!release.ok || deployedSha === "unknown")) {
    throw new Error(`production release identity invalid: ${JSON.stringify(release)}`);
  }
  return { sha: deployedSha || "unknown", version: String(release.version || "unknown") };
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
    const response = await fetch(`${productionUrl}${resourcePath}?gate=${Date.now()}`, {
      redirect: "follow",
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
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
  const uniqueTileHrefs = [...new Set(tileHrefs)];
  if (uniqueTileHrefs.length !== 9) {
    throw new Error(`authored terrain variants stale or incomplete: ${uniqueTileHrefs.length}/9`);
  }

  const worldHrefs = await page.locator(".hoc2-authored-world image").evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute("href") || node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
      .filter(Boolean),
  );
  const uniqueHrefs = [...new Set(worldHrefs)];
  if (uniqueHrefs.length === 0) throw new Error("authored world image hrefs missing");

  const decoded = await page.evaluate(async ({ sources, timeoutMs }) => {
    const load = (source) => new Promise((resolve, reject) => {
      const image = new Image();
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        callback(value);
      };
      const timer = setTimeout(
        () => finish(reject, new Error(`WORLD_IMAGE_TIMEOUT:${source}:${timeoutMs}ms`)),
        timeoutMs,
      );

      image.onerror = () => finish(reject, new Error(`WORLD_IMAGE_LOAD_FAILED:${source}`));
      image.onload = async () => {
        try {
          await image.decode();
          finish(resolve, { source, width: image.naturalWidth, height: image.naturalHeight });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          finish(reject, new Error(`WORLD_IMAGE_DECODE_FAILED:${source}:${detail}`));
        }
      };
      image.src = source;
    });
    return Promise.all(sources.map(load));
  }, { sources: uniqueHrefs, timeoutMs: 10000 });

  const broken = decoded.filter((image) => image.width <= 0 || image.height <= 0);
  if (broken.length > 0) {
    throw new Error(`authored world image decode failed: ${broken.map((image) => image.source).join(",")}`);
  }

  // SVG <image> elements are not represented by document.images. Force the same
  // resources through HTML Image decoding above, then allow two paint frames so the
  // authored SVG world is actually rasterized before evidence is captured.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(250);

  return {
    tileHrefCount: tileHrefs.length,
    tileVariantCount: uniqueTileHrefs.length,
    sourceCount: uniqueHrefs.length,
  };
}

async function captureBlockedEvidence(page, error) {
  const reason = error instanceof Error ? error.message : String(error);
  const metadata = {
    capturedAt: new Date().toISOString(),
    productionUrl,
    expectedSha: expectedSha || null,
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

    // Cache-bust the player shell so a stale CDN/browser response cannot masquerade
    // as the current Render deployment after the release SHA has changed.
    const gateUrl = `${productionUrl}/?gate=${encodeURIComponent(expectedSha || String(Date.now()))}`;
    await page.goto(gateUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
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
    const routeCount = await page.locator(".hoc2-world-road-layer .hoc2-road").count();
    const ambientCount = await page.locator(".hoc2-world-ambient-layer .hoc2-world-ambient").count();
    if (routeCount !== 2) throw new Error(`continuous world routes stale or incomplete: ${routeCount}/2`);
    if (ambientCount !== 5) throw new Error(`distributed world ambience stale or incomplete: ${ambientCount}/5`);

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
    const domainCoordinateCount = await page.locator(".hoc2-hexa-layer.hoc2-hexa-domain .hoc2-coordinate").count();
    if (hexaGridCount !== 64) throw new Error(`Hexa grid incomplete: ${hexaGridCount}`);
    if (domainCoordinateCount !== 0) throw new Error(`Hexa Domain coordinate noise leaked: ${domainCoordinateCount}`);
    if (mapViewBoxBefore !== mapViewBoxAfter || cameraStyleBefore !== cameraStyleAfter) {
      throw new Error(`Living Map/Hexa world-camera continuity broken: viewBox=${mapViewBoxBefore}->${mapViewBoxAfter} camera=${cameraStyleBefore}->${cameraStyleAfter}`);
    }

    await page.screenshot({ path: path.join(outputDir, "02-render-hexa-domain.png"), fullPage: false });

    if (failedAssets.length) throw new Error(`runtime asset HTTP failures:\n${failedAssets.join("\n")}`);

    return {
      title,
      cellCount,
      tileCount,
      tileVariantCount: worldAssets.tileVariantCount,
      routeCount,
      ambientCount,
      domainCoordinateCount,
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
function productionBlocked(runtime, rendered, deployment) {
  return runtime.canonical !== 1037
    || runtime.materialized !== 1037
    || (expectedSha && !shaMatches(expectedSha, deployment.sha))
    || rendered.cellCount !== 64
    || rendered.tileCount !== 64
    || rendered.tileVariantCount !== 9
    || rendered.routeCount !== 2
    || rendered.ambientCount !== 5
    || rendered.domainCoordinateCount !== 0
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
    console.log(`PRODUCTION_GATE_ATTEMPT=${attempt}/${attempts} url=${productionUrl} expected=${expectedSha || "not-set"}`);
    const deployment = await verifyDeploymentFreshness();
    const runtime = await verifyRuntimeFiles();
    const rendered = await verifyRenderedHoc2();
    if (productionBlocked(runtime, rendered, deployment)) {
      throw new Error(`production blocked after verification: deployment=${JSON.stringify(deployment)} runtime=${JSON.stringify(runtime)} rendered=${JSON.stringify(rendered)}`);
    }
    console.log(`PRODUCTION_GATE=PASS commit=${deployment.sha} canonical=${runtime.canonical} materialized=${runtime.materialized} pack=${runtime.version} world=MAP_FOREST_FRONTIER_8X8_01 renderer=PACK99_COMPOSED_TILES cells=${rendered.cellCount} variants=${rendered.tileVariantCount} routes=${rendered.routeCount} ambient=${rendered.ambientCount} hexa=${rendered.hexaGridCount} domainCoords=${rendered.domainCoordinateCount} camera=shared assets=ready sources=${rendered.worldAssetSources} identity=HOC`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`PRODUCTION_GATE_ATTEMPT_FAILED=${attempt}:`, error instanceof Error ? error.message : error);
    if (attempt < attempts) await sleep(delayMs);
  }
}

console.error("PRODUCTION_GATE=FAIL", lastError);
process.exit(1);
