const ROOT = ".strategic-slice.meta08-physical-world";

function nearestUnit(board, readout) {
  const x = Number.parseFloat(readout.style.left || "0");
  const y = Number.parseFloat(readout.style.top || "0");
  let best = null;
  let distance = Number.POSITIVE_INFINITY;
  const boardRect = board.getBoundingClientRect();
  for (const unit of board.querySelectorAll(".strategic-unit")) {
    const rect = unit.getBoundingClientRect();
    const ux = rect.left - boardRect.left + rect.width / 2;
    const uy = rect.top - boardRect.top + rect.height * .38;
    const d = Math.hypot(ux - x, uy - y);
    if (d < distance) { distance = d; best = unit; }
  }
  return best;
}

function pulse(element, className, ms = 760) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), ms);
}

function resolveCombatSequence() {
  const root = document.querySelector(ROOT);
  const board = root?.querySelector(".strategic-board");
  if (!root || !board) return;

  for (const readout of board.querySelectorAll(".strategic-combat-readout:not([data-vs30-resolved])")) {
    readout.dataset.vs30Resolved = "true";
    if (readout.classList.contains("is-damage")) {
      pulse(nearestUnit(board, readout), "strategic-hit-react");
      pulse(board, "strategic-combat-impact", 520);
    }
    if (readout.classList.contains("is-defeat")) {
      pulse(root.querySelector(".strategic-progress > div:last-child"), "strategic-objective-confirm", 900);
      pulse(board, "strategic-defeat-resolved", 900);
    }
  }

  const result = board.querySelector(".strategic-result");
  if (result && result.dataset.vs30Resolved !== "true") {
    result.dataset.vs30Resolved = "true";
    board.classList.add("strategic-match-resolved");
    result.classList.add("strategic-result-resolving");
  }
}

const observer = new MutationObserver(resolveCombatSequence);
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
window.addEventListener("DOMContentLoaded", resolveCombatSequence, { once: true });
resolveCombatSequence();
