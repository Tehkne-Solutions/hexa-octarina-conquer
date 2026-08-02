import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = (process.env.HEXA_VISUAL_QA_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const outputDir = new URL("../visual-qa-pack99/", import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runtimeContract(page) {
  return page.evaluate(async () => {
    const [installResponse, indexResponse] = await Promise.all([
      fetch("/assets/runtime/runtime-install.json", { cache: "no-store" }),
      fetch("/assets/runtime/pack99/runtime-index.json", { cache: "no-store" }),
    ]);
    if (!installResponse.ok || !indexResponse.ok) {
      throw new Error(`PACK99_RUNTIME_HTTP install=${installResponse.status} index=${indexResponse.status}`);
    }
    const install = await installResponse.json();
    const index = await indexResponse.json();
    return {
      profile: install.profile,
      assetCount: install.assetCount,
      unresolvedReferences: install.unresolvedReferences,
      runtimeMode: index.runtimeMode,
      canonicalAssetCount: index.canonicalAssetCount,
      materializedAssetCount: Array.isArray(index.assets) ? index.assets.length : 0,
      fallback: index.fallback,
    };
  });
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const runtimeFailures = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.on("response", (response) => {
      if (response.status() >= 400 && response.url().includes("/assets/runtime/")) {
        runtimeFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`${baseUrl}/?qa=1&stable=1&screen=home`, { waitUntil: "networkidle", timeout: 120000 });
    const runtime = await runtimeContract(page);
    assert(runtime.profile === "full", `PACK99_VISUAL_PROFILE=${runtime.profile}`);
    assert(runtime.assetCount === 1037, `PACK99_VISUAL_CANONICAL=${runtime.assetCount}`);
    assert(runtime.unresolvedReferences === 0, `PACK99_VISUAL_UNRESOLVED=${runtime.unresolvedReferences}`);
    assert(runtime.runtimeMode === "full", `PACK99_VISUAL_MODE=${runtime.runtimeMode}`);
    assert(runtime.canonicalAssetCount === 1037, `PACK99_VISUAL_INDEX_CANONICAL=${runtime.canonicalAssetCount}`);
    assert(runtime.materializedAssetCount >= 1850, `PACK99_VISUAL_MATERIALIZED=${runtime.materializedAssetCount}`);
    assert(runtime.fallback === null, `PACK99_VISUAL_FALLBACK=${JSON.stringify(runtime.fallback)}`);

    await page.waitForFunction(() => {
      const kael = document.querySelector(".campaign-hero-art .hero-kael");
      const lyra = document.querySelector(".campaign-hero-art .hero-lyra");
      return kael?.dataset.pack99HeroArt === "kael" && lyra?.dataset.pack99HeroArt === "lyra";
    }, { timeout: 30000 });

    const heroArt = await page.evaluate(() => {
      const read = (selector) => {
        const node = document.querySelector(selector);
        return node ? {
          marker: node.dataset.pack99HeroArt || null,
          backgroundImage: getComputedStyle(node).backgroundImage,
        } : null;
      };
      return {
        kael: read(".campaign-hero-art .hero-kael"),
        lyra: read(".campaign-hero-art .hero-lyra"),
      };
    });

    for (const [name, art] of Object.entries(heroArt)) {
      assert(art, `PACK99_HOME_HERO_MISSING=${name}`);
      assert(art.backgroundImage && art.backgroundImage !== "none", `PACK99_HOME_HERO_FALLBACK=${name}`);
      assert(art.backgroundImage.includes("/assets/runtime/"), `PACK99_HOME_HERO_NON_RUNTIME=${name}:${art.backgroundImage}`);
    }

    await page.screenshot({ path: new URL("home-pack99-1366x768.png", outputDir), fullPage: true });

    await page.goto(`${baseUrl}/?qa=1&stable=1&screen=campaign`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: new URL("campaign-pack99-1366x768.png", outputDir), fullPage: true });

    assert(runtimeFailures.length === 0, `PACK99_RUNTIME_HTTP_FAILURES=${runtimeFailures.join(" | ")}`);

    const manifest = [
      "Hexa Octarina Conquer — PACK 99 Visual Runtime Gate",
      `runtime profile: ${runtime.profile}`,
      `canonical assets: ${runtime.canonicalAssetCount}`,
      `materialized assets: ${runtime.materializedAssetCount}`,
      `unresolved references: ${runtime.unresolvedReferences}`,
      `hero Kael: ${heroArt.kael.marker}`,
      `hero Lyra: ${heroArt.lyra.marker}`,
      "Tehkné Solutions",
      "",
    ].join("\n");
    await writeFile(new URL("manifest.txt", outputDir), manifest, "utf8");

    console.log(`PACK99_VISUAL_GATE=PASS canonical=${runtime.canonicalAssetCount} materialized=${runtime.materializedAssetCount}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`PACK99_VISUAL_GATE=FAIL ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});
