const ROOT_SELECTOR = ".strategic-slice.meta08-physical-world";
const OBJECTIVE_PATTERN = /^(Estradas|Regiões|Bastiões|Baixas Rubras)\s+(\d+)\/(\d+)$/i;
let rendering = false;

function text(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function readObjectives(root) {
  const byLabel = new Map();
  for (const node of root.querySelectorAll("div, li, span, strong")) {
    if (node.closest(".strategic-mission-progress-toast")) continue;
    const value = text(node);
    const match = value.match(OBJECTIVE_PATTERN);
    if (!match) continue;
    const label = match[1].toLowerCase();
    const candidate = {
      current: Number(match[2]),
      target: Number(match[3]),
      childCount: node.childElementCount,
    };
    const existing = byLabel.get(label);
    if (!existing || candidate.childCount < existing.childCount) byLabel.set(label, candidate);
  }
  return [...byLabel.values()];
}

function currentPhase(root) {
  const value = text(root).toUpperCase();
  if (value.includes("SEU TURNO")) return "player";
  if (root.querySelector(".strategic-enemy-turn-indicator")) return "enemy";
  if (value.includes("TURNO DA RUBRA") || value.includes("TURNO RUBRA")) return "enemy";
  return "unknown";
}

function readResult(root) {
  const result = root.querySelector(".strategic-result");
  if (!result) return null;
  const value = text(result).toUpperCase();
  if (/VIT[ÓO]RIA|VENDEU|CONQUISTOU|MISS[ÃA]O CONCLU[ÍI]DA/.test(value)) return "victory";
  if (/DERROTA|FRACASSO|MISS[ÃA]O FALHOU|RUBRA VENCEU/.test(value)) return "defeat";
  return "resolved";
}

function resolveLifecycle(root, objectives) {
  const result = readResult(root);
  const completed = objectives.filter((item) => item.target > 0 && item.current >= item.target).length;
  const total = objectives.length;
  const phase = currentPhase(root);

  if (result === "victory") return { state: "victory", label: "MISSÃO CONCLUÍDA", completed, total };
  if (result === "defeat") return { state: "defeat", label: "MISSÃO ENCERRADA", completed, total };
  if (result === "resolved") return { state: "resolved", label: "CONFRONTO RESOLVIDO", completed, total };
  if (total > 0 && completed === total) return { state: "objectives", label: "OBJETIVOS CONCLUÍDOS", completed, total };
  if (phase === "enemy") return { state: "enemy", label: "FASE RUBRA", completed, total };
  if (phase === "player") return { state: "player", label: "MISSÃO EM ANDAMENTO", completed, total };
  return { state: "starting", label: "PREPARANDO MISSÃO", completed, total };
}

function renderMissionLifecycle() {
  if (rendering) return;
  rendering = true;
  try {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;
    const dock = root.querySelector(".strategic-turn-loop-dock");
    if (!dock) return;

    const objectives = readObjectives(root);
    const lifecycle = resolveLifecycle(root, objectives);
    const progress = lifecycle.total > 0
      ? `${lifecycle.completed}/${lifecycle.total} OBJETIVOS`
      : "OBJETIVOS CARREGANDO";
    const next = `${lifecycle.label} · ${progress}`;

    if (dock.dataset.missionLifecycle !== next) dock.dataset.missionLifecycle = next;
    if (dock.dataset.missionLifecycleState !== lifecycle.state) dock.dataset.missionLifecycleState = lifecycle.state;
    if (root.dataset.missionLifecycleState !== lifecycle.state) root.dataset.missionLifecycleState = lifecycle.state;
  } finally {
    rendering = false;
  }
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !target?.closest?.(".strategic-turn-loop-dock") && target !== document.documentElement;
  });
  if (relevant) renderMissionLifecycle();
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["class", "data-phase", "data-tone"],
});
window.addEventListener("DOMContentLoaded", renderMissionLifecycle, { once: true });
renderMissionLifecycle();
