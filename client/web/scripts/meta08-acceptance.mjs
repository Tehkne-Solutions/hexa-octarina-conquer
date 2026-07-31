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
  report.steps.push({
    step,
    at: new Date().toISOString(),
    ...detail,
  });
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

async function clickRoad(page, label) {
  const edge = page.locator(`.strategic-edge[aria-label="${label}"]:not(:disabled)`).first();
  await edge.waitFor({ state: "visible", timeout: 10_000 });
  await edge.click();
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

    await clickRoad(page, "Construir estrada até Vau Octarino");
    await expectText(page, "Estradas 3/6");
    record("recommended road built", { roadProgress: "3/6" });

    await clickRoad(page, "Mover para Vau Octarino");
    await page.locator(".strategic-help").getByText("Kael · Vau Octarino", { exact: true }).waitFor({ timeout: 10_000 });
    record("Kael moved through the constructed route");

    await clickRoad(page, "Construir estrada até Acampamento de Lyra");
    await expectText(page, "Regiões 1/2");
    record("first territory closed", { regionProgress: "1/2" });
    await capture(page, "02-region-closed-notebook.png");

    await page.getByRole("button", { name: "ENCERRAR TURNO" }).click();
    await page.getByText("RODADA 2", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
    record("enemy turn resolved and round two started");

    let buildTarget = page.locator('.strategic-cell[aria-label^="Construir Bastião em"]:not(:disabled)').first();
    if (await buildTarget.count() === 0) {
      const bastionAction = page.locator(".strategic-actions button:not(:disabled)").filter({ hasText: "BASTIÃO" }).first();
      await bastionAction.click();
      buildTarget = page.locator('.strategic-cell[aria-label^="Construir Bastião em"]:not(:disabled)').first();
    }
    await buildTarget.waitFor({ state: "visible", timeout: 10_000 });
    const bastionLabel = await buildTarget.getAttribute("aria-label");
    await buildTarget.click();
    await expectText(page, "Bastiões 1/1");
    record("Bastion built after territory closure", { target: bastionLabel });
    await capture(page, "03-bastion-notebook.png");

    const keyboardTargets = [];
    for (let index = 0; index < 24; index += 1) {
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => {
        const element = document.activeElement;
        if (!(element instanceof HTMLElement)) return null;
        return {
          tag: element.tagName,
          label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 80) ?? "",
          disabled: element instanceof HTMLButtonElement ? element.disabled : false,
          ariaDisabled: element.getAttribute("aria-disabled"),
        };
      });
      if (active) keyboardTargets.push(active);
    }
    const invalidFocus = keyboardTargets.find((target) => target.disabled || target.ariaDisabled === "true");
    if (invalidFocus) throw new Error(`disabled strategic control received keyboard focus: ${JSON.stringify(invalidFocus)}`);
    record("keyboard traversal skipped disabled strategic controls", { sampledTargets: keyboardTargets.length });
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
    record("mobile layout accepted without horizontal overflow", geometry);
    await capture(page, "04-initial-mobile.png");
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
