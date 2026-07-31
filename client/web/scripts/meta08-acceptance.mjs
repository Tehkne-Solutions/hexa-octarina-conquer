#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const baseUrl = process.env.META08_BASE_URL ?? "http://127.0.0.1:4173";
const outputDirectory = path.resolve(process.env.META08_OUTPUT_DIR ?? "meta08-acceptance");
const startedAt = Date.now();
const report = {
  project: "Hexa Octarina Conquer",
  gate: "META 08.9 playable acceptance",
  baseUrl,
  passed: false,
  startedAt: new Date(startedAt).toISOString(),
  completedAt: null,
  durationMs: 0,
  steps: [],
  viewports: {},
  signature: "Tehkné Solutions",
};

function record(step, detail = {}) {
  report.steps.push({ step, at: new Date().toISOString(), ...detail });
  console.log(`[META 08.9] ${step}`);
}

async function prepareMission(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem("hexa.unified.screen", "campaign");
    window.sessionStorage.setItem("hexa.unified.campaign-view", "living");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(".strategic-slice").waitFor({ state: "visible", timeout: 20_000 });
}

async function expectText(page, text) {
  await page.getByText(text, { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
}

async function expectMode(page, label) {
  await page.locator(".strategic-command-banner strong").getByText(label, { exact: true })
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function selectUnit(page, name) {
  const button = page.locator(".strategic-roster-card:not(:disabled)").filter({ hasText: name }).first();
  await button.waitFor({ state: "visible", timeout: 10_000 });
  await button.click();
  await page.locator(".strategic-help").getByText(new RegExp(`^${name} ·`)).waitFor({ timeout: 10_000 });
}

async function setMode(page, mode) {
  const labels = {
    road: { action: "ESTRADA", banner: "CONSTRUIR ESTRADA" },
    move: { action: "MOVER", banner: "MOVER UNIDADE" },
    structure: { action: "BASTIÃO", banner: "CONSTRUIR BASTIÃO" },
    attack: { action: "ATACAR", banner: "ATACAR" },
  };
  const target = labels[mode];
  const current = (await page.locator(".strategic-command-banner strong").textContent())?.trim();
  if (current !== target.banner) {
    const button = page.locator(".strategic-actions button:not(:disabled)").filter({ hasText: target.action }).first();
    await button.waitFor({ state: "visible", timeout: 10_000 });
    await button.click();
  }
  await expectMode(page, target.banner);
}

async function clickRoute(page, label) {
  const edge = page.locator(`.strategic-edge[aria-label="${label}"]:not(:disabled)`).first();
  await edge.waitFor({ state: "visible", timeout: 10_000 });
  await edge.click();
}

async function tapRoute(page, label) {
  const edge = page.locator(`.strategic-edge[aria-label="${label}"]:not(:disabled)`).first();
  await edge.waitFor({ state: "visible", timeout: 10_000 });
  await edge.tap();
}

async function attackUnit(page, name) {
  const target = page.locator(`.strategic-unit[aria-label^="${name},"]`).first();
  await target.waitFor({ state: "visible", timeout: 10_000 });
  await target.click();
}

async function buildBastion(page, regionName) {
  const target = page.locator(`.strategic-cell[aria-label="Construir Bastião em ${regionName}"]:not(:disabled)`).first();
  await target.waitFor({ state: "visible", timeout: 10_000 });
  await target.click();
}

async function endTurn(page) {
  await page.getByRole("button", { name: "ENCERRAR TURNO" }).click();
}

async function activeControl(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    return {
      tag: element.tagName,
      label: (element.getAttribute("aria-label") ?? element.textContent ?? "").replace(/\s+/g, " ").trim(),
      disabled: element instanceof HTMLButtonElement ? element.disabled : false,
      ariaDisabled: element.getAttribute("aria-disabled"),
    };
  });
}

async function activateByKeyboard(page, expectedLabel, key) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  const visited = [];
  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press("Tab");
    const active = await activeControl(page);
    if (!active) continue;
    visited.push(active.label);
    if (active.disabled || active.ariaDisabled === "true") {
      throw new Error(`disabled control received keyboard focus: ${JSON.stringify(active)}`);
    }
    if (active.label === expectedLabel) {
      await page.keyboard.press(key);
      record("strategic control activated from keyboard", { label: expectedLabel, key, traversed: visited.length });
      return;
    }
  }
  throw new Error(`keyboard could not reach strategic control ${expectedLabel}; visited=${JSON.stringify(visited)}`);
}

async function capture(page, name) {
  const target = path.join(outputDirectory, name);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

async function runNotebookAcceptance(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  report.viewports.notebook = { width: 1366, height: 768 };

  try {
    await prepareMission(page);
    record("strategic mission opened on notebook viewport");
    await expectText(page, "Estradas 2/6");
    await capture(page, "01-initial-notebook.png");

    // Round 1: keyboard road, movement and first attack.
    await activateByKeyboard(page, "Construir estrada até Mirante de Orun", "Enter");
    await expectText(page, "Estradas 3/6");
    await setMode(page, "move");
    await clickRoute(page, "Mover para Mirante de Orun");
    await page.locator(".strategic-help").getByText("Kael · Mirante de Orun", { exact: true }).waitFor({ timeout: 10_000 });
    await setMode(page, "attack");
    await attackUnit(page, "Varg");
    await page.locator('.strategic-unit[aria-label="Varg, 6 de vida"]').waitFor({ timeout: 10_000 });
    record("round one completed with road movement and combat");

    await activateByKeyboard(page, "ENCERRAR TURNO", "Space");
    await expectText(page, "RODADA 2");

    // Round 2: defeat Varg and prepare both western regions.
    await setMode(page, "attack");
    await attackUnit(page, "Varg");
    await expectText(page, "Baixas Rubras 1/1");
    await setMode(page, "road");
    await clickRoute(page, "Construir estrada até Portal do Norte");
    await selectUnit(page, "Lyra");
    await setMode(page, "road");
    await clickRoute(page, "Construir estrada até Vau Octarino");
    record("enemy defeated and second regional route prepared");
    await capture(page, "02-enemy-defeated-notebook.png");

    await endTurn(page);
    await expectText(page, "RODADA 3");

    // Round 3: close Bosque de Orun and build the required Bastion.
    await setMode(page, "move");
    await clickRoute(page, "Mover para Portal do Norte");
    await page.locator(".strategic-help").getByText("Kael · Portal do Norte", { exact: true }).waitFor({ timeout: 10_000 });
    await setMode(page, "road");
    await clickRoute(page, "Construir estrada até Posto da Floresta");
    await expectText(page, "Regiões 1/2");
    await setMode(page, "structure");
    await buildBastion(page, "Bosque de Orun");
    await expectText(page, "Bastiões 1/1");
    record("first territory closed and Bastion built");
    await capture(page, "03-bastion-notebook.png");

    await endTurn(page);
    await expectText(page, "RODADA 4");

    // Round 4: close the second region and assert victory through React UI.
    await selectUnit(page, "Lyra");
    await setMode(page, "move");
    await clickRoute(page, "Mover para Vau Octarino");
    await page.locator(".strategic-help").getByText("Lyra · Vau Octarino", { exact: true }).waitFor({ timeout: 10_000 });
    await setMode(page, "road");
    await clickRoute(page, "Construir estrada até Entroncamento Central");

    const victory = page.locator(".strategic-result.is-victory");
    await victory.waitFor({ state: "visible", timeout: 10_000 });
    await victory.getByText("Orun consolidou a fronteira", { exact: true }).waitFor({ timeout: 10_000 });
    await expectText(page, "VITÓRIA");
    await expectText(page, "Regiões 2/2");
    await victory.getByRole("button", { name: "JOGAR NOVAMENTE" }).waitFor({ state: "visible" });
    record("complete strategic victory rendered through the browser UI", { round: 4 });
    await capture(page, "04-victory-notebook.png");
  } catch (error) {
    await capture(page, "failure-notebook.png").catch(() => undefined);
    throw error;
  } finally {
    await context.close();
  }
}

async function runMobileAcceptance(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  report.viewports.mobile = { width: 390, height: 844, touch: true };

  try {
    await prepareMission(page);
    const geometry = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      boardHeight: document.querySelector(".strategic-board")?.getBoundingClientRect().height ?? 0,
      sliceHeight: document.querySelector(".strategic-slice")?.getBoundingClientRect().height ?? 0,
    }));
    if (geometry.documentWidth > geometry.viewportWidth + 4) {
      throw new Error(`mobile layout overflows horizontally: ${JSON.stringify(geometry)}`);
    }
    if (geometry.boardHeight < 560) {
      throw new Error(`mobile strategic board is too short: ${JSON.stringify(geometry)}`);
    }

    await tapRoute(page, "Construir estrada até Vau Octarino");
    await expectText(page, "Estradas 3/6");
    await expectMode(page, "MOVER UNIDADE");
    record("mobile touch built a strategic road without horizontal overflow", geometry);
    await capture(page, "05-road-built-mobile.png");
  } catch (error) {
    await capture(page, "failure-mobile.png").catch(() => undefined);
    throw error;
  } finally {
    await context.close();
  }
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  await runNotebookAcceptance(browser);
  await runMobileAcceptance(browser);
  report.passed = true;
  record("META 08.9 browser acceptance passed");
} catch (error) {
  report.error = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAt;
  await writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
