import type { Hoc2TelemetryEvent } from "./hoc2Telemetry";

export type Hoc2HealthStatus = "pass" | "pending" | "fail";
export type Hoc2HealthSummary = {
  at: number;
  overall: Hoc2HealthStatus;
  route: "victory" | "retreat" | "in-progress";
  domains: {
    camera: Hoc2HealthStatus;
    hexa: Hoc2HealthStatus;
    movement: Hoc2HealthStatus;
    combat: Hoc2HealthStatus;
    strategicReturn: Hoc2HealthStatus;
  };
  issues: string[];
  counts: Record<string, number>;
};

const indexOf = (events: Hoc2TelemetryEvent[], predicate: (event: Hoc2TelemetryEvent) => boolean) => events.findIndex(predicate);
const has = (events: Hoc2TelemetryEvent[], name: Hoc2TelemetryEvent["event"]) => events.some((event) => event.event === name);

export function buildHoc2HealthSummary(events: Hoc2TelemetryEvent[]): Hoc2HealthSummary {
  const issues: string[] = [];
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.event] = (counts[event.event] ?? 0) + 1;

  const cameraCommand = indexOf(events, (event) => event.event === "camera.command" && event.source === "keyboard");
  const cameraApplied = indexOf(events, (event) => event.event === "camera.applied" && event.source === "keyboard");
  const zoomCommand = indexOf(events, (event) => event.event === "camera.command" && event.source === "wheel");
  const zoomApplied = indexOf(events, (event) => event.event === "camera.zoom" && event.source === "wheel");
  let camera: Hoc2HealthStatus = "pending";
  if (cameraCommand >= 0 && cameraApplied >= 0 && zoomCommand >= 0 && zoomApplied >= 0) {
    camera = cameraApplied > cameraCommand && zoomApplied > zoomCommand ? "pass" : "fail";
    if (camera === "fail") issues.push("camera causal order invalid");
  } else if ((cameraCommand >= 0 && cameraApplied < 0) || (zoomCommand >= 0 && zoomApplied < 0)) {
    camera = "fail";
    issues.push("camera command observed without applied state");
  }

  const hexaMode = indexOf(events, (event) => event.event === "hexa.mode" && event.input === "on");
  const movementFilter = indexOf(events, (event) => event.event === "hexa.filter" && event.filter === "movement");
  let hexa: Hoc2HealthStatus = "pending";
  if (hexaMode >= 0 && movementFilter >= 0) {
    hexa = movementFilter > hexaMode ? "pass" : "fail";
    if (hexa === "fail") issues.push("movement filter observed before Hexa mode");
  }

  const contact = indexOf(events, (event) => event.event === "movement.contact");
  const combatOpen = indexOf(events, (event) => event.event === "combat.open");
  let movement: Hoc2HealthStatus = "pending";
  if (contact >= 0 && combatOpen >= 0) {
    movement = combatOpen > contact ? "pass" : "fail";
    if (movement === "fail") issues.push("combat opened before movement contact");
  } else if (contact >= 0 && combatOpen < 0) {
    movement = "fail";
    issues.push("movement contact observed without combat open");
  }

  const victoryRequested = indexOf(events, (event) => event.event === "combat.exit.requested" && event.outcome === "victory");
  const retreatRequested = indexOf(events, (event) => event.event === "combat.exit.requested" && event.outcome === "retreat");
  const route: Hoc2HealthSummary["route"] = victoryRequested >= 0 ? "victory" : retreatRequested >= 0 ? "retreat" : "in-progress";

  let combat: Hoc2HealthStatus = "pending";
  if (route === "retreat") {
    const applied = indexOf(events, (event) => event.event === "combat.exit.applied" && event.outcome === "retreat");
    combat = applied > retreatRequested ? "pass" : "fail";
    if (combat === "fail") issues.push("retreat requested without applied combat exit");
  } else if (route === "victory") {
    const selection = indexOf(events, (event) => event.event === "combat.card.selection");
    const commit = indexOf(events, (event) => event.event === "combat.commit");
    const resolve = indexOf(events, (event) => event.event === "combat.resolve");
    const result = indexOf(events, (event) => event.event === "combat.result");
    const applied = indexOf(events, (event) => event.event === "combat.exit.applied" && event.outcome === "victory");
    const valid = selection >= 0 && commit > selection && resolve >= commit && result > resolve && applied > victoryRequested;
    combat = valid ? "pass" : "fail";
    if (!valid) issues.push("victory combat decision timeline incomplete or out of order");
  } else if (has(events, "combat.commit") && !has(events, "combat.result")) {
    combat = "fail";
    issues.push("combat committed without result");
  }

  let strategicReturn: Hoc2HealthStatus = "pending";
  if (route !== "in-progress") {
    const exitApplied = indexOf(events, (event) => event.event === "combat.exit.applied" && event.outcome === route);
    const snapshot = indexOf(events, (event) => event.event === "strategic.snapshot.rendered" && event.outcome === route);
    strategicReturn = snapshot > exitApplied && exitApplied >= 0 ? "pass" : "fail";
    if (strategicReturn === "fail") issues.push(`${route} exit did not produce a strategic snapshot`);
  }

  const domains = { camera, hexa, movement, combat, strategicReturn };
  const statuses = Object.values(domains);
  const overall: Hoc2HealthStatus = statuses.includes("fail") ? "fail" : statuses.every((status) => status === "pass") ? "pass" : "pending";

  return { at: Date.now(), overall, route, domains, issues, counts };
}
