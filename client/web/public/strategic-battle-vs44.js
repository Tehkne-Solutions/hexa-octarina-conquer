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
  for (let depth = 0; scope && depth < 5; depth += 1, scope = scope.parentElement) {
    const value = text(scope);
    const match = KNOWN_UNITS.find((name) => exactName(value, name));
    if (match) return match;
  }
  return null;
}

function resolvePanel(root, activeName) {
  if (!activeName) return null;
  const labels = [...root.querySelectorAll("div, span, p, strong")]
    .filter((node) => /UNIDADE ATIVA/i.test(text(node)));

  for (const label of labels) {
    let scope = label;
    for (let depth = 0; scope && depth < 6; depth += 1, scope = scope.parentElement) {
      const value = text(scope);
      if (value.length <= 260 && /UNIDADE ATIVA/i.test(value) && exactName(value, activeName) && /PRÓXIMA AÇÃO/i.test(value)) {
        return scope;
      }
    }
  }
  return null;
}

function resolveHp(root, activeName) {
  if (!activeName) return null;
  const candidates = [...root.querySelectorAll("div, button, li, section")]
    .map((node) => ({ node, value: text(node) }))
    .filter(({ value }) => value.length > 0 && value.length <= 120 && exactName(value, activeName) && /\d+\s*\/\s*\d+/.test(value))
    .sort((a, b) => a.value.length - b.value.length);
  const hp = candidates[0]?.value.match(/(\d+)\s*\/\s*(\d+)/);
  return hp ? `${hp[1]}/${hp[2]}` : null;
}

function clearPrevious(root, current) {
  root.querySelectorAll("[data-active-unit-inline-context]").forEach((node) => {
    if (node !== current) delete node.dataset.activeUnitInlineContext;
  });
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
    const next = `STATUS · ${UNIT_ROLES[activeName]} · HP ${hp || "—"}`;
    clearPrevious(root, panel);
    if (panel.dataset.activeUnitInlineContext !== next) panel.dataset.activeUnitInlineContext = next;
  } finally {
    rendering = false;
  }
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !target?.hasAttribute?.("data-active-unit-inline-context");
  });
  if (relevant) render();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
window.addEventListener("DOMContentLoaded", render, { once: true });
render();
