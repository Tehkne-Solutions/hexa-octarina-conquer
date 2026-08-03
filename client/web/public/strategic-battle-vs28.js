const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const NARRATIVE_SELECTOR = ".strategic-field-narrative";

function eventKind(message) {
  const value = message.toLowerCase();
  if (value.includes("atacou") || value.includes("atacado") || value.includes("dano")) return "impact";
  if (value.includes("derrot") || value.includes("eliminad")) return "defeat";
  if (value.includes("bastião") || value.includes("região fechada")) return "build";
  if (value.includes("estrada") || value.includes("corredor")) return "road";
  if (value.includes("ocupou") || value.includes("movimento") || value.includes("moveu")) return "move";
  return null;
}

function ensureFxLayer(board) {
  let layer = board.querySelector(":scope > .strategic-action-fx-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "strategic-action-fx-layer";
  layer.setAttribute("aria-hidden", "true");
  board.appendChild(layer);
  return layer;
}

function actorToken(root, speaker) {
  if (!speaker) return null;
  const tokens = [...root.querySelectorAll(".strategic-unit-token")];
  return tokens.find((token) => token.getAttribute("aria-label")?.includes(speaker)) ?? null;
}

function pulseToken(token, kind) {
  if (!token) return;
  token.dataset.actionFx = kind;
  token.classList.remove("strategic-action-pulse");
  void token.offsetWidth;
  token.classList.add("strategic-action-pulse");
  window.setTimeout(() => {
    token.classList.remove("strategic-action-pulse");
    delete token.dataset.actionFx;
  }, 760);
}

function emitFx(layer, kind, token) {
  const fx = document.createElement("span");
  fx.className = `strategic-action-fx strategic-action-fx-${kind}`;
  const boardRect = layer.parentElement.getBoundingClientRect();
  const tokenRect = token?.getBoundingClientRect();
  const x = tokenRect ? tokenRect.left - boardRect.left + tokenRect.width / 2 : boardRect.width / 2;
  const y = tokenRect ? tokenRect.top - boardRect.top + tokenRect.height / 2 : boardRect.height / 2;
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  fx.innerHTML = kind === "impact" ? "<i></i><i></i><i></i>" : kind === "road" ? "<i></i><i></i>" : "<i></i>";
  layer.appendChild(fx);
  window.setTimeout(() => fx.remove(), 900);
}

function renderActionFeedback() {
  const root = document.querySelector(ROOT_SELECTOR);
  const board = root?.querySelector(BOARD_SELECTOR);
  const narrative = board?.querySelector(NARRATIVE_SELECTOR);
  if (!root || !board || !narrative) return;

  const message = narrative.dataset.message?.trim();
  if (!message || board.dataset.actionFxMessage === message) return;
  const kind = eventKind(message);
  board.dataset.actionFxMessage = message;
  if (!kind) return;

  const speaker = narrative.querySelector(".strategic-field-narrative-speaker")?.textContent?.trim();
  const token = actorToken(root, speaker);
  const layer = ensureFxLayer(board);
  pulseToken(token, kind);
  emitFx(layer, kind, token);

  board.dataset.actionFx = kind;
  window.setTimeout(() => {
    if (board.dataset.actionFx === kind) delete board.dataset.actionFx;
  }, 760);
}

const observer = new MutationObserver(renderActionFeedback);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-message"] });
window.addEventListener("DOMContentLoaded", renderActionFeedback, { once: true });
renderActionFeedback();
