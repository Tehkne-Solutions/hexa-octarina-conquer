const DAMAGE_BY_UNIT = {
  Kael: 6,
  Lyra: 5,
};

function selectedAttacker() {
  const selected = document.querySelector('.strategic-unit.owner-blue.is-selected b');
  const name = (selected?.textContent || '').trim();
  const damage = DAMAGE_BY_UNIT[name];
  return damage ? { name, damage } : null;
}

function targetHp(target) {
  const text = target.querySelector('small')?.textContent || '';
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function renderCombatOpportunity() {
  const root = document.querySelector('main.strategic-slice');
  if (!root) return;

  root.querySelectorAll('.strategic-unit[data-combat-opportunity]').forEach((token) => {
    token.removeAttribute('data-combat-opportunity');
    token.classList.remove('has-combat-opportunity', 'is-lethal-opportunity');
  });

  const attacker = selectedAttacker();
  if (!attacker) return;

  root.querySelectorAll('.strategic-unit.owner-red.is-attack-target').forEach((target) => {
    const hp = targetHp(target);
    if (hp === null) return;
    const lethal = hp <= attacker.damage;
    target.dataset.combatOpportunity = lethal ? `LETAL · -${attacker.damage} HP` : `DANO · -${attacker.damage} HP`;
    target.classList.add('has-combat-opportunity');
    if (lethal) target.classList.add('is-lethal-opportunity');
  });
}

let pending = false;
function scheduleCombatOpportunity() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    renderCombatOpportunity();
  });
}

new MutationObserver(scheduleCombatOpportunity).observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['class'],
});
window.addEventListener('hoc:combat-opportunity-refresh', scheduleCombatOpportunity);
scheduleCombatOpportunity();
