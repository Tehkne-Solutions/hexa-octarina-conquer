const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const TARGET_SELECTOR = "[data-legal-target='true']";
const UNIT_SELECTOR = ".strategic-unit";
const KNOWN_UNITS = ["Kael", "Lyra", "Varg", "Brakk"];

let activeTarget = null;
let activeUnit = null;
let svg = null;
let line = null;
let originDot = null;
let targetDot = null;

function findActiveUnitName(root) {
  const candidates = [...root.querySelectorAll("aside, section, div")]
    .filter((node) => node.textContent?.includes("UNIDADE ATIVA"));
  for (const node of candidates) {
    const text = node.textContent ?? "";
    const name = KNOWN_UNITS.find((unit) => text.includes(unit));
    if (name) return name;
  }
  return null;
}

function findBoardUnit(root, name) {
  if (!name) return null;
  return [...root.querySelectorAll(UNIT_SELECTOR)]
    .find((unit) => unit.getAttribute("aria-label")?.includes(name) || unit.textContent?.includes(name)) ?? null;
}

function ensureOverlay(board) {
  if (svg?.isConnected) return svg;
  svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "strategic-action-link");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("preserveAspectRatio", "none");

  line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("class", "strategic-action-link-line");
  originDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  originDot.setAttribute("class", "strategic-action-link-origin");
  originDot.setAttribute("r", "4");
  targetDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  targetDot.setAttribute("class", "strategic-action-link-target");
  targetDot.setAttribute("r", "5");

  svg.append(line, originDot, targetDot);
  board.appendChild(svg);
  return svg;
}

function centerWithin(boardRect, rect) {
  return {
    x: rect.left - boardRect.left + rect.width / 2,
    y: rect.top - boardRect.top + rect.height / 2,
  };
}

function drawLink() {
  const board = document.querySelector(`${ROOT_SELECTOR} ${BOARD_SELECTOR}`);
  if (!board || !activeTarget || !activeUnit || !activeTarget.isConnected || !activeUnit.isConnected) {
    clearLink();
    return;
  }

  ensureOverlay(board);
  const boardRect = board.getBoundingClientRect();
  const origin = centerWithin(boardRect, activeUnit.getBoundingClientRect());
  const target = centerWithin(boardRect, activeTarget.getBoundingClientRect());

  svg.setAttribute("viewBox", `0 0 ${Math.max(1, boardRect.width)} ${Math.max(1, boardRect.height)}`);
  line.setAttribute("x1", String(origin.x));
  line.setAttribute("y1", String(origin.y));
  line.setAttribute("x2", String(target.x));
  line.setAttribute("y2", String(target.y));
  originDot.setAttribute("cx", String(origin.x));
  originDot.setAttribute("cy", String(origin.y));
  targetDot.setAttribute("cx", String(target.x));
  targetDot.setAttribute("cy", String(target.y));
  svg.dataset.visible = "true";
  activeUnit.dataset.actionLinkOrigin = "true";
}

function clearLink() {
  if (activeUnit) delete activeUnit.dataset.actionLinkOrigin;
  activeTarget = null;
  activeUnit = null;
  if (svg) delete svg.dataset.visible;
}

function activateFor(target) {
  const root = document.querySelector(ROOT_SELECTOR);
  if (!root || !(target instanceof Element)) return;
  const legalTarget = target.closest(TARGET_SELECTOR);
  if (!legalTarget || !root.contains(legalTarget)) return;
  const activeName = findActiveUnitName(root);
  const unit = findBoardUnit(root, activeName);
  if (!unit) return;
  activeTarget = legalTarget;
  activeUnit = unit;
  drawLink();
}

function shouldClear(event) {
  if (!(event.target instanceof Element)) return false;
  const legalTarget = event.target.closest(TARGET_SELECTOR);
  if (!legalTarget || legalTarget !== activeTarget) return false;
  return !(event.relatedTarget instanceof Node) || !legalTarget.contains(event.relatedTarget);
}

document.addEventListener("pointerover", (event) => activateFor(event.target), true);
document.addEventListener("focusin", (event) => activateFor(event.target), true);
document.addEventListener("pointerout", (event) => { if (shouldClear(event)) clearLink(); }, true);
document.addEventListener("focusout", (event) => { if (shouldClear(event)) clearLink(); }, true);
window.addEventListener("resize", drawLink, { passive: true });
window.addEventListener("scroll", drawLink, { passive: true, capture: true });
