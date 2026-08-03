const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const TARGET_SELECTOR = "[data-legal-target='true']";
const TOUCH_CLASS = "strategic-touch-intent";
let clearTimer = 0;

function isTouchPointer(event) {
  return event.pointerType === "touch" || event.pointerType === "pen";
}

function ensureTouchIntent(board) {
  let node = board.querySelector(":scope > .strategic-touch-intent-feedback");
  if (node) return node;
  node = document.createElement("div");
  node.className = "strategic-touch-intent-feedback";
  node.setAttribute("aria-live", "polite");
  node.setAttribute("aria-hidden", "true");
  node.innerHTML = "<span class='strategic-touch-intent-kicker'>AÇÃO</span><strong></strong>";
  board.appendChild(node);
  return node;
}

function clearTouchIntent(board) {
  window.clearTimeout(clearTimer);
  board.querySelectorAll(`.${TOUCH_CLASS}`).forEach((target) => target.classList.remove(TOUCH_CLASS));
  const feedback = board.querySelector(":scope > .strategic-touch-intent-feedback");
  if (feedback) {
    feedback.classList.remove("is-visible");
    feedback.setAttribute("aria-hidden", "true");
  }
}

function showTouchIntent(target) {
  const board = target.closest(BOARD_SELECTOR);
  if (!board) return;
  clearTouchIntent(board);
  const feedback = ensureTouchIntent(board);
  const label = (target.getAttribute("aria-label") || target.textContent || "AÇÃO DISPONÍVEL").trim().replace(/\s+/g, " ").slice(0, 48);
  target.classList.add(TOUCH_CLASS);
  feedback.querySelector("strong").textContent = label;
  feedback.classList.add("is-visible");
  feedback.setAttribute("aria-hidden", "false");
  clearTimer = window.setTimeout(() => clearTouchIntent(board), 900);
}

function onPointerDown(event) {
  if (!isTouchPointer(event)) return;
  const target = event.target.closest?.(TARGET_SELECTOR);
  if (!target) return;
  showTouchIntent(target);
}

function onPointerCancel(event) {
  if (!isTouchPointer(event)) return;
  const board = event.target.closest?.(BOARD_SELECTOR) || document.querySelector(BOARD_SELECTOR);
  if (board) clearTouchIntent(board);
}

document.addEventListener("pointerdown", onPointerDown, true);
document.addEventListener("pointercancel", onPointerCancel, true);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  const board = document.querySelector(BOARD_SELECTOR);
  if (board) clearTouchIntent(board);
});
