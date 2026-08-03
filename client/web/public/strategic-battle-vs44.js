const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const UNIT_ROLES = { Kael: "GUARDIÃO", Lyra: "ARQUEIRA", Varg: "BATEDOR", Brakk: "CAMPEÃO" };
const KNOWN_UNITS = Object.keys(UNIT_ROLES);
let rendering = false;

function text(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function exactName(value, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}($|\\s)`, "i").test(value);
}

function readActiveName(root) {
  const fromDataset = root.dataset.activeUnitFocus;
  if (KNOWN_UNITS.includes(fromDataset)) return fromDataset;
  const label = [...root.querySelectorAll("div, span, p, strong")]
    .find((node) => /UNIDADE ATIVA/i.test(text(node)));
  if (!label) return null;
  let scope = label;
  for (let depth = 0; scope && depth < 4; depth += 1, scope = scope.parentElement) {
    const value = text(scope);
    const match = KNOWN_UNITS.find((name) => exactName(value, name));
    if (match) return match;
  }
  return null;
}

function resolvePanel(root, activeName) {
  if (!activeName) return null;
  return [...root.querySelectorAll("div, section, article")]
    .filter((node) => !node.closest(".strategic-active-unit-inline-context"))
    .map((node) => ({ node, value: text(node) }))
    .filter(({ value }) => value.length <= 220 && /UNIDADE ATIVA/i.test(value) && exactName(value, activeName))
    .sort((a, b) => a.value.length - b.value.length)[0]?.node || null;
}

function resolveHp(root, activeName) {
  if (!activeName) return null;
  const candidates = [...root.querySelectorAll("div, button, li, section")]
    .filter((node) => !node.closest(".strategic-active-unit-inline-context"))
    .map((node) => ({ node, value: text(node) }))
    .filter(({ value }) => value.length > 0 && value.length <= 120 && exactName(value, activeName) && /\d+\s*\/\s*\d+/.test(value))
    .sort((a, b) => a.value.length - b.value.length);
  const hp = candidates[0]?.value.match(/(\d+)\s*\/\s*(\d+)/);
  return hp ? `${hp[1]}/${hp[2]}` : null;
}

function ensureInline(panel) {
  let meta = panel.querySelector(":scope > .strategic-active-unit-inline-context");
  if (meta) return meta;
  meta = document.createElement("div");
  meta.className = "strategic-active-unit-inline-context";
  meta.setAttribute("aria-live", "polite");
  panel.appendChild(meta);
  return meta;
}

function render() {
  if (rendering) return;
  rendering = true;
  try {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;
    const activeName = readActiveName(root);
    const panel = resolvePanel(root, activeName);
    if (!activeName || !panel) return;
    const hp = resolveHp(root, activeName);
    const meta = ensureInline(panel);
    const next = `${UNIT_ROLES[activeName]} · HP ${hp || "—"}`;
    if (meta.textContent !== next) meta.textContent = next;
  } finally {
    rendering = false;
  }
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !target?.closest?.(".strategic-active-unit-inline-context");
  });
  if (relevant) render();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener("DOMContentLoaded", render, { once: true });
render();
