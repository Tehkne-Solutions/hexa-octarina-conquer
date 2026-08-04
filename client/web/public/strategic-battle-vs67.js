// VS67 — Tactical debrief guidance.
// Presentation-only: derives advice from already-rendered victory data.
function vs67Number(text) {
  const match = String(text || '').match(/([0-9]+)/);
  return match ? Number(match[1]) : null;
}

function enhanceTacticalDebrief() {
  const result = document.querySelector('.campaign-result.victory');
  if (!result || result.dataset.vs67Debrief === 'true') return;

  const stats = [...result.querySelectorAll('.result-stats span')];
  const turnsText = stats.find((item) => /Rodadas/i.test(item.textContent || ''))?.textContent || '';
  const turns = vs67Number(turnsText);
  const stars = result.querySelector('.result-stars')?.textContent || '';
  const starCount = (stars.match(/★/g) || []).length;

  let title = 'AVANÇO CONSISTENTE';
  let copy = 'A missão foi concluída. Preserve a formação e avance para o próximo objetivo com os recursos consolidados.';
  let focus = 'Continuidade de campanha';

  if (starCount >= 3 && turns !== null && turns <= 8) {
    title = 'VITÓRIA DECISIVA';
    copy = 'Execução rápida e completa. O comando recomenda manter a mesma pressão tática no próximo confronto.';
    focus = 'Ritmo ofensivo';
  } else if (starCount <= 1) {
    title = 'VITÓRIA SOB CUSTO';
    copy = 'O objetivo foi cumprido, mas há margem para uma abordagem mais eficiente antes de ampliar a ofensiva.';
    focus = 'Eficiência e preservação';
  } else if (turns !== null && turns >= 12) {
    title = 'CONQUISTA PACIENTE';
    copy = 'A posição foi assegurada após um confronto prolongado. Considere acelerar a tomada de objetivos secundários.';
    focus = 'Controle de ritmo';
  }

  const panel = document.createElement('section');
  panel.className = 'vs67-tactical-debrief';
  panel.setAttribute('aria-label', 'Leitura tática pós-batalha');
  panel.innerHTML = `
    <div class="vs67-tactical-debrief__eyebrow">CONSELHO DE GUERRA</div>
    <div class="vs67-tactical-debrief__body">
      <div><strong>${title}</strong><p>${copy}</p></div>
      <span><small>FOCO RECOMENDADO</small><b>${focus}</b></span>
    </div>
  `;

  const unlock = result.querySelector('.vs65-unlock-moment');
  const actions = result.querySelector('.result-actions');
  if (unlock) unlock.insertAdjacentElement('afterend', panel);
  else if (actions) actions.insertAdjacentElement('beforebegin', panel);
  else result.appendChild(panel);

  result.dataset.vs67Debrief = 'true';
}

const vs67Observer = new MutationObserver(() => requestAnimationFrame(enhanceTacticalDebrief));
vs67Observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', enhanceTacticalDebrief, { once: true });
enhanceTacticalDebrief();
