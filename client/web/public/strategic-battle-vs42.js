const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BUDGET_SELECTOR = ".strategic-turn-loop-budget";
let previousBudget = null;
let previousPhase = null;
let initialized = false;

function normalizedText(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function readPhase(root) {
  const text = normalizedText(root).toUpperCase();
  if (text.includes("SEU TURNO")) return "player";
  if (root.querySelector(".strategic-enemy-turn-indicator") || text.includes("FASE RUBRA")) return "enemy";
  return "unknown";
}

function readBudget(root) {
  const text = normalizedText(root.querySelector(BUDGET_SELECTOR)).toUpperCase();
  const labels = ["ESTRADA", "MOVER", "BASTIÃO", "ATACAR"];
  const result = {};
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s+(\\d+)`, "i"));
    if (match) result[label] = Number(match[1]);
  }
  return Object.keys(result).length === labels.length ? result : null;
}

function totalBudget(budget) {
  return budget ? Object.values(budget).reduce((sum, value) => sum + value, 0) : 0;
}

function ensureFeedback(root) {
  let node = root.querySelector(":scope > .strategic-turn-renewal-feedback");
  if (node) return node;
  node = document.createElement("div");
  node.className = "strategic-turn-renewal-feedback";
  node.setAttribute("aria-live", "polite");
  node.setAttribute("aria-hidden", "true");
  node.innerHTML = '<span>NOVO TURNO</span><strong>AÇÕES RENOVADAS</strong>';
  root.appendChild(node);
  return node;
}

function showRenewal(root) {
  const node = ensureFeedback(root);
  node.setAttribute("aria-hidden", "false");
  node.classList.remove("is-visible");
  void node.offsetWidth;
  node.classList.add("is-visible");
  window.setTimeout(() => {
    node.classList.remove("is-visible");
    node.setAttribute("aria-hidden", "true");
  }, 1400);
}

function renderTurnRenewal() {
  const root = document.querySelector(ROOT_SELECTOR);
  if (!root) return;
  const phase = readPhase(root);
  const budget = readBudget(root);
  if (!budget) return;

  if (!initialized) {
    previousPhase = phase;
    previousBudget = budget;
    initialized = true;
    return;
  }

  const returnedToPlayer = previousPhase === "enemy" && phase === "player";
  const budgetIncreased = totalBudget(budget) > totalBudget(previousBudget);
  if (returnedToPlayer && budgetIncreased) showRenewal(root);

  previousPhase = phase;
  previousBudget = budget;
}

const observer = new MutationObserver(renderTurnRenewal);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "data-phase"] });
window.addEventListener("DOMContentLoaded", renderTurnRenewal, { once: true });
renderTurnRenewal();
