import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = (process.env.HEXA_VISUAL_QA_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const outputDir = new URL("../visual-qa-pack99/", import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runtimeContract(page) {
  return page.evaluate(async () => {
    const [installResponse, registryResponse, visualResponse] = await Promise.all([
      fetch("/assets/runtime/runtime-install.json", { cache: "no-store" }),
      fetch("/assets/runtime/registry/assets-runtime.json", { cache: "no-store" }),
      fetch("/assets/runtime/visual-gate-contract.json", { cache: "no-store" }),
    ]);
    if (!installResponse.ok || !registryResponse.ok || !visualResponse.ok) {
      throw new Error(`PACK99_RUNTIME_HTTP install=${installResponse.status} registry=${registryResponse.status} visual=${visualResponse.status}`);
    }
    const install = await installResponse.json();
    const registry = await registryResponse.json();
    const visual = await visualResponse.json();
    return {
      profile: install.profile,
      assetCount: install.assetCount,
      unresolvedReferences: install.unresolvedReferences,
      registryProfile: registry.profile,
      canonicalAssetCount: Array.isArray(registry.assets) ? registry.assets.length : 0,
      registryUnresolved: Array.isArray(registry.unresolved) ? registry.unresolved.length : -1,
      materializedFileCount: visual.materializedFileCount,
      aliasesValidated: visual.aliasesValidated,
    };
  });
}

async function launchCampaignMission(page, query) {
  await page.goto(`${baseUrl}/?${query}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3500);

  const briefingButton = page.locator(".campaign-selected-panel .fantasy-button.primary");
  await briefingButton.waitFor({ state: "visible", timeout: 30000 });
  await briefingButton.click();
  await page.locator("main.campaign-briefing-screen").waitFor({ state: "visible", timeout: 30000 });

  const missionStart = page.locator(".briefing-start");
  await missionStart.waitFor({ state: "visible", timeout: 30000 });
  assert(await missionStart.isEnabled(), "PACK99_BATTLE_START_DISABLED");
  await missionStart.click();

  await page.locator("main.strategic-slice").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(() => {
    const slice = document.querySelector("main.strategic-slice");
    const board = document.querySelector(".strategic-board");
    const nodes = document.querySelectorAll(".strategic-node");
    const units = document.querySelectorAll(".strategic-roster-card");
    return Boolean(slice && board && nodes.length >= 9 && units.length >= 4);
  }, { timeout: 30000 });
}

async function runPlaythroughGate(page) {
  await page.locator("main.strategic-slice").waitFor({ state: "visible", timeout: 30000 });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("hoc:playtest-start"));
  });

  await page.waitForFunction(() => {
    const root = document.querySelector("main.strategic-slice");
    return root?.dataset.playtestRunner === "running" || root?.dataset.playtestRunner === "complete";
  }, { timeout: 30000 });

  await page.waitForFunction(() => {
    const root = document.querySelector("main.strategic-slice");
    return root?.dataset.playtestRunner === "complete" && root?.dataset.missionPlaythrough === "complete";
  }, { timeout: 60000, polling: 200 });

  const result = await page.evaluate(() => {
    const root = document.querySelector("main.strategic-slice");
    if (!root) return null;
    return {
      runner: root.dataset.playtestRunner || null,
      terminal: root.dataset.playtestRunnerTerminal || null,
      runnerState: root.dataset.playtestRunnerState || null,
      runnerStep: Number(root.dataset.playtestRunnerStep || "0"),
      missionPlaythrough: root.dataset.missionPlaythrough || null,
      missionPath: root.dataset.missionPlaythroughPath || null,
      lifecycle: root.dataset.missionLifecycleState || null,
    };
  });

  assert(result, "PACK99_PLAYTHROUGH_ROOT_MISSING");
  assert(result.runner === "complete", `PACK99_PLAYTHROUGH_RUNNER=${result.runner}`);
  assert(result.missionPlaythrough === "complete", `PACK99_PLAYTHROUGH_TRACE=${result.missionPlaythrough}`);
  assert(["victory", "defeat", "resolved"].includes(result.terminal), `PACK99_PLAYTHROUGH_TERMINAL=${result.terminal}`);
  assert(result.missionPath?.includes("player"), `PACK99_PLAYTHROUGH_PLAYER_PATH=${result.missionPath}`);
  assert(result.missionPath?.includes("enemy"), `PACK99_PLAYTHROUGH_ENEMY_PATH=${result.missionPath}`);

  await page.screenshot({ path: new URL("battle-playthrough-final-pack99-1366x768.png", outputDir).pathname, fullPage: false });
  return result;
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
    assert(runtime.registryProfile === "full", `PACK99_VISUAL_REGISTRY_PROFILE=${runtime.registryProfile}`);
    assert(runtime.canonicalAssetCount === 1037, `PACK99_VISUAL_REGISTRY_CANONICAL=${runtime.canonicalAssetCount}`);
    assert(runtime.registryUnresolved === 0, `PACK99_VISUAL_REGISTRY_UNRESOLVED=${runtime.registryUnresolved}`);
    assert(runtime.materializedFileCount >= 1850, `PACK99_VISUAL_MATERIALIZED=${runtime.materializedFileCount}`);
    assert(runtime.aliasesValidated === 4, `PACK99_VISUAL_ALIASES=${runtime.aliasesValidated}`);

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

    await page.screenshot({ path: new URL("home-pack99-1366x768.png", outputDir).pathname, fullPage: true });

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForFunction(() => {
      const kael = document.querySelector(".campaign-hero-art .hero-kael");
      const lyra = document.querySelector(".campaign-hero-art .hero-lyra");
      return kael?.dataset.pack99HeroArt === "kael" && lyra?.dataset.pack99HeroArt === "lyra";
    }, { timeout: 30000 });
    await page.waitForTimeout(350);

    const visibleTechnicalBadges = await page.evaluate(() => {
      const pattern = /BUILD\s+.+PACK\s*99\s+\d+\s*\/\s*1037/i;
      return Array.from(document.querySelectorAll("body *"))
        .filter((node) => {
          const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
          if (!pattern.test(text)) return false;
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
        })
        .map((node) => ({
          tag: node.tagName,
          className: node.className || "",
          text: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
        }));
    });
    assert(visibleTechnicalBadges.length === 0, `PACK99_PLAYER_TECH_BADGE_VISIBLE=${JSON.stringify(visibleTechnicalBadges)}`);
    await page.screenshot({ path: new URL("home-player-facing-pack99-1366x768.png", outputDir).pathname, fullPage: true });

    await launchCampaignMission(page, "qa=1&stable=1&screen=campaign");
    await page.waitForFunction(() => {
      const runtimeImages = Array.from(document.querySelectorAll("main.strategic-slice img"));
      return runtimeImages.some((image) => image.getAttribute("src")?.includes("/assets/runtime/"));
    }, { timeout: 30000 });
    await page.waitForTimeout(900);

    const battleSurface = await page.evaluate(() => {
      const slice = document.querySelector("main.strategic-slice");
      const board = document.querySelector(".strategic-board");
      const runtimeImages = Array.from(document.querySelectorAll("main.strategic-slice img"))
        .map((image) => image.getAttribute("src") ?? "")
        .filter((src) => src.includes("/assets/runtime/"));
      const rect = (node) => {
        if (!node) return null;
        const bounds = node.getBoundingClientRect();
        return { width: Math.round(bounds.width), height: Math.round(bounds.height) };
      };
      return {
        slice: rect(slice),
        board: rect(board),
        nodes: document.querySelectorAll(".strategic-node").length,
        units: document.querySelectorAll(".strategic-roster-card").length,
        runtimeImages: runtimeImages.length,
      };
    });

    assert(battleSurface.slice, "PACK99_BATTLE_SLICE_MISSING");
    assert(battleSurface.board, "PACK99_BATTLE_BOARD_MISSING");
    assert(battleSurface.nodes >= 9, `PACK99_BATTLE_NODES=${battleSurface.nodes}`);
    assert(battleSurface.units >= 4, `PACK99_BATTLE_UNITS=${battleSurface.units}`);
    assert(battleSurface.runtimeImages > 0, `PACK99_BATTLE_RUNTIME_IMAGES=${battleSurface.runtimeImages}`);
    await page.screenshot({ path: new URL("battle-player-facing-pack99-1366x768.png", outputDir).pathname, fullPage: false });

    const playthrough = await runPlaythroughGate(page);
    assert(runtimeFailures.length === 0, `PACK99_RUNTIME_HTTP_FAILURES=${runtimeFailures.join(" | ")}`);

    const manifest = [
      "Hexa Octarina Conquer — PACK 99 Visual Runtime Gate",
      `runtime profile: ${runtime.profile}`,
      `canonical assets: ${runtime.canonicalAssetCount}`,
      `materialized files: ${runtime.materializedFileCount}`,
      `unresolved references: ${runtime.unresolvedReferences}`,
      `hero Kael: ${heroArt.kael.marker}`,
      `hero Lyra: ${heroArt.lyra.marker}`,
      "player-facing technical badge: hidden",
      `battle strategic nodes: ${battleSurface.nodes}`,
      `battle roster units: ${battleSurface.units}`,
      `battle runtime images: ${battleSurface.runtimeImages}`,
      `battle slice: ${battleSurface.slice.width}x${battleSurface.slice.height}`,
      `battle board: ${battleSurface.board.width}x${battleSurface.board.height}`,
      `playthrough runner: ${playthrough.runner}`,
      `playthrough terminal: ${playthrough.terminal}`,
      `playthrough steps: ${playthrough.runnerStep}`,
      `playthrough path: ${playthrough.missionPath}`,
      "Tehkné Solutions",
      "",
    ].join("\n");
    await writeFile(new URL("manifest.txt", outputDir), manifest, "utf8");

    console.log(`PACK99_VISUAL_GATE=PASS canonical=${runtime.canonicalAssetCount} materialized=${runtime.materializedFileCount} battleNodes=${battleSurface.nodes} battleRuntimeImages=${battleSurface.runtimeImages} playthrough=${playthrough.terminal} steps=${playthrough.runnerStep}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`PACK99_VISUAL_GATE=FAIL ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});
