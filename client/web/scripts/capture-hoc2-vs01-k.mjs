import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.HOC2_CAPTURE_URL || "http://127.0.0.1:4173/hoc2.html";
const outputDir = path.resolve(process.env.HOC2_CAPTURE_DIR || "artifacts/hoc2-vs01-k");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const runtimeAssetErrors = [];
page.on("response", (response) => {
  const url = response.url();
  if (url.includes("/assets/runtime/") && response.status() >= 400) {
    runtimeAssetErrors.push(`${response.status()} ${url}`);
  }
});

async function assertRuntimeAssetsHealthy(label) {
  await page.waitForTimeout(220);
  if (runtimeAssetErrors.length) {
    throw new Error(`HOC2_RUNTIME_ASSET_FAILURE:${label}:${runtimeAssetErrors.join(" | ")}`);
  }
  const brokenHtmlImages = await page.locator("img[data-runtime-asset], .hoc2-combat-portrait img").evaluateAll((images) => images
    .filter((image) => image instanceof HTMLImageElement && (!image.complete || image.naturalWidth === 0))
    .map((image) => image.getAttribute("data-runtime-asset") || image.getAttribute("alt") || image.getAttribute("src")));
  if (brokenHtmlImages.length) {
    throw new Error(`HOC2_RUNTIME_IMAGE_BROKEN:${label}:${brokenHtmlImages.join(",")}`);
  }
}

async function capture(name) {
  await assertRuntimeAssetsHealthy(name);
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false });
  console.log(`HOC2_CAPTURE=${name}`);
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByText("Living Map Sandbox").waitFor();
  await capture("01-living-map");

  const viewport = page.locator(".hoc2-map-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("HOC2 map viewport was not found");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -900);
  await capture("02-living-map-close-zoom");

  await page.getByRole("button", { name: "Modo Hexa" }).click();
  await page.getByText("DOMÍNIO · Aliança, Rubra e território neutro").waitFor();
  await capture("03-hexa-domain");

  await page.getByRole("button", { name: "Influência" }).click();
  await page.getByText(/INFLUÊNCIA · pressão Aliança:Rubra/).waitFor();
  await capture("04-hexa-influence");

  await page.getByRole("button", { name: "Conexões" }).click();
  await page.getByText(/CONEXÕES · nós estratégicos/).waitFor();
  await capture("05-hexa-connections");

  await page.getByRole("button", { name: "Octarina" }).click();
  await page.getByText(/OCTARINA · HEXA 3\/6/).waitFor();
  await capture("06-hexa-octarina");

  await page.getByRole("button", { name: "Movimento" }).click();
  await page.getByRole("button", { name: "INICIAR CONFRONTO" }).waitFor();
  await capture("07-hexa-movement-contact");

  await page.getByRole("button", { name: "INICIAR CONFRONTO" }).click();
  await page.getByRole("region", { name: "Card Combat 2" }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll(".hoc2-combat-portrait img")].every((image) => image.complete && image.naturalWidth > 0));
  await capture("08-card-combat-initial");

  await page.getByRole("button", { name: /Feint/ }).click();
  await page.getByRole("button", { name: /Precise Strike/ }).click();
  await page.getByText("COMBO · OPENING STRIKE").waitFor();
  await capture("09-card-combat-combo");

  await page.getByRole("button", { name: "CONFIRMAR" }).click();
  await page.getByText("COMBAT RESULT").waitFor({ timeout: 3000 });
  await capture("10-card-combat-result");

  await page.getByRole("button", { name: "APLICAR RESULTADO AO MAPA" }).click();
  await page.getByText("CONSEQUÊNCIA ESTRATÉGICA").waitFor();
  await capture("11-return-map-consequence");

  console.log("HOC2_CANONICAL_CAPTURE=PASS count=11 runtimeAssets=healthy");
} finally {
  await browser.close();
}
