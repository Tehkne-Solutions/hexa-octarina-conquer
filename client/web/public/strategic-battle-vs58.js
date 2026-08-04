function textOf(selector, root = document) {
  return (root.querySelector(selector)?.textContent || '').trim();
}

function actionCount(root) {
  const resource = [...root.querySelectorAll('.strategic-resources span')]
    .map((entry) => entry.textContent || '')
    .find((text) => text.includes('✦')) || '';
  const match = resource.match(/✦\s*(\d+)\s*\/\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function selectedOpportunity(root) {
  const lethal = root.querySelector('.strategic-unit.owner-red.is-lethal-opportunity');
  if (lethal) return { level: 90, label: 'FINALIZAR', detail: lethal.dataset.combatOpportunity || 'Ataque letal disponível' };
  const damage = root.querySelector('.strategic-unit.owner-red.has-combat-opportunity');
  if (damage) return { level: 70, label: 'PRESSIONAR', detail: damage.dataset.combatOpportunity || 'Ataque disponível' };
  return null;
}

function selectedThreat(root) {
  const selected = root.querySelector('.strategic-unit.owner-blue.is-selected');
  if (!selected) return null;
  if (selected.classList.contains('is-lethal-threat')) {
    return { level: 100, label: 'PRESERVAR', detail: selected.dataset.threatConsequence || 'Risco letal imediato' };
  }
  if (selected.classList.contains('has-threat-consequence')) {
    return { level: 80, label: 'PROTEGER', detail: selected.dataset.threatConsequence || 'Unidade sob ameaça' };
  }
  return null;
}

function territorialPriority(root) {
  const mode = root.querySelector('.strategic-command-banner')?.className || '';
  const instruction = textOf('.strategic-command-banner span', root);
  if (mode.includes('mode-structure')) return { level: 60, label: 'FORTIFICAR', detail: instruction || 'Consolidar região fechada' };
  if (mode.includes('mode-road')) return { level: 45, label: 'EXPANDIR', detail: instruction || 'Abrir corredor estratégico' };
  if (mode.includes('mode-move')) return { level: 40, label: 'REPOSICIONAR', detail: instruction || 'Ocupar posição útil' };
  return null;
}

function ensureSurface(root) {
  let surface = root.querySelector('.strategic-decision-priority');
  if (surface) return surface;
  surface = document.createElement('aside');
  surface.className = 'strategic-decision-priority';
  surface.setAttribute('aria-live', 'polite');
  surface.innerHTML = '<small>LEITURA TÁTICA</small><strong></strong><span></span>';
  root.querySelector('.strategic-board')?.appendChild(surface);
  return surface;
}

function renderDecisionPriority() {
  const root = document.querySelector('main.strategic-slice');
  if (!root) return;
  const surface = ensureSurface(root);
  const actions = actionCount(root);
  const candidates = [selectedThreat(root), selectedOpportunity(root), territorialPriority(root)].filter(Boolean);
  const priority = candidates.sort((a, b) => b.level - a.level)[0] || null;

  surface.classList.remove('is-critical', 'is-offense', 'is-territory', 'is-spent');
  if (actions === 0) {
    surface.querySelector('strong').textContent = 'ENCERRAR TURNO';
    surface.querySelector('span').textContent = 'Sem ações restantes nesta rodada.';
    surface.classList.add('is-spent');
    return;
  }
  if (!priority) {
    surface.querySelector('strong').textContent = 'AVALIAR CAMPO';
    surface.querySelector('span').textContent = actions === null ? 'Escolha a próxima ação.' : `${actions} ações disponíveis.`;
    return;
  }

  surface.querySelector('strong').textContent = priority.label;
  surface.querySelector('span').textContent = priority.detail;
  if (priority.level >= 80) surface.classList.add('is-critical');
  else if (priority.level >= 70) surface.classList.add('is-offense');
  else surface.classList.add('is-territory');
}

let pending = false;
function scheduleDecisionPriority() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    renderDecisionPriority();
  });
}

new MutationObserver(scheduleDecisionPriority).observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['class', 'data-combat-opportunity', 'data-threat-consequence'],
});
document.addEventListener('click', scheduleDecisionPriority, true);
window.addEventListener('hoc:decision-priority-refresh', scheduleDecisionPriority);
scheduleDecisionPriority();
