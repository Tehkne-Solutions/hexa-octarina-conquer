const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const TARGET_SELECTOR = "[data-legal-target='true']";
const TERMINAL_STATES = new Set(["victory", "defeat", "resolved"]);
const MAX_STEPS = 64;
const STEP_DELAY_MS = 240;
let running = false;
let stepCount = 0;
let timer = 0;

function enabled() {
  const params = new URLSearchParams(window.location.search);
  return params.get("hocPlaytest") === "1" || window.__HOC_PLAYTEST__ === true;
}

function normalizedText(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function rootNode() {
  return document.querySelector(ROOT_SELECTOR);
}

function lifecycle(root) {
  return root?.dataset.missionLifecycleState || "unknown";
}

function findEndTurn(root) {
  return [...root.querySelectorAll("button, [role='button']")]
    .find((node) => normalizedText(node).toUpperCase() === "ENCERRAR TURNO" && !node.matches(":disabled,[aria-disabled='true']")) || null;
}

function legalTargets(root) {
  return [...root.querySelectorAll(TARGET_SELECTOR)]
    .filter((node) => !node.matches(":disabled,[aria-disabled='true']"))
    .filter((node) => node.getClientRects().length > 0);
}

function record(root, action, detail = "") {
  root.dataset.playtestRunnerState = action;
  root.dataset.playtestRunnerStep = String(stepCount);
  if (detail) root.dataset.playtestRunnerDetail = detail.slice(0, 96);
}

function finish(root, state) {
  running = false;
  window.clearTimeout(timer);
  root.dataset.playtestRunner = TERMINAL_STATES.has(state) ? "complete" : "stopped";
  root.dataset.playtestRunnerTerminal = state;
  record(root, "finished", state);
}

function chooseTarget(targets) {
  const attack = targets.find((node) => /ATACAR/i.test(normalizedText(node)));
  if (attack) return attack;
  const move = targets.find((node) => /MOVER|CLIQUE AQUI/i.test(normalizedText(node)));
  if (move) return move;
  const build = targets.find((node) => /CONSTRUIR|BASTIÃO/i.test(normalizedText(node)));
  return build || targets[0] || null;
}

function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(step, STEP_DELAY_MS);
}

function step() {
  if (!running) return;
  const root = rootNode();
  if (!root) return schedule();

  const state = lifecycle(root);
  if (TERMINAL_STATES.has(state)) return finish(root, state);
  if (stepCount >= MAX_STEPS) return finish(root, "step-limit");

  stepCount += 1;
  if (state === "enemy") {
    record(root, "wait-enemy", state);
    return schedule();
  }

  const target = chooseTarget(legalTargets(root));
  if (target) {
    const label = normalizedText(target) || target.getAttribute("aria-label") || "target";
    record(root, "activate-target", label);
    target.click();
    return schedule();
  }

  const endTurn = findEndTurn(root);
  if (endTurn) {
    record(root, "end-turn", "ENCERRAR TURNO");
    endTurn.click();
    return schedule();
  }

  record(root, "wait", state);
  schedule();
}

function start() {
  if (!enabled() || running) return;
  running = true;
  stepCount = 0;
  const root = rootNode();
  if (root) {
    root.dataset.playtestRunner = "running";
    record(root, "started", lifecycle(root));
  }
  schedule();
}

function forceStart() {
  window.__HOC_PLAYTEST__ = true;
  start();
}

window.addEventListener("hoc:playtest-start", forceStart);
window.addEventListener("DOMContentLoaded", start, { once: true });
start();
