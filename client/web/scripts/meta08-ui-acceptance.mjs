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
  gate: "META 08.9 browser interaction acceptance",
  baseUrl,
  passed: false,
  startedAt: new Date(startedAt).toISOString(),
  completedAt: null,
  durationMs: 0,
  steps: [],
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
    window.sessionStorage.setItem("hexa.strategic.match-seed", "0");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(".strategic-slice").waitFor({ state: "visible", timeout: 20_000 });
}

async function expectText(page, text) {
  await page.getByText(text, { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
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
  await page.locator(".strategic-command-banner strong").getByText(target.banner, { exact: true })
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function clickRoute(page, label) {
  const edge = page.locator(`.strategic-edge[aria-label="${label}"]:not(:disabled)`).first();
  await edge.waitFor({ state: "visible", timeout: 10_000 });
  await edge.click();
}

async function attackUnit(page, name) {
  const target = page.locator(`.strategic-unit[aria-label^="${name},"]`).first();
  await target.waitFor({ state: "visible", timeout: 10_000 });
  await target.click();
}

async function endTurn(page) {
  const button = page.getByRole("button", { name: "ENCERRAR TURNO" });
  await button.waitFor({ state: "visible", timeout: 10_000 });
  if (await button.isDisabled()) throw new Error("ENCERRAR TURNO is disabled while the round should be closable");
  await button.click();
}

async function capture(page, name) {
  await page.screenshot({ path: path.join(outputDirectory, name), fullPage: true });
}

async function runNotebook(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  try {
    await prepareMission(page);
    await expectText(page, "Estradas 0/6");
    await expectText(page, "Orun venceu a iniciativa da rodada 1.");
    record("balanced strategic mission opened on notebook viewport");

    await clickRoute(page, "Construir estrada até Mirante de Orun");
    await expectText(page, "Estradas 1/6");
    await setMode(page, "move");
    await clickRoute(page, "Mover para Mirante de Orun");
    await setMode(page, "attack");
    await attackUnit(page, "Varg");
    record("neutral opening supports road movement and combat through the browser");

    await endTurn(page);
    await expectText(page, "RODADA 2");
    record("alternating initiative advances to round two through the production controller");
    await capture(page, "03-balanced-turn-notebook.png");
  } finally {
    await context.close();
  }
}

async function runMobile(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await prepareMission(page);
    const geometry = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      boardHeight: document.querySelector(".strategic-board")?.getBoundingClientRect().height ?? 0,
    }));
    if (geometry.documentWidth > geometry.viewportWidth + 4) throw new Error(`mobile layout overflows: ${JSON.stringify(geometry)}`);
    if (geometry.boardHeight < 560) throw new Error(`mobile strategic board is too short: ${JSON.stringify(geometry)}`);

    await expectText(page, "Estradas 0/6");
    const edge = page.locator('.strategic-edge[aria-label="Construir estrada até Mirante de Orun"]:not(:disabled)').first();
    await edge.waitFor({ state: "visible", timeout: 10_000 });
    await edge.tap();
    await expectText(page, "Estradas 1/6");
    record("mobile touch builds the first road from the neutral opening without horizontal overflow", geometry);
    await capture(page, "05-balanced-road-mobile.png");
  } finally {
    await context.close();
  }
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  await runNotebook(browser);
  await runMobile(browser);
  report.passed = true;
  record("META 08.9 browser interaction acceptance passed");
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
