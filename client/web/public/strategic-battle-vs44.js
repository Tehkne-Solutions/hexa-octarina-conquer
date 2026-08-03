const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const UNIT_ROLES = { Kael: "GUARDIÃO", Lyra: "ARQUEIRA", Varg: "BATEDOR", Brakk: "CAMPEÃO" };
const KNOWN_UNITS = Object.keys(UNIT_ROLES);
let rendering = false;

function text(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function readActiveName(root) {
  const fromDataset = root.dataset.activeUnitFocus;
  if (KNOWN_UNITS.includes(fromDataset)) return fromDataset;
  const nodes = [...root.querySelectorAll("div, span, p, strong")];
  const label = nodes.find((node) => /UNIDADE ATIVA/i.test(text(node)));
  if (!label) return null;
  let scope = label;
  for (let depth = 0; scope && depth < 4; depth += 1, scope = scope.parentElement) {
    const value = text(scope);
    const match = KNOWN_UNITS.find((name) => new RegExp(`\\b${name}\\b`, "i").test(value));
    if (match) return match;
  }
  return null;
}

function resolveUnit(root, activeName) {
  if (!activeName) return null;
  return [...root.querySelectorAll(".strategic-unit")]
    .find((node) => new RegExp(`\\b${activeName}\\b`, "i").test(text(node))) || null;
}

function readUnitHp(unit, activeName, root) {
  let node = unit;
  for (let depth = 0; node && node !== root && depth < 4; depth += 1, node = node.parentElement) {
    const value = text(node);
    if (!new RegExp(`\\b${activeName}\\b`, "i").test(value)) continue;
    const hp = value.match(/(\d+)\s*\/\s*(\d+)/);
    if (hp) return `${hp[1]}/${hp[2]}`;
  }
  return null;
}

function resolveContext(unit, activeName, root) {
  if (!unit || !activeName) return null;
  const hp = readUnitHp(unit, activeName, root);
  if (!hp) return null;
  return { name: activeName, role: UNIT_ROLES[activeName], hp };
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
  const centerX = rect.left - rootRect.left + rect.width / 2;
  const unitTop = rect.top - rootRect.top;
  const unitBottom = rect.bottom - rootRect.top;
  const placeBelow = unitTop < 130;
  card.dataset.anchor = placeBelow ? "below" : "above";
  card.style.left = `${Math.max(82, Math.min(rootRect.width - 82, centerX))}px`;
  card.style.top = `${placeBelow ? unitBottom + 14 : Math.max(64, unitTop - 14)}px`;
}

function render() {
  if (rendering) return;
  rendering = true;
  try {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;
    const activeName = readActiveName(root);
    const unit = resolveUnit(root, activeName);
    const context = resolveContext(unit, activeName, root);
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
