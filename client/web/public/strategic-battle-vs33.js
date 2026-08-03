const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";

function normalizedText(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function findByText(root, matcher) {
  return [...root.querySelectorAll("button, [role=button], div, span")].find((node) => matcher.test(normalizedText(node)));
}

function readActionBudget(root) {
  const labels = ["ESTRADA", "MOVER", "BASTIÃO", "ATACAR"];
  return labels.map((label) => {
    const node = findByText(root, new RegExp(`^${label}\\s+\\d+$`, "i"));
    const match = normalizedText(node).match(/(ESTRADA|MOVER|BASTIÃO|ATACAR)\s+(\d+)/i);
    return match ? { label: match[1].toUpperCase(), value: Number(match[2]) } : null;
  }).filter(Boolean);
}

function phaseFromDom(root) {
  const text = normalizedText(root).toUpperCase();
  if (text.includes("LEGIÃO RUBRA") || root.querySelector(".strategic-enemy-turn-indicator")) return "enemy";
  if (text.includes("SEU TURNO")) return "player";
  return "unknown";
}

function ensureDock(board) {
  let dock = board.querySelector(":scope > .strategic-turn-loop-dock");
  if (dock) return dock;
  dock = document.createElement("div");
  dock.className = "strategic-turn-loop-dock";
  dock.setAttribute("aria-live", "polite");
  dock.innerHTML = '<span class="strategic-turn-loop-phase"></span><span class="strategic-turn-loop-step"></span><span class="strategic-turn-loop-budget"></span>';
  board.appendChild(dock);
  return dock;
}

function nextAction(root) {
  const next = findByText(root, /PRÓXIMA AÇÃO/i);
  const scope = next?.closest("div") || next?.parentElement;
  const text = normalizedText(scope);
  const match = text.match(/PRÓXIMA AÇÃO\s+(.+?)(?:\s{2,}|$)/i);
  if (match?.[1]) return match[1].trim();
  const candidates = ["CONSTRUIR ESTRADA", "MOVER", "BASTIÃO", "ATACAR"];
  return candidates.find((value) => normalizedText(root).toUpperCase().includes(value)) || "ESCOLHA SUA AÇÃO";
}

function renderTurnLoop() {
  const root = document.querySelector(ROOT_SELECTOR);
  const board = root?.querySelector(BOARD_SELECTOR);
  if (!root || !board) return;

  const phase = phaseFromDom(root);
  const dock = ensureDock(board);
  const budget = readActionBudget(root);
  const endTurn = findByText(root, /^ENCERRAR TURNO$/i);
  const result = root.querySelector(".strategic-result");

  dock.dataset.phase = phase;
  dock.hidden = Boolean(result);
  dock.querySelector(".strategic-turn-loop-phase").textContent = phase === "enemy" ? "FASE RUBRA" : phase === "player" ? "SUA FASE" : "FASE";
  dock.querySelector(".strategic-turn-loop-step").textContent = phase === "enemy" ? "Acompanhe a resolução inimiga" : nextAction(root);
  dock.querySelector(".strategic-turn-loop-budget").textContent = budget.length
    ? budget.map((item) => `${item.label} ${item.value}`).join(" · ")
    : phase === "enemy" ? "AGUARDANDO RETORNO DO CONTROLE" : "ORÇAMENTO DO TURNO";

  if (endTurn) {
    endTurn.dataset.turnLoopReady = phase === "player" ? "true" : "false";
    endTurn.setAttribute("aria-describedby", "strategic-turn-loop-hint");
  }

  let hint = root.querySelector("#strategic-turn-loop-hint");
  if (!hint) {
    hint = document.createElement("span");
    hint.id = "strategic-turn-loop-hint";
    hint.className = "strategic-turn-loop-sr";
    root.appendChild(hint);
  }
  hint.textContent = phase === "player"
    ? "Conclua suas ações e encerre o turno quando estiver pronto."
    : "A Legião Rubra está resolvendo sua fase.";
}

const observer = new MutationObserver(renderTurnLoop);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "data-phase", "data-tone"] });
window.addEventListener("DOMContentLoaded", renderTurnLoop, { once: true });
renderTurnLoop();
