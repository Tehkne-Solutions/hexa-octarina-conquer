import { chromium } from "playwright";

const baseUrl = process.env.HOC2_PLAYTEST_URL || "http://127.0.0.1:4173/hoc2.html";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function gotoCandidate() {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByText("Living Map Sandbox").waitFor();
}

async function enterCombat() {
  await page.getByRole("button", { name: "Modo Hexa" }).click();
  await page.getByRole("button", { name: "Movimento" }).click();
  await page.getByRole("button", { name: "INICIAR CONFRONTO" }).click();
  await page.getByRole("region", { name: "Card Combat 2" }).waitFor();
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

try {
  await gotoCandidate();

  // Camera: keyboard pan + zoom must alter the actual camera transform.
  const camera = page.locator(".hoc2-map-camera");
  const transform0 = await camera.getAttribute("style");
  await page.locator(".hoc2-map-viewport").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(120);
  const transform1 = await camera.getAttribute("style");
  assert(transform1 !== transform0, "PLAYTEST01_CAMERA_PAN_DID_NOT_CHANGE");

  const viewport = page.locator(".hoc2-map-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("PLAYTEST01_MAP_VIEWPORT_MISSING");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -700);
  await page.waitForTimeout(120);
  const transform2 = await camera.getAttribute("style");
  assert(transform2 !== transform1, "PLAYTEST01_CAMERA_ZOOM_DID_NOT_CHANGE");
  console.log("PLAYTEST01_CAMERA=PASS");

  // Filters: each tactical lens must replace the previous one and expose its own label.
  await page.getByRole("button", { name: "Modo Hexa" }).click();
  const filters = [
    ["Influência", /INFLUÊNCIA · pressão Aliança:Rubra/],
    ["Conexões", /CONEXÕES · nós estratégicos/],
    ["Octarina", /OCTARINA · HEXA 3\/6/],
    ["Movimento", /MOVIMENTO · Kael 4 MP/],
  ];
  for (const [button, label] of filters) {
    await page.getByRole("button", { name: button }).click();
    await page.getByText(label).waitFor();
  }
  console.log("PLAYTEST01_FILTERS=PASS");

  // Sequence A: canonical combo.
  await page.getByRole("button", { name: "INICIAR CONFRONTO" }).click();
  await page.getByRole("button", { name: /Feint/ }).click();
  await page.getByRole("button", { name: /Precise Strike/ }).click();
  await page.getByText("COMBO · OPENING STRIKE").waitFor();
  await page.getByRole("button", { name: "CONFIRMAR" }).click();
  await page.getByText("COMBAT RESULT").waitFor({ timeout: 3000 });
  await page.getByText(/Feint abriu a guarda de Brakk/).waitFor();
  console.log("PLAYTEST01_SEQUENCE_A=PASS");

  // Sequence B: deliberately different non-combo line must resolve independently.
  await page.getByRole("button", { name: "PRÓXIMA RODADA" }).click();
  await page.getByRole("button", { name: /Shield Wall/ }).click();
  await page.getByRole("button", { name: /Arrow Volley/ }).click();
  await page.getByRole("button", { name: "CONFIRMAR" }).click();
  await page.getByText("COMBAT RESULT").waitFor({ timeout: 3000 });
  await page.getByText(/sequência foi resolvida pelo contrato autoritativo/).waitFor();
  console.log("PLAYTEST01_SEQUENCE_B=PASS");

  // Victory path must change strategic world and return to the same map.
  await page.getByRole("button", { name: "APLICAR RESULTADO AO MAPA" }).click();
  await page.getByText("CONSEQUÊNCIA ESTRATÉGICA").waitFor();
  await page.getByText("HEX CAPTURADO").waitFor();
  await page.getByText("BRakk recuou").waitFor();
  await page.getByText("Living Map Sandbox").waitFor();
  console.log("PLAYTEST01_VICTORY_RETURN=PASS");

  // Retreat path must preserve strategic state and not synthesize a capture.
  await gotoCandidate();
  await enterCombat();
  await page.getByRole("button", { name: /RETIRADA/ }).click();
  await page.getByText("RETIRADA", { exact: true }).waitFor();
  await page.getByText("Kael preservou sua posição anterior.").waitFor();
  const captureBanner = page.getByText("HEX CAPTURADO");
  assert((await captureBanner.count()) === 0, "PLAYTEST01_RETREAT_SYNTHESIZED_CAPTURE");
  console.log("PLAYTEST01_RETREAT=PASS");

  console.log("HOC2_PLAYTEST01_ACCEPTANCE=PASS camera=1 filters=4 sequences=2 victory=1 retreat=1");
} finally {
  await browser.close();
}
