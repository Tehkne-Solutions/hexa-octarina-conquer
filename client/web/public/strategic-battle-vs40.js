const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const BUDGET_SELECTOR = ".strategic-turn-loop-budget";
const LABELS = ["ESTRADA", "MOVER", "BASTIÃO", "ATACAR"];
let lastBudget = null;

function parseBudget(text) {
  const normalized = (text || "").replace(/\s+/g, " ").trim().toUpperCase();
  const result = {};
  for (const label of LABELS) {
    const match = normalized.match(new RegExp(`${label}\\s+(\\d+)`, "i"));
    if (match) result[label] = Number(match[1]);
  }
  return Object.keys(result).length ? result : null;
}

function ensureFeedback(board) {
  let feedback = board.querySelector(":scope > .strategic-budget-feedback");
  if (feedback) return feedback;
  feedback = document.createElement("div");
  feedback.className = "strategic-budget-feedback";
  feedback.setAttribute("aria-live", "polite");
  feedback.hidden = true;
  board.appendChild(feedback);
  return feedback;
}

function showSpent(board, label, amount, remaining) {
  const feedback = ensureFeedback(board);
  feedback.dataset.action = label.toLowerCase();
  feedback.textContent = `${label} −${amount} · ${remaining} RESTANTE${remaining === 1 ? "" : "S"}`;
  feedback.hidden = false;
  board.dataset.budgetSpent = label.toLowerCase();
  window.clearTimeout(showSpent.timer);
  showSpent.timer = window.setTimeout(() => {
    feedback.hidden = true;
    delete board.dataset.budgetSpent;
  }, 1050);
}

function renderBudgetFeedback() {
  const root = document.querySelector(ROOT_SELECTOR);
  const board = root?.querySelector(BOARD_SELECTOR);
  const budgetNode = board?.querySelector(BUDGET_SELECTOR);
  if (!root || !board || !budgetNode) return;
  const next = parseBudget(budgetNode.textContent);
  if (!next) return;

  if (!lastBudget) {
    lastBudget = next;
    return;
  }

  for (const label of LABELS) {
    const before = lastBudget[label];
    const after = next[label];
    if (Number.isFinite(before) && Number.isFinite(after) && after < before) {
      showSpent(board, label, before - after, after);
      break;
    }
  }
  lastBudget = next;
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return Boolean(target?.closest?.(BUDGET_SELECTOR)) && !target?.closest?.(".strategic-budget-feedback");
  });
  if (relevant) renderBudgetFeedback();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener("DOMContentLoaded", renderBudgetFeedback, { once: true });
renderBudgetFeedback();
