const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const OBJECTIVE_PATTERN = /^(Estradas|Regiões|Bastiões|Baixas Rubras)\s+(\d+)\/(\d+)$/i;
const objectiveSnapshot = new Map();
let initialized = false;

function normalizedText(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function readObjectiveRows(root) {
  const byLabel = new Map();
  for (const node of root.querySelectorAll("div, li, span, strong")) {
    if (node.closest(".strategic-mission-progress-toast")) continue;
    const text = normalizedText(node);
    const match = text.match(OBJECTIVE_PATTERN);
    if (!match) continue;
    const label = match[1].replace(/\s+/g, " ");
    const candidate = {
      label,
      current: Number(match[2]),
      target: Number(match[3]),
      node,
      text,
    };
    const existing = byLabel.get(label.toLowerCase());
    if (!existing || node.children.length < existing.node.children.length) {
      byLabel.set(label.toLowerCase(), candidate);
    }
  }
  return [...byLabel.values()];
}

function ensureToastLayer(board) {
  let layer = board.querySelector(":scope > .strategic-mission-progress-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "strategic-mission-progress-layer";
  layer.setAttribute("aria-live", "polite");
  layer.setAttribute("aria-atomic", "true");
  board.appendChild(layer);
  return layer;
}

function showProgress(board, objective, delta) {
  const layer = ensureToastLayer(board);
  const toast = document.createElement("div");
  const completed = objective.current >= objective.target;
  toast.className = `strategic-mission-progress-toast${completed ? " strategic-mission-progress-complete" : ""}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `<small>${completed ? "OBJETIVO CONCLUÍDO" : "PROGRESSO DA MISSÃO"}</small><strong>${objective.label} ${objective.current}/${objective.target}</strong><span>${completed ? "Meta alcançada" : `+${delta}`}</span>`;
  layer.appendChild(toast);

  objective.node.classList.remove("strategic-objective-progress-pulse");
  void objective.node.offsetWidth;
  objective.node.classList.add("strategic-objective-progress-pulse");
  if (completed) objective.node.classList.add("strategic-objective-complete");

  window.setTimeout(() => toast.classList.add("strategic-mission-progress-visible"), 20);
  window.setTimeout(() => toast.classList.remove("strategic-mission-progress-visible"), 1500);
  window.setTimeout(() => toast.remove(), 1900);
  window.setTimeout(() => objective.node.classList.remove("strategic-objective-progress-pulse"), 900);
}

function renderMissionProgress() {
  const root = document.querySelector(ROOT_SELECTOR);
  const board = root?.querySelector(BOARD_SELECTOR);
  if (!root || !board) return;

  const objectives = readObjectiveRows(root);
  if (!objectives.length) return;

  if (!initialized) {
    for (const objective of objectives) {
      objectiveSnapshot.set(objective.label.toLowerCase(), objective.current);
      if (objective.current >= objective.target) objective.node.classList.add("strategic-objective-complete");
    }
    initialized = true;
    return;
  }

  for (const objective of objectives) {
    const key = objective.label.toLowerCase();
    const previous = objectiveSnapshot.get(key);
    objectiveSnapshot.set(key, objective.current);
    if (previous === undefined || objective.current <= previous) continue;
    showProgress(board, objective, objective.current - previous);
  }
}

const observer = new MutationObserver((mutations) => {
  const externalMutation = mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !target?.closest(".strategic-mission-progress-layer");
  });
  if (externalMutation) renderMissionProgress();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener("DOMContentLoaded", renderMissionProgress, { once: true });
renderMissionProgress();
