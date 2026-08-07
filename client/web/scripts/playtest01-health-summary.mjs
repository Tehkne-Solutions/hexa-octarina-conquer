import { chromium } from "playwright";

const baseUrl = process.env.HOC2_PLAYTEST_URL || "http://127.0.0.1:4173/hoc2.html";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

async function health() {
  return page.evaluate(() => window.__HOC2_HEALTH__ ?? null);
}

async function gotoCandidate() {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByText("Mapa Vivo · Explorar e Gerenciar").waitFor();
  await page.locator('.hoc2-living-map[data-world-source="MAP_FOREST_FRONTIER_8X8_01"]').waitFor();
}

async function enterMovementCombat() {
  await page.getByRole("button", { name: "Modo Hexa" }).click();
  await page.getByRole("button", { name: "Movimento" }).click();
  await page.getByRole("button", { name: "INICIAR CONFRONTO" }).click();
  await page.getByRole("region", { name: "Card Combat 2" }).waitFor();
}

try {
  await gotoCandidate();
  const viewport = page.locator(".hoc2-map-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("HEALTH_MAP_VIEWPORT_MISSING");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press("ArrowRight");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -600);

  await enterMovementCombat();
  await page.getByRole("button", { name: /Feint/ }).click();
  await page.getByRole("button", { name: /Precise Strike/ }).click();
  await page.getByRole("button", { name: "CONFIRMAR" }).click();
  await page.getByText("COMBAT RESULT").waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "APLICAR RESULTADO AO MAPA" }).click();
  await page.getByText("CONSEQUÊNCIA ESTRATÉGICA").waitFor();

  const victory = await health();
  assert(victory, "HEALTH_VICTORY_SUMMARY_MISSING");
  assert(victory.route === "victory", "HEALTH_VICTORY_ROUTE_INVALID");
  assert(victory.overall === "pass", `HEALTH_VICTORY_OVERALL_${victory.overall?.toUpperCase()}`);
  for (const [domain, status] of Object.entries(victory.domains)) {
    assert(status === "pass", `HEALTH_VICTORY_${domain.toUpperCase()}_${String(status).toUpperCase()}`);
  }
  assert(victory.issues.length === 0, `HEALTH_VICTORY_ISSUES:${victory.issues.join("|")}`);
  console.log(`HOC2_HEALTH_VICTORY=PASS domains=${Object.keys(victory.domains).length} events=${Object.values(victory.counts).reduce((a,b)=>a+b,0)}`);

  await gotoCandidate();
  await enterMovementCombat();
  await page.getByRole("button", { name: /RETIRADA/ }).click();
  await page.getByText("RETIRADA", { exact: true }).waitFor();

  const retreat = await health();
  assert(retreat, "HEALTH_RETREAT_SUMMARY_MISSING");
  assert(retreat.route === "retreat", "HEALTH_RETREAT_ROUTE_INVALID");
  assert(retreat.domains.hexa === "pass", "HEALTH_RETREAT_HEXA_NOT_PASS");
  assert(retreat.domains.movement === "pass", "HEALTH_RETREAT_MOVEMENT_NOT_PASS");
  assert(retreat.domains.combat === "pass", "HEALTH_RETREAT_COMBAT_NOT_PASS");
  assert(retreat.domains.strategicReturn === "pass", "HEALTH_RETREAT_STRATEGIC_RETURN_NOT_PASS");
  assert(!Object.values(retreat.domains).includes("fail"), "HEALTH_RETREAT_DOMAIN_FAIL");
  assert(retreat.issues.length === 0, `HEALTH_RETREAT_ISSUES:${retreat.issues.join("|")}`);
  console.log(`HOC2_HEALTH_RETREAT=PASS camera=${retreat.domains.camera} events=${Object.values(retreat.counts).reduce((a,b)=>a+b,0)}`);

  console.log("HOC2_HEALTH_SUMMARY=PASS victory=pass retreat=pass issues=0 authoredWorld=MAP_FOREST_FRONTIER_8X8_01");
} finally {
  await browser.close();
}
