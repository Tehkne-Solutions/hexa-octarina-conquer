const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";

function detectPhase(root) {
  if (!root) return null;
  const text = root.textContent?.toUpperCase() ?? "";
  if (text.includes("SEU TURNO")) return "player";
  if (text.includes("TURNO DA RUBRA") || text.includes("TURNO RUBRA") || text.includes("LEGIÃO RUBRA")) return "enemy";
  return null;
}

function ensureLayer(root) {
  let layer = root.querySelector(":scope > .strategic-phase-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "strategic-phase-layer";
  layer.setAttribute("aria-live", "polite");
  layer.setAttribute("aria-atomic", "true");
  root.appendChild(layer);
  return layer;
}

function showTransition(root, phase) {
  const layer = ensureLayer(root);
  layer.innerHTML = "";
  const card = document.createElement("div");
  card.className = `strategic-phase-card strategic-phase-${phase}`;
  card.innerHTML = phase === "player"
    ? '<span class="strategic-phase-kicker">CONTROLE RETORNOU</span><strong>SEU TURNO</strong><small>Escolha sua próxima ação.</small>'
    : '<span class="strategic-phase-kicker">MOVIMENTO ADVERSÁRIO</span><strong>LEGIÃO RUBRA</strong><small>Acompanhe a resolução inimiga.</small>';
  layer.appendChild(card);
  window.setTimeout(() => card.classList.add("strategic-phase-visible"), 20);
  window.setTimeout(() => card.classList.remove("strategic-phase-visible"), 1050);
  window.setTimeout(() => card.remove(), 1450);
}

let lastPhase = null;
let initialized = false;

function renderTurnPhase() {
  const root = document.querySelector(ROOT_SELECTOR);
  if (!root) return;
  const phase = detectPhase(root);
  if (!phase) return;
  if (!initialized) {
    initialized = true;
    lastPhase = phase;
    return;
  }
  if (phase === lastPhase) return;
  lastPhase = phase;
  showTransition(root, phase);
}

const observer = new MutationObserver(renderTurnPhase);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener("DOMContentLoaded", renderTurnPhase, { once: true });
renderTurnPhase();
