const RUBRA_DAMAGE = {
  Varg: 5,
  Brakk: 6,
};

function pointOf(token) {
  const left = Number.parseFloat(token.style.left || '');
  const top = Number.parseFloat(token.style.top || '');
  return Number.isFinite(left) && Number.isFinite(top) ? { left, top } : null;
}

function hpOf(token) {
  const text = token.querySelector('small')?.textContent || '';
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function nameOf(token) {
  return (token.querySelector('b')?.textContent || '').trim();
}

function normalizedAngle(degrees) {
  let value = degrees % 180;
  if (value < 0) value += 180;
  return value;
}

function edgeAngle(edge) {
  const transform = edge.style.transform || '';
  const match = transform.match(/rotate\((-?[\d.]+)deg\)/);
  return match ? normalizedAngle(Number(match[1])) : null;
}

function angleDistance(a, b) {
  const delta = Math.abs(normalizedAngle(a) - normalizedAngle(b));
  return Math.min(delta, 180 - delta);
}

function hasBuiltRoadBetween(a, b, root) {
  const pa = pointOf(a);
  const pb = pointOf(b);
  if (!pa || !pb) return false;

  const midpoint = {
    left: (pa.left + pb.left) / 2,
    top: (pa.top + pb.top) / 2,
  };
  const expectedAngle = Math.atan2(pb.top - pa.top, pb.left - pa.left) * 180 / Math.PI;

  return [...root.querySelectorAll('.strategic-edge.state-road')].some((edge) => {
    const edgeLeft = Number.parseFloat(edge.style.left || '');
    const edgeTop = Number.parseFloat(edge.style.top || '');
    const angle = edgeAngle(edge);
    if (!Number.isFinite(edgeLeft) || !Number.isFinite(edgeTop) || angle === null) return false;
    return Math.abs(edgeLeft - midpoint.left) < 0.15
      && Math.abs(edgeTop - midpoint.top) < 0.15
      && angleDistance(angle, expectedAngle) < 1;
  });
}

function renderThreatReadability() {
  const root = document.querySelector('main.strategic-slice');
  if (!root) return;

  root.querySelectorAll('.strategic-unit[data-threat-consequence]').forEach((token) => {
    token.removeAttribute('data-threat-consequence');
    token.classList.remove('has-threat-consequence', 'is-lethal-threat');
  });

  const friendly = [...root.querySelectorAll('.strategic-unit.owner-blue')];
  const enemies = [...root.querySelectorAll('.strategic-unit.owner-red')];

  friendly.forEach((target) => {
    const hp = hpOf(target);
    if (hp === null) return;

    const threats = enemies
      .map((enemy) => ({ enemy, name: nameOf(enemy), damage: RUBRA_DAMAGE[nameOf(enemy)] || 0 }))
      .filter(({ enemy, damage }) => damage > 0 && hasBuiltRoadBetween(enemy, target, root))
      .sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name));

    if (threats.length === 0) return;

    const strongest = threats[0];
    const lethal = hp <= strongest.damage;
    target.dataset.threatConsequence = lethal
      ? `RISCO LETAL · ${strongest.name} -${strongest.damage} HP`
      : `AMEAÇA · ${strongest.name} -${strongest.damage} HP`;
    target.classList.add('has-threat-consequence');
    if (lethal) target.classList.add('is-lethal-threat');
  });
}

let pending = false;
function scheduleThreatReadability() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    renderThreatReadability();
  });
}

new MutationObserver(scheduleThreatReadability).observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
});
document.addEventListener('click', scheduleThreatReadability, true);
window.addEventListener('hoc:threat-readability-refresh', scheduleThreatReadability);
scheduleThreatReadability();
