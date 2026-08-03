const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const UNIT_SELECTOR = ".strategic-unit";

const previous = new Map();

function unitSnapshot(board) {
  const boardRect = board.getBoundingClientRect();
  const next = new Map();
  for (const unit of board.querySelectorAll(UNIT_SELECTOR)) {
    const label = unit.getAttribute("aria-label")?.trim() ?? "";
    const match = label.match(/^(.+),\s*(\d+)\s+de vida$/i);
    if (!match) continue;
    const rect = unit.getBoundingClientRect();
    next.set(match[1], {
      hp: Number(match[2]),
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height * .38,
      owner: unit.classList.contains("owner-red") ? "red" : "blue",
    });
  }
  return next;
}

function ensureLayer(board) {
  let layer = board.querySelector(":scope > .strategic-combat-readout-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "strategic-combat-readout-layer";
  layer.setAttribute("aria-hidden", "true");
  board.appendChild(layer);
  return layer;
}

function emit(layer, entry, text, kind) {
  const readout = document.createElement("span");
  readout.className = `strategic-combat-readout is-${kind} owner-${entry.owner}`;
  readout.style.left = `${entry.x}px`;
  readout.style.top = `${entry.y}px`;
  readout.textContent = text;
  layer.appendChild(readout);
  window.setTimeout(() => readout.remove(), kind === "defeat" ? 1250 : 950);
}

function renderCombatReadout() {
  const root = document.querySelector(ROOT_SELECTOR);
  const board = root?.querySelector(BOARD_SELECTOR);
  if (!board) return;

  const current = unitSnapshot(board);
  if (previous.size === 0) {
    for (const [name, entry] of current) previous.set(name, entry);
    return;
  }

  const layer = ensureLayer(board);
  for (const [name, now] of current) {
    const before = previous.get(name);
    if (before && now.hp < before.hp) emit(layer, now, `-${before.hp - now.hp}`, "damage");
  }
  for (const [name, before] of previous) {
    if (!current.has(name)) emit(layer, before, "DERROTADO", "defeat");
  }

  previous.clear();
  for (const [name, entry] of current) previous.set(name, entry);
}

const observer = new MutationObserver(renderCombatReadout);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-label"] });
window.addEventListener("DOMContentLoaded", renderCombatReadout, { once: true });
renderCombatReadout();
