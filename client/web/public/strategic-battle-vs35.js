const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const ACTION_PATTERN = /^(CLIQUE AQUI|CONSTRUIR|MOVER|ATACAR|BASTIÃO)$/i;
let renderingLegalTargets = false;

function normalizedText(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function isActionControl(node) {
  if (!(node instanceof HTMLElement)) return false;
  if (!ACTION_PATTERN.test(normalizedText(node))) return false;
  if (node.matches("button:disabled,[aria-disabled='true']")) return false;
  return true;
}

function renderLegalTargets() {
  if (renderingLegalTargets) return;
  renderingLegalTargets = true;
  try {
    const root = document.querySelector(ROOT_SELECTOR);
    const board = root?.querySelector(BOARD_SELECTOR);
    if (!root || !board) return;

    const candidates = [...board.querySelectorAll("button,[role='button'],[tabindex]")]
      .filter((node) => !node.closest(".strategic-turn-loop-dock,.strategic-field-narrative,.strategic-mission-progress-layer"));

    for (const node of candidates) {
      const legal = isActionControl(node);
      if (legal && node.dataset.legalTarget !== "true") node.dataset.legalTarget = "true";
      if (!legal && node.dataset.legalTarget === "true") delete node.dataset.legalTarget;
    }

    const legalCount = candidates.filter((node) => node.dataset.legalTarget === "true").length;
    if (board.dataset.legalTargetCount !== String(legalCount)) board.dataset.legalTargetCount = String(legalCount);
  } finally {
    renderingLegalTargets = false;
  }
}

function shouldRenderFromMutations(mutations) {
  return mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !target?.closest(".strategic-turn-loop-dock,.strategic-field-narrative,.strategic-mission-progress-layer");
  });
}

const observer = new MutationObserver((mutations) => {
  if (shouldRenderFromMutations(mutations)) renderLegalTargets();
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["class", "disabled", "aria-disabled", "tabindex"],
});
window.addEventListener("DOMContentLoaded", renderLegalTargets, { once: true });
renderLegalTargets();
