function count(root, selector) {
  return root.querySelectorAll(selector).length;
}

function terminalRequirements(root, faction) {
  const enemy = faction === 'blue' ? 'red' : 'blue';
  const cells = count(root, `.strategic-cell.owner-${faction}`);
  const structures = count(root, `.strategic-structure.owner-${faction}`);
  const casualties = count(root, `.strategic-roster-card.owner-${enemy}:disabled`);
  return {
    cells,
    structures,
    casualties,
    checks: [
      { done: cells >= 2, label: faction === 'blue' ? 'DOMINAR 2 REGIÕES' : 'RUBRA DOMINAR 2 REGIÕES' },
      { done: structures >= 1, label: faction === 'blue' ? 'ERGUER 1 BASTIÃO' : 'RUBRA ERGUER 1 TORRE' },
      { done: casualties >= 1, label: faction === 'blue' ? 'CAUSAR 1 BAIXA RUBRA' : 'SOFRER 1 BAIXA ORUN' },
    ],
  };
}

function remaining(requirements) {
  return requirements.checks.filter((entry) => !entry.done);
}

function ensurePressureSurface(root) {
  let surface = root.querySelector('.strategic-endgame-pressure');
  if (surface) return surface;
  surface = document.createElement('div');
  surface.className = 'strategic-endgame-pressure';
  surface.setAttribute('aria-live', 'polite');
  surface.innerHTML = '<small>PRESSÃO DE DESFECHO</small><strong></strong><span></span>';
  const objectives = root.querySelector('.strategic-objectives');
  objectives?.insertBefore(surface, objectives.querySelector('.strategic-end-turn'));
  return surface;
}

function renderEndgamePressure() {
  const root = document.querySelector('main.strategic-slice');
  if (!root) return;
  const surface = ensurePressureSurface(root);
  const result = root.querySelector('.strategic-result');
  if (result) {
    surface.hidden = true;
    return;
  }

  const blue = remaining(terminalRequirements(root, 'blue'));
  const red = remaining(terminalRequirements(root, 'red'));
  surface.classList.remove('is-orun-pressure', 'is-rubra-pressure', 'is-dual-pressure');

  if (blue.length === 1 && red.length === 1) {
    surface.hidden = false;
    surface.classList.add('is-dual-pressure');
    surface.querySelector('strong').textContent = 'DESFECHO ABERTO';
    surface.querySelector('span').textContent = `Orun: ${blue[0].label} · Rubra: ${red[0].label}`;
    return;
  }

  if (red.length === 1) {
    surface.hidden = false;
    surface.classList.add('is-rubra-pressure');
    surface.querySelector('strong').textContent = 'RUBRA A 1 CONDIÇÃO';
    surface.querySelector('span').textContent = red[0].label;
    return;
  }

  if (blue.length === 1) {
    surface.hidden = false;
    surface.classList.add('is-orun-pressure');
    surface.querySelector('strong').textContent = 'ORUN A 1 CONDIÇÃO';
    surface.querySelector('span').textContent = blue[0].label;
    return;
  }

  surface.hidden = true;
}

let pending = false;
function scheduleEndgamePressure() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    renderEndgamePressure();
  });
}

new MutationObserver(scheduleEndgamePressure).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['class', 'disabled'],
});
document.addEventListener('click', scheduleEndgamePressure, true);
window.addEventListener('hoc:endgame-pressure-refresh', scheduleEndgamePressure);
scheduleEndgamePressure();
