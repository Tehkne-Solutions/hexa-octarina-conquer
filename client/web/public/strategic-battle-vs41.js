const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BUDGET_SELECTOR = ".strategic-turn-loop-budget";
let lastReady = null;

function parseBudget(text) {
  const labels = ["ESTRADA", "MOVER", "BASTIÃO", "ATACAR"];
  const upper = (text || "").toUpperCase();
  const values = {};
  for (const label of labels) {
    const match = upper.match(new RegExp(`${label}\\s+(\\d+)`));
    if (match) values[label] = Number(match[1]);
  }
  return values;
}

function findEndTurn(root) {
  return [...root.querySelectorAll("button, [role=button]")]
    .find((node) => (node.textContent || "").replace(/\s+/g, " ").trim().toUpperCase() === "ENCERRAR TURNO") || null;
}

function ensureHint(root, button) {
  let hint = root.querySelector(".strategic-end-turn-readiness-hint");
  if (!hint) {
    hint = document.createElement("span");
    hint.className = "strategic-end-turn-readiness-hint";
    hint.setAttribute("aria-live", "polite");
    button.insertAdjacentElement("beforebegin", hint);
  }
  return hint;
}

function renderReadiness() {
  const root = document.querySelector(ROOT_SELECTOR);
  const budgetNode = root?.querySelector(BUDGET_SELECTOR);
  const button = root ? findEndTurn(root) : null;
  if (!root || !budgetNode || !button) return;

  const values = parseBudget(budgetNode.textContent);
  if (Object.keys(values).length < 4) return;
  const ready = Object.values(values).every((value) => value === 0);

  if (button.dataset.turnReady !== String(ready)) button.dataset.turnReady = String(ready);
  const hint = ensureHint(root, button);
  const nextText = ready ? "AÇÕES CONCLUÍDAS · ENCERRE O TURNO" : "";
  if (hint.textContent !== nextText) hint.textContent = nextText;
  if (hint.hidden === ready) hint.hidden = !ready;

  if (ready && lastReady === false) {
    button.classList.remove("strategic-end-turn-ready-pulse");
    void button.offsetWidth;
    button.classList.add("strategic-end-turn-ready-pulse");
    window.setTimeout(() => button.classList.remove("strategic-end-turn-ready-pulse"), 900);
  }
  lastReady = ready;
}

const observer = new MutationObserver((mutations) => {
  if (mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !target?.closest(".strategic-end-turn-readiness-hint");
  })) renderReadiness();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
window.addEventListener("DOMContentLoaded", renderReadiness, { once: true });
renderReadiness();
