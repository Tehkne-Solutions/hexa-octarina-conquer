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

async function telemetry() {
  return page.evaluate(() => window.__HOC2_TELEMETRY__ ?? []);
}

async function assertCombatExit(outcome) {
  const events = await telemetry();
  assert(events.some((event) => event.event === "combat.exit.requested" && event.outcome === outcome), `PLAYTEST01_COMBAT_EXIT_${outcome.toUpperCase()}_NOT_REQUESTED`);
  assert(events.some((event) => event.event === "combat.exit.applied" && event.outcome === outcome), `PLAYTEST01_COMBAT_EXIT_${outcome.toUpperCase()}_NOT_APPLIED`);
}

function firstIndex(events, predicate) {
  return events.findIndex(predicate);
}

async function assertJourneyTimeline(outcome) {
  const events = await telemetry();
  const modeIndex = firstIndex(events, (event) => event.event === "hexa.mode" && event.input === "on");
  const movementFilterIndex = firstIndex(events, (event) => event.event === "hexa.filter" && event.filter === "movement");
  const contactIndex = firstIndex(events, (event) => event.event === "movement.contact" && event.attacker === "kael" && event.defender === "brakk");
  const combatOpenIndex = firstIndex(events, (event) => event.event === "combat.open" && event.attacker === "kael" && event.defender === "brakk");
  const exitRequestedIndex = firstIndex(events, (event) => event.event === "combat.exit.requested" && event.outcome === outcome);
  const exitAppliedIndex = firstIndex(events, (event) => event.event === "combat.exit.applied" && event.outcome === outcome);
  const snapshotIndex = firstIndex(events, (event) => event.event === "strategic.snapshot.rendered" && event.outcome === outcome);

  assert(modeIndex >= 0, "PLAYTEST01_TIMELINE_HEXA_MODE_MISSING");
  assert(movementFilterIndex > modeIndex, "PLAYTEST01_TIMELINE_MOVEMENT_FILTER_ORDER_INVALID");
  assert(contactIndex > movementFilterIndex, "PLAYTEST01_TIMELINE_CONTACT_ORDER_INVALID");
  assert(combatOpenIndex > contactIndex, "PLAYTEST01_TIMELINE_COMBAT_OPEN_ORDER_INVALID");
  assert(exitRequestedIndex > combatOpenIndex, "PLAYTEST01_TIMELINE_EXIT_REQUEST_ORDER_INVALID");
  assert(exitAppliedIndex > exitRequestedIndex, "PLAYTEST01_TIMELINE_EXIT_APPLIED_ORDER_INVALID");
  assert(snapshotIndex > exitAppliedIndex, "PLAYTEST01_TIMELINE_SNAPSHOT_ORDER_INVALID");
  return { events, snapshotIndex };
}

async function assertCombatDecisionTimeline(cards, { combo, energy, priorityOrder }) {
  const events = await telemetry();
  const sameCards = (event) => Array.isArray(event.cards) && event.cards.join(",") === cards.join(",");
  const selectionIndex = firstIndex(events, (event) => event.event === "combat.card.selection" && sameCards(event));
  const energyIndex = firstIndex(events, (event) => event.event === "combat.energy" && sameCards(event) && event.energy === energy);
  const comboIndex = firstIndex(events, (event) => event.event === "combat.combo" && sameCards(event) && event.combo === combo);
  const commitIndex = firstIndex(events, (event) => event.event === "combat.commit" && sameCards(event) && event.energy === energy && event.combo === combo);
  const resolveIndex = firstIndex(events, (event) => event.event === "combat.resolve" && sameCards(event));
  const resultIndex = firstIndex(events, (event) => event.event === "combat.result" && sameCards(event));
  const commitEvent = events[commitIndex];

  assert(selectionIndex >= 0, "PLAYTEST01_COMBAT_SELECTION_TELEMETRY_MISSING");
  assert(energyIndex >= selectionIndex, "PLAYTEST01_COMBAT_ENERGY_TELEMETRY_ORDER_INVALID");
  assert(comboIndex >= selectionIndex, "PLAYTEST01_COMBAT_COMBO_TELEMETRY_ORDER_INVALID");
  assert(commitIndex > comboIndex, "PLAYTEST01_COMBAT_COMMIT_TELEMETRY_ORDER_INVALID");
  assert(resolveIndex >= commitIndex, "PLAYTEST01_COMBAT_RESOLVE_TELEMETRY_ORDER_INVALID");
  assert(resultIndex > resolveIndex, "PLAYTEST01_COMBAT_RESULT_TELEMETRY_ORDER_INVALID");
  assert(Array.isArray(commitEvent?.priorityOrder) && commitEvent.priorityOrder.join(",") === priorityOrder.join(","), "PLAYTEST01_COMBAT_PRIORITY_ORDER_INVALID");
}

try {
  await gotoCandidate();

  const camera = page.locator(".hoc2-map-camera");
  const viewport = page.locator(".hoc2-map-viewport");
  const transform0 = await camera.getAttribute("style");
  const box0 = await viewport.boundingBox();
  if (!box0) throw new Error("PLAYTEST01_MAP_VIEWPORT_MISSING");
  await page.mouse.click(box0.x + box0.width / 2, box0.y + box0.height / 2);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(120);
  const transform1 = await camera.getAttribute("style");
  assert(transform1 !== transform0, "PLAYTEST01_CAMERA_PAN_DID_NOT_CHANGE");

  const keyboardTelemetry = await telemetry();
  assert(keyboardTelemetry.some((event) => event.event === "camera.command" && event.source === "keyboard" && event.input === "arrowright"), "PLAYTEST01_CAMERA_COMMAND_NOT_OBSERVED");
  assert(keyboardTelemetry.some((event) => event.event === "camera.applied" && event.source === "keyboard" && event.input === "arrowright"), "PLAYTEST01_CAMERA_COMMAND_NOT_APPLIED");

  const box = await viewport.boundingBox();
  if (!box) throw new Error("PLAYTEST01_MAP_VIEWPORT_MISSING");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -700);
  await page.waitForTimeout(120);
  const transform2 = await camera.getAttribute("style");
  assert(transform2 !== transform1, "PLAYTEST01_CAMERA_ZOOM_DID_NOT_CHANGE");
  const zoomTelemetry = await telemetry();
  assert(zoomTelemetry.some((event) => event.event === "camera.command" && event.source === "wheel"), "PLAYTEST01_CAMERA_ZOOM_COMMAND_NOT_OBSERVED");
  assert(zoomTelemetry.some((event) => event.event === "camera.zoom" && event.source === "wheel"), "PLAYTEST01_CAMERA_ZOOM_NOT_APPLIED");
  console.log(`PLAYTEST01_CAMERA=PASS telemetry=${zoomTelemetry.length}`);

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
  const filterTelemetry = await telemetry();
  for (const filter of ["influence", "connections", "octarina", "movement"]) {
    assert(filterTelemetry.some((event) => event.event === "hexa.filter" && event.filter === filter), `PLAYTEST01_FILTER_TELEMETRY_${filter.toUpperCase()}_MISSING`);
  }
  console.log("PLAYTEST01_FILTERS=PASS telemetry=4");

  await page.getByRole("button", { name: "INICIAR CONFRONTO" }).click();
  await page.getByRole("button", { name: /Feint/ }).click();
  await page.getByRole("button", { name: /Precise Strike/ }).click();
  await page.getByText("COMBO · OPENING STRIKE").waitFor();
  await page.getByRole("button", { name: "CONFIRMAR" }).click();
  await page.getByText("COMBAT RESULT").waitFor({ timeout: 3000 });
  await page.getByText(/Feint abriu a guarda de Brakk/).waitFor();
  await assertCombatDecisionTimeline(["feint","precise-strike"], { combo:true, energy:4, priorityOrder:["feint","precise-strike"] });
  console.log("PLAYTEST01_SEQUENCE_A=PASS telemetry=decision");

  await page.getByRole("button", { name: "PRÓXIMA RODADA" }).click();
  const resetEvents = await telemetry();
  assert(resetEvents.some((event) => event.event === "combat.round.reset" && event.energy === 7), "PLAYTEST01_COMBAT_ROUND_RESET_TELEMETRY_MISSING");
  await page.getByRole("button", { name: /Shield Wall/ }).click();
  await page.getByRole("button", { name: /Arrow Volley/ }).click();
  await page.getByRole("button", { name: "CONFIRMAR" }).click();
  await page.getByText("COMBAT RESULT").waitFor({ timeout: 3000 });
  await page.getByText(/sequência foi resolvida pelo contrato autoritativo/).waitFor();
  await assertCombatDecisionTimeline(["shield-wall","arrow-volley"], { combo:false, energy:2, priorityOrder:["shield-wall","arrow-volley"] });
  console.log("PLAYTEST01_SEQUENCE_B=PASS telemetry=decision");

  await page.getByRole("button", { name: "APLICAR RESULTADO AO MAPA" }).click();
  await page.locator(".hoc2-map-viewport").waitFor();
  await page.getByText("CONSEQUÊNCIA ESTRATÉGICA").waitFor();
  await page.getByText("HEX CAPTURADO").waitFor();
  await page.getByText("BRakk recuou").waitFor();
  await page.getByText("Strategic Hexa View").waitFor();
  await assertCombatExit("victory");
  const victoryTimeline = await assertJourneyTimeline("victory");
  console.log(`PLAYTEST01_VICTORY_RETURN=PASS timeline=${victoryTimeline.snapshotIndex + 1}/${victoryTimeline.events.length}`);

  await gotoCandidate();
  await enterCombat();
  await page.getByRole("button", { name: /RETIRADA/ }).click();
  await page.locator(".hoc2-map-viewport").waitFor();
  await page.getByText("RETIRADA", { exact: true }).waitFor();
  await page.getByText("Kael preservou sua posição anterior.").waitFor();
  const captureBanner = page.getByText("HEX CAPTURADO");
  assert((await captureBanner.count()) === 0, "PLAYTEST01_RETREAT_SYNTHESIZED_CAPTURE");
  await assertCombatExit("retreat");
  const retreatTimeline = await assertJourneyTimeline("retreat");
  console.log(`PLAYTEST01_RETREAT=PASS timeline=${retreatTimeline.snapshotIndex + 1}/${retreatTimeline.events.length}`);

  console.log("HOC2_PLAYTEST01_ACCEPTANCE=PASS camera=1 telemetry=full-journey filters=4 sequences=2 victory=1 retreat=1");
} finally {
  await browser.close();
}
