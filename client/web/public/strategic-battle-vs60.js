function readEndgamePressure(root) {
  const pressure = root.querySelector('.strategic-endgame-pressure');
  if (!pressure || pressure.hidden) return null;
  const title = (pressure.querySelector('strong')?.textContent || '').trim();
  const detail = (pressure.querySelector('span')?.textContent || '').trim();
  if (!title) return null;
  const level = pressure.classList.contains('is-rubra-pressure') ? 95
    : pressure.classList.contains('is-dual-pressure') ? 88
      : 76;
  return { title, detail, level };
}

function readDecisionPriority(root) {
  const panel = root.querySelector('.strategic-decision-priority');
  if (!panel) return null;
  const title = (panel.querySelector('strong')?.textContent || '').trim();
  const detail = (panel.querySelector('span')?.textContent || '').trim();
  if (!title) return null;
  const level = panel.classList.contains('is-critical') ? 100
    : panel.classList.contains('is-offense') ? 72
      : panel.classList.contains('is-spent') ? 65
        : 50;
  return { panel, title, detail, level };
}

function latestEnemyIntent(root) {
  const token = root.querySelector('.strategic-unit.owner-red.has-enemy-intent');
  if (!token) return null;
  const name = (token.querySelector('b')?.textContent || '').trim();
  const intent = token.dataset.enemyIntent || '';
  return name && intent ? `${name}: ${intent}` : intent || null;
}

function consolidateTacticalClarity() {
  const root = document.querySelector('main.strategic-slice');
  if (!root) return;

  const pressureSurface = root.querySelector('.strategic-endgame-pressure');
  const decision = readDecisionPriority(root);
  if (!decision) return;
  const endgame = readEndgamePressure(root);
  const enemyIntent = latestEnemyIntent(root);

  const dominant = [
    endgame ? { source: 'endgame', ...endgame } : null,
    { source: 'decision', title: decision.title, detail: decision.detail, level: decision.level },
  ].filter(Boolean).sort((a, b) => b.level - a.level)[0];

  const panel = decision.panel;
  panel.classList.remove('is-endgame', 'is-consolidated');
  panel.classList.add('is-consolidated');
  panel.querySelector('small').textContent = dominant.source === 'endgame' ? 'PRESSÃO TÁTICA' : 'LEITURA TÁTICA';
  panel.querySelector('strong').textContent = dominant.title;

  const supporting = [];
  if (dominant.detail) supporting.push(dominant.detail);
  if (enemyIntent && dominant.level < 95) supporting.push(enemyIntent);
  panel.querySelector('span').textContent = supporting.join(' · ');
  if (dominant.source === 'endgame') panel.classList.add('is-endgame');

  if (pressureSurface) {
    pressureSurface.hidden = true;
    pressureSurface.setAttribute('aria-hidden', 'true');
  }
  root.dataset.tacticalClarity = dominant.source;
}

let queued = false;
function scheduleTacticalClarity() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    consolidateTacticalClarity();
  });
}

new MutationObserver(scheduleTacticalClarity).observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['class', 'hidden', 'data-enemy-intent', 'data-combat-opportunity', 'data-threat-consequence'],
});
document.addEventListener('click', scheduleTacticalClarity, true);
window.addEventListener('hoc:tactical-clarity-refresh', scheduleTacticalClarity);
scheduleTacticalClarity();
