const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const KNOWN_UNITS = ["Kael", "Lyra", "Varg", "Brakk"];
let rendering = false;

function text(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function parseRosterContext(node, expectedName) {
  const value = text(node);
  if (!value) return null;
  const name = KNOWN_UNITS.find((item) => new RegExp(`\\b${item}\\b`, "i").test(value));
  const hp = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (!name || !hp || (expectedName && name !== expectedName)) return null;
  const nameIndex = value.toLowerCase().indexOf(name.toLowerCase());
  const hpIndex = value.indexOf(hp[0], Math.max(0, nameIndex));
  const between = hpIndex > nameIndex ? value.slice(nameIndex + name.length, hpIndex).trim() : "";
  const role = between.replace(/[·|]/g, " ").replace(/\s+/g, " ").trim() || "UNIDADE";
  return { name, role: role.toUpperCase(), hp: `${hp[1]}/${hp[2]}` };
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

function resolveRosterContext(root, activeName) {
  if (!activeName) return null;
  const candidates = [...root.querySelectorAll("aside div, aside button, [class*='roster'] div, [class*='roster'] button")];
  return candidates
    .map((candidate) => parseRosterContext(candidate, activeName))
    .filter(Boolean)
    .sort((a, b) => a.role.length - b.role.length)[0] || null;
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
    const context = resolveRosterContext(root, activeName);
    const card = ensureCard(root);

    if (!activeName || !unit || !context) {
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
