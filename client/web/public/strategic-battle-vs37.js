const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const BOARD_SELECTOR = ".strategic-board";
const TARGET_SELECTOR = "[data-legal-target='true']";
const PREVIEW_CLASS = "strategic-action-confirmation";

function targetLabel(target) {
  return (target.getAttribute("aria-label") || target.textContent || "").replace(/\s+/g, " ").trim().slice(0, 72);
}

function ensurePreview(board) {
  let preview = board.querySelector(`.${PREVIEW_CLASS}`);
  if (preview) return preview;
  preview = document.createElement("div");
  preview.className = PREVIEW_CLASS;
  preview.setAttribute("aria-live", "polite");
  preview.setAttribute("aria-hidden", "true");
  preview.innerHTML = '<span class="strategic-action-confirmation-kicker">AÇÃO DISPONÍVEL</span><strong class="strategic-action-confirmation-label"></strong>';
  board.appendChild(preview);
  return preview;
}

function hidePreview(board) {
  const preview = board?.querySelector(`.${PREVIEW_CLASS}`);
  if (!preview) return;
  preview.removeAttribute("data-visible");
  preview.setAttribute("aria-hidden", "true");
}

function showPreview(target) {
  const root = target.closest(ROOT_SELECTOR);
  const board = root?.querySelector(BOARD_SELECTOR);
  if (!board || !target.matches(TARGET_SELECTOR)) return;
  const label = targetLabel(target);
  if (!label) return;

  const preview = ensurePreview(board);
  const labelNode = preview.querySelector(".strategic-action-confirmation-label");
  if (labelNode && labelNode.textContent !== label) labelNode.textContent = label;

  const boardRect = board.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const x = Math.max(90, Math.min(boardRect.width - 90, targetRect.left - boardRect.left + targetRect.width / 2));
  const y = Math.max(54, targetRect.top - boardRect.top - 12);
  preview.style.left = `${x}px`;
  preview.style.top = `${y}px`;
  preview.dataset.visible = "true";
  preview.setAttribute("aria-hidden", "false");
}

function resolveTarget(node) {
  return node instanceof Element ? node.closest(TARGET_SELECTOR) : null;
}

document.addEventListener("pointerover", (event) => {
  const target = resolveTarget(event.target);
  if (target) showPreview(target);
});

document.addEventListener("pointerout", (event) => {
  const target = resolveTarget(event.target);
  if (!target) return;
  const related = resolveTarget(event.relatedTarget);
  if (related === target) return;
  hidePreview(target.closest(BOARD_SELECTOR));
});

document.addEventListener("focusin", (event) => {
  const target = resolveTarget(event.target);
  if (target) showPreview(target);
});

document.addEventListener("focusout", (event) => {
  const target = resolveTarget(event.target);
  if (target) hidePreview(target.closest(BOARD_SELECTOR));
});

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.target instanceof Element && mutation.target.closest(`.${PREVIEW_CLASS}`)) continue;
    if (mutation.type === "attributes" && mutation.target instanceof Element && !mutation.target.matches(TARGET_SELECTOR)) {
      const board = mutation.target.closest(BOARD_SELECTOR);
      hidePreview(board);
    }
  }
});
observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-legal-target", "disabled", "aria-disabled"] });
