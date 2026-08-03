const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const ACTIVE_CLASS = "strategic-active-unit-focus";
const ACTIVE_ROSTER_CLASS = "strategic-active-roster-focus";
let rendering = false;

function normalizedText(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function readActiveUnitName(root) {
  const nodes = [...root.querySelectorAll("div, span, p, strong")];
  const label = nodes.find((node) => /UNIDADE ATIVA/i.test(normalizedText(node)));
  if (!label) return null;
  const scope = label.closest("div") || label.parentElement;
  const text = normalizedText(scope);
  const direct = text.match(/UNIDADE ATIVA\s*[:·-]?\s*([A-Za-zÀ-ÿ' -]+?)(?=\s+(?:PRÓXIMA AÇÃO|ESTRADA|MOVER|BASTIÃO|ATACAR)|$)/i);
  if (direct?.[1]) return direct[1].trim();
  const known = ["Kael", "Lyra", "Varg", "Brakk"];
  return known.find((name) => text.toLowerCase().includes(name.toLowerCase())) || null;
}

function clearFocus(root) {
  root.querySelectorAll(`.${ACTIVE_CLASS}`).forEach((node) => node.classList.remove(ACTIVE_CLASS));
  root.querySelectorAll(`.${ACTIVE_ROSTER_CLASS}`).forEach((node) => node.classList.remove(ACTIVE_ROSTER_CLASS));
}

function exactNameMatch(node, name) {
  const text = normalizedText(node).toLowerCase();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped.toLowerCase()}($|\\s)`, "i").test(text);
}

function renderActiveUnitFocus() {
  if (rendering) return;
  rendering = true;
  try {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;
    const activeName = readActiveUnitName(root);
    const previous = root.dataset.activeUnitFocus || "";
    if (previous === (activeName || "")) return;

    clearFocus(root);
    if (!activeName) {
      delete root.dataset.activeUnitFocus;
      return;
    }

    const units = [...root.querySelectorAll(".strategic-unit")];
    const unit = units.find((node) => exactNameMatch(node, activeName));
    if (unit) unit.classList.add(ACTIVE_CLASS);

    const candidates = [...root.querySelectorAll("aside div, aside button, [class*='roster'] div, [class*='roster'] button")];
    const roster = candidates
      .filter((node) => exactNameMatch(node, activeName))
      .sort((a, b) => a.childElementCount - b.childElementCount)[0];
    if (roster) roster.classList.add(ACTIVE_ROSTER_CLASS);

    root.dataset.activeUnitFocus = activeName;
  } finally {
    rendering = false;
  }
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !target?.closest(`.${ACTIVE_CLASS}, .${ACTIVE_ROSTER_CLASS}`);
  });
  if (relevant) renderActiveUnitFocus();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener("DOMContentLoaded", renderActiveUnitFocus, { once: true });
renderActiveUnitFocus();
