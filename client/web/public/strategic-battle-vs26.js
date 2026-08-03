const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const LOG_SELECTOR = ".strategic-objectives ol";

function activeUnitName(root) {
  const value = root.querySelector(".strategic-help > b")?.textContent?.trim() ?? "";
  return value.split("·")[0]?.trim() || "Comando de Orun";
}

function classify(message, activeUnit) {
  const normalized = message.toLowerCase();

  if (normalized.includes("atacou") || normalized.includes("atacado")) {
    const speaker = message.split(" atacou")[0]?.trim() || activeUnit;
    return { tone: "combat", label: "COMBATE", speaker };
  }
  if (normalized.includes("bastião") || normalized.includes("região fechada")) {
    return { tone: "build", label: "CONSTRUÇÃO", speaker: "Comando de Orun" };
  }
  if (normalized.includes("estrada") || normalized.includes("corredor")) {
    return { tone: "road", label: "ROTA", speaker: activeUnit };
  }
  if (normalized.includes("ocupou") || normalized.includes("mover") || normalized.includes("movimento")) {
    const speaker = message.split(" ocupou")[0]?.trim() || activeUnit;
    return { tone: "move", label: "MOVIMENTO", speaker };
  }
  if (normalized.includes("rubra") || normalized.includes("varg") || normalized.includes("brakk")) {
    return { tone: "enemy", label: "REAÇÃO INIMIGA", speaker: "Legião Rubra" };
  }
  if (normalized.includes("rodada") || normalized.includes("iniciativa")) {
    return { tone: "round", label: "RODADA", speaker: "Fronteira da Convergência" };
  }
  return { tone: "info", label: "CRÔNICA", speaker: activeUnit };
}

function ensureNarrative(board) {
  let narrative = board.querySelector(":scope > .strategic-field-narrative");
  if (narrative) return narrative;

  narrative = document.createElement("aside");
  narrative.className = "strategic-field-narrative";
  narrative.setAttribute("aria-live", "polite");
  narrative.setAttribute("aria-atomic", "true");
  narrative.innerHTML = `
    <small class="strategic-field-narrative-label"></small>
    <strong class="strategic-field-narrative-speaker"></strong>
    <p class="strategic-field-narrative-copy"></p>
  `;
  board.appendChild(narrative);
  return narrative;
}

function renderNarrative() {
  const root = document.querySelector(ROOT_SELECTOR);
  if (!root) return;
  const board = root.querySelector(BOARD_SELECTOR);
  const latest = root.querySelector(`${LOG_SELECTOR} > li:first-child`);
  if (!board || !latest) return;

  const message = latest.textContent?.trim();
  if (!message) return;

  const narrative = ensureNarrative(board);
  if (narrative.dataset.message === message) return;

  const meta = classify(message, activeUnitName(root));
  narrative.dataset.message = message;
  narrative.dataset.tone = meta.tone;
  narrative.querySelector(".strategic-field-narrative-label").textContent = meta.label;
  narrative.querySelector(".strategic-field-narrative-speaker").textContent = meta.speaker;
  narrative.querySelector(".strategic-field-narrative-copy").textContent = message;

  narrative.classList.remove("is-entering");
  void narrative.offsetWidth;
  narrative.classList.add("is-entering");
}

const observer = new MutationObserver(renderNarrative);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener("DOMContentLoaded", renderNarrative, { once: true });
renderNarrative();
