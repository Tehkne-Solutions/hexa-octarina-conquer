const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
let rendering = false;

function text(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function parseRosterContext(node) {
  const value = text(node);
  const name = ["Kael", "Lyra", "Varg", "Brakk"].find((item) => new RegExp(`\\b${item}\\b`, "i").test(value));
  const hp = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (!name || !hp) return null;
  const afterName = value.slice(value.toLowerCase().indexOf(name.toLowerCase()) + name.length).trim();
  const role = afterName.replace(/\d+\s*\/\s*\d+.*/, "").trim().split(/\s{2,}| · /)[0] || "UNIDADE";
  return { name, role: role.toUpperCase(), hp: `${hp[1]}/${hp[2]}` };
}

function resolveRosterContext(root) {
  const focused = root.querySelector(".strategic-active-roster-focus");
  if (!focused) return null;

  let node = focused;
  const aside = focused.closest("aside");
  while (node && node !== root && node !== aside?.parentElement) {
    const parsed = parseRosterContext(node);
    if (parsed) return parsed;
    if (node === aside) break;
    node = node.parentElement;
  }

  const activeName = root.dataset.activeUnitFocus;
  if (!activeName) return null;
  const candidates = [...root.querySelectorAll("aside div, aside button, [class*='roster'] div, [class*='roster'] button")];
  return candidates
    .map((candidate) => parseRosterContext(candidate))
    .find((parsed) => parsed?.name === activeName) || null;
}

function ensureCard(root) {
  let card = root.querySelector(".strategic-active-unit-context");
  if (card) return card;
  card = document.createElement("div");
  card.className = "strategic-active-unit-context";
  card.setAttribute("aria-live", "polite");
  card.innerHTML = '<span class="strategic-active-unit-context-kicker">UNIDADE ATIVA</span><strong></strong><span class="strategic-active-unit-context-meta"></span>';
  root.appendChild(card);
  return card;
}

function placeCard(card, unit, root) {
  const rootRect = root.getBoundingClientRect();
  const rect = unit.getBoundingClientRect();
  card.style.left = `${rect.left - rootRect.left + rect.width / 2}px`;
  card.style.top = `${Math.max(10, rect.top - rootRect.top - 48)}px`;
}

function render() {
  if (rendering) return;
  rendering = true;
  try {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;
    const unit = root.querySelector(".strategic-unit.strategic-active-unit-focus");
    const context = resolveRosterContext(root);
    const card = ensureCard(root);

    if (!unit || !context) {
      card.hidden = true;
      return;
    }

    const signature = `${context.name}|${context.role}|${context.hp}`;
    if (card.dataset.signature !== signature) {
      card.querySelector("strong").textContent = context.name;
      card.querySelector(".strategic-active-unit-context-meta").textContent = `${context.role} · HP ${context.hp}`;
      card.dataset.signature = signature;
    }
    card.hidden = false;
    placeCard(card, unit, root);
  } finally {
    rendering = false;
  }
}

const observer = new MutationObserver((mutations) => {
  if (mutations.some((mutation) => !mutation.target.parentElement?.closest?.(".strategic-active-unit-context"))) render();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
window.addEventListener("resize", render);
window.addEventListener("DOMContentLoaded", render, { once: true });
render();
