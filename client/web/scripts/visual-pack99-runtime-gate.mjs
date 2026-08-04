import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = (process.env.HEXA_VISUAL_QA_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const outputDir = new URL("../visual-qa-pack99/", import.meta.url);
const TERMINAL_STATES = new Set(["victory", "defeat", "resolved"]);
const MAX_PLAYTHROUGH_STEPS = 96;

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
  await page.waitForTimeout(2500);
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

async function battleSnapshot(page) {
  return page.evaluate(() => {
    const root = document.querySelector("main.strategic-slice");
    if (!root) return null;
    const normalized = (value) => (value || "").replace(/\s+/g, " ").trim();
    const result = root.querySelector(".strategic-result");
    const resultText = normalized(result?.textContent).toUpperCase();
    let lifecycle = root.dataset.missionLifecycleState || "unknown";

    if (result?.classList.contains("is-victory") || result?.dataset.result === "victory" || /VIT[ÓO]RIA|MISS[ÃA]O CONCLU[ÍI]DA/.test(resultText)) {
      lifecycle = "victory";
    } else if (result?.classList.contains("is-defeat") || result?.dataset.result === "defeat" || /DERROTA|MISS[ÃA]O FALHOU/.test(resultText)) {
      lifecycle = "defeat";
    } else if (result) {
      lifecycle = "resolved";
    } else if (normalized(root.textContent).toUpperCase().includes("SEU TURNO")) {
      lifecycle = "player";
    }

    const board = root.querySelector(".strategic-board");
    const resourcesText = normalized(root.querySelector(".strategic-resources")?.textContent);
    const actionsMatch = resourcesText.match(/✦\s*(\d+)\s*\/\s*(\d+)/);
    return {
      lifecycle,
      result: resultText || null,
      remainingActions: actionsMatch ? Number(actionsMatch[1]) : null,
      actionBudget: actionsMatch ? Number(actionsMatch[2]) : null,
      endTurnEnabled: Boolean(root.querySelector(".strategic-end-turn:not(:disabled)")),
      boardClass: board?.className || null,
      actionFx: board?.dataset.actionFx || null,
    };
  });
}

async function waitForBoardSettled(page) {
  await page.waitForFunction(() => {
    const board = document.querySelector("main.strategic-slice .strategic-board");
    if (!board) return false;
    return !board.classList.contains("is-enemy-sequence")
      && !board.classList.contains("is-action-sequence")
      && !board.classList.contains("is-impact-sequence")
      && !board.dataset.actionFx;
  }, { timeout: 12000, polling: 100 });
  await page.waitForTimeout(250);
}

async function atomicClick(page, selector) {
  await waitForBoardSettled(page);
  return page.evaluate((query) => {
    const candidates = Array.from(document.querySelectorAll(query));
    for (const element of candidates) {
      if (!(element instanceof HTMLElement)) continue;
      if (element.hasAttribute("disabled")) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const visible = style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0;
      if (!visible) continue;
      element.click();
      return true;
    }
    return false;
  }, selector);
}

async function endPlayerTurn(page, path) {
  const clicked = await atomicClick(page, "main.strategic-slice .strategic-end-turn:not(:disabled)");
  if (!clicked) return false;
  if (path.at(-1) !== "enemy") path.push("enemy");
  await page.waitForTimeout(350);
  return true;
}

async function runPlaythroughGate(page) {
  const path = [];
  let endTurns = 0;
  let lastSnapshot = null;

  for (let step = 1; step <= MAX_PLAYTHROUGH_STEPS; step += 1) {
    await waitForBoardSettled(page);
    const snapshot = await battleSnapshot(page);
    assert(snapshot, "PACK99_PLAYTHROUGH_ROOT_MISSING");
    lastSnapshot = snapshot;

    if (snapshot.lifecycle && path.at(-1) !== snapshot.lifecycle) path.push(snapshot.lifecycle);
    if (TERMINAL_STATES.has(snapshot.lifecycle)) {
      assert(path.includes("player"), `PACK99_PLAYTHROUGH_PLAYER_PATH=${path.join(">")}`);
      assert(endTurns > 0, `PACK99_PLAYTHROUGH_ENEMY_TURNS=${endTurns}`);
      await page.screenshot({ path: new URL("battle-playthrough-final-pack99-1366x768.png", outputDir).pathname, fullPage: false });
      return {
        runner: "playwright",
        terminal: snapshot.lifecycle,
        runnerStep: step,
        missionPath: [...path, "enemy-executed"].join(">"),
        endTurns,
      };
    }

    if (snapshot.remainingActions === 0 && snapshot.endTurnEnabled) {
      if (await endPlayerTurn(page, path)) {
        endTurns += 1;
        continue;
      }
    }

    if (await atomicClick(page, "main.strategic-slice .strategic-unit.is-attack-target:not(:disabled)")) continue;
    if (await atomicClick(page, "main.strategic-slice .strategic-edge.is-recommended:not(:disabled), main.strategic-slice .strategic-node.is-recommended:not(:disabled), main.strategic-slice .strategic-cell.is-build-target:not(:disabled)")) continue;
    if (await atomicClick(page, "main.strategic-slice .strategic-edge:not(:disabled), main.strategic-slice .strategic-node:not(:disabled), main.strategic-slice .strategic-cell:not(:disabled)")) continue;

    if (snapshot.endTurnEnabled && await endPlayerTurn(page, path)) {
      endTurns += 1;
      continue;
    }

    await page.waitForTimeout(200);
    const retrySnapshot = await battleSnapshot(page);
    if (retrySnapshot && retrySnapshot.lifecycle !== snapshot.lifecycle) continue;
    throw new Error(`PACK99_PLAYTHROUGH_STALLED step=${step} snapshot=${JSON.stringify(retrySnapshot || snapshot)} path=${path.join(">")}`);
  }

  throw new Error(`PACK99_PLAYTHROUGH_STEP_LIMIT=${MAX_PLAYTHROUGH_STEPS} snapshot=${JSON.stringify(lastSnapshot)} path=${path.join(">")}`);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const runtimeFailures = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.on("response", (response) => {
      if (response.status() >= 400 && response.url().includes("/assets/runtime/")) runtimeFailures.push(`${response.status()} ${response.url()}`);
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
        return node ? { marker: node.dataset.pack99HeroArt || null, backgroundImage: getComputedStyle(node).backgroundImage } : null;
      };
      return { kael: read(".campaign-hero-art .hero-kael"), lyra: read(".campaign-hero-art .hero-lyra") };
    });

    for (const [name, art] of Object.entries(heroArt)) {
      assert(art, `PACK99_HOME_HERO_MISSING=${name}`);
      assert(art.backgroundImage && art.backgroundImage !== "none", `PACK99_HOME_HERO_FALLBACK=${name}`);
      assert(art.backgroundImage.includes("/assets/runtime/"), `PACK99_HOME_HERO_NON_RUNTIME=${name}:${art.backgroundImage}`);
    }
    await page.screenshot({ path: new URL("home-pack99-1366x768.png", outputDir).pathname, fullPage: true });

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(350);
    const visibleTechnicalBadges = await page.evaluate(() => {
      const pattern = /BUILD\s+.+PACK\s*99\s+\d+\s*\/\s*1037/i;
      return Array.from(document.querySelectorAll("body *")).filter((node) => {
        const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (!pattern.test(text)) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
      }).length;
    });
    assert(visibleTechnicalBadges === 0, `PACK99_PLAYER_TECH_BADGE_VISIBLE=${visibleTechnicalBadges}`);
    await page.screenshot({ path: new URL("home-player-facing-pack99-1366x768.png", outputDir).pathname, fullPage: true });

    await launchCampaignMission(page, "qa=1&stable=1&screen=campaign");
    await page.waitForFunction(() => Array.from(document.querySelectorAll("main.strategic-slice img")).some((image) => image.getAttribute("src")?.includes("/assets/runtime/")), { timeout: 30000 });
    await page.waitForTimeout(700);

    const battleSurface = await page.evaluate(() => {
      const slice = document.querySelector("main.strategic-slice");
      const board = document.querySelector(".strategic-board");
      const runtimeImages = Array.from(document.querySelectorAll("main.strategic-slice img")).map((image) => image.getAttribute("src") ?? "").filter((src) => src.includes("/assets/runtime/"));
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
      `playthrough enemy turns: ${playthrough.endTurns}`,
      `playthrough path: ${playthrough.missionPath}`,
      "Tehkné Solutions",
      "",
    ].join("\n");
    await writeFile(new URL("manifest.txt", outputDir), manifest, "utf8");

    console.log(`PACK99_VISUAL_GATE=PASS canonical=${runtime.canonicalAssetCount} materialized=${runtime.materializedFileCount} battleNodes=${battleSurface.nodes} battleRuntimeImages=${battleSurface.runtimeImages} playthrough=${playthrough.terminal} steps=${playthrough.runnerStep} enemyTurns=${playthrough.endTurns}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`PACK99_VISUAL_GATE=FAIL ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});