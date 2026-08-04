// VS69 — Campaign Command Focus.
// Guides the next action from rendered authoritative mission state; no progression writes.
const commandFocus = () => {
  const root = document.querySelector('.campaign-screen');
  const detail = root?.querySelector('.mission-detail');
  if (!root || !detail) return;
  const nodes = [...root.querySelectorAll('.mission-node')];
  if (!nodes.length) return;
  const readStars = (node) => ((node.querySelector('small')?.textContent ?? '').match(/★/g) ?? []).length;
  const unlocked = nodes.filter((node) => !node.disabled);
  const unfinished = unlocked.find((node) => readStars(node) === 0);
  const mastery = unlocked.find((node) => {
    const count = readStars(node);
    return count > 0 && count < 3;
  });
  const allCompleted = unlocked.length > 0 && unlocked.every((node) => readStars(node) > 0);
  let state = 'advance';
  let title = 'Avance pela campanha';
  let copy = 'A próxima missão liberada ainda aguarda sua primeira vitória.';
  if (!unfinished && mastery) {
    state = 'mastery';
    title = 'Refine seu domínio';
    copy = 'Todas as frentes abertas foram vencidas. Revisitе uma missão incompleta para buscar três estrelas.';
  } else if (allCompleted && !mastery) {
    state = 'complete';
    title = 'Domínio das frentes abertas';
    copy = 'Todas as missões atualmente disponíveis foram dominadas com três estrelas.';
  }
  let panel = detail.querySelector('.vs69-command-focus');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'vs69-command-focus';
    detail.prepend(panel);
  }
  panel.dataset.state = state;
  panel.innerHTML = `<span class="vs69-command-focus__eyebrow">ORDEM DO CONSELHO</span><strong class="vs69-command-focus__title">${title}</strong><span class="vs69-command-focus__copy">${copy}</span>`;
};
const vs69Observer = new MutationObserver(() => requestAnimationFrame(commandFocus));
vs69Observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', commandFocus, { once: true });
