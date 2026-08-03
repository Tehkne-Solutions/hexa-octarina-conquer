const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const TARGET_SELECTOR = "[data-legal-target='true']";

function normalizedText(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function currentAction(root) {
  const dock = root.querySelector(".strategic-turn-loop-dock");
  const dockText = normalizedText(dock).toUpperCase();
  for (const label of ["CONSTRUIR ESTRADA", "MOVER", "BASTIÃO", "ATACAR"]) {
    if (dockText.includes(label)) return label;
  }
  const active = normalizedText(root.querySelector(".strategic-active-unit")).toUpperCase();
  for (const label of ["CONSTRUIR ESTRADA", "MOVER", "BASTIÃO", "ATACAR"]) {
    if (active.includes(label)) return label;
  }
  return null;
}

function ensureGuide(board) {
  let guide = board.querySelector(":scope > .strategic-action-options-guide");
  if (guide) return guide;
  guide = document.createElement("div");
  guide.className = "strategic-action-options-guide";
  guide.setAttribute("aria-live", "polite");
  guide.setAttribute("aria-atomic", "true");
  guide.innerHTML = '<span class="strategic-action-options-kicker">AÇÃO ATIVA</span><strong></strong><small></small>';
  board.appendChild(guide);
  return guide;
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function renderActionOptions() {
  const root = document.querySelector(ROOT_SELECTOR);
  const board = root?.querySelector(BOARD_SELECTOR);
  if (!root || !board) return;

  const action = currentAction(root);
  const targets = [...board.querySelectorAll(TARGET_SELECTOR)]
    .filter((node) => !node.closest(".strategic-action-options-guide"));
  const guide = ensureGuide(board);
  const result = root.querySelector(".strategic-result");
  const enemyPhase = root.querySelector(".strategic-enemy-turn-indicator");
  const shouldShow = Boolean(action && targets.length && !result && !enemyPhase);

  guide.hidden = !shouldShow;
  if (!shouldShow) return;

  const countLabel = targets.length === 1 ? "1 OPÇÃO DISPONÍVEL" : `${targets.length} OPÇÕES DISPONÍVEIS`;
  setText(guide.querySelector("strong"), action);
  setText(guide.querySelector("small"), `${countLabel} · escolha um alvo destacado no mapa`);
  guide.dataset.optionCount = String(targets.length);
  guide.dataset.action = action.toLowerCase().replace(/\s+/g, "-");
}

function shouldRender(mutations) {
  return mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !target?.closest(".strategic-action-options-guide");
  });
}

const observer = new MutationObserver((mutations) => {
  if (shouldRender(mutations)) renderActionOptions();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-legal-target", "class", "hidden", "disabled", "aria-disabled"] });
window.addEventListener("DOMContentLoaded", renderActionOptions, { once: true });
renderActionOptions();
