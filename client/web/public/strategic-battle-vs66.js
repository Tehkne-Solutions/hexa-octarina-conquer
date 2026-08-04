// VS66 — Campaign chapter completion & milestone identity.
// Reads rendered authoritative mission progress only; never changes progression.
const annotateChapterMilestones = () => {
  const root = document.querySelector('.campaign-screen');
  if (!root) return;
  root.querySelectorAll('.chapter-section').forEach((section) => {
    const nodes = [...section.querySelectorAll('.mission-node')];
    if (!nodes.length) return;
    const completed = nodes.filter((node) => {
      const stars = node.querySelector('small')?.textContent ?? '';
      return stars.includes('★');
    }).length;
    const total = nodes.length;
    const complete = completed === total;
    section.dataset.vs66Complete = String(complete);
    const heading = section.querySelector('.chapter-heading');
    if (!heading) return;
    let milestone = section.querySelector('.vs66-milestone');
    if (!milestone) {
      milestone = document.createElement('div');
      milestone.className = 'vs66-milestone';
      heading.insertAdjacentElement('afterend', milestone);
    }
    milestone.dataset.complete = String(complete);
    milestone.style.setProperty('--vs66-progress', `${Math.round((completed / total) * 100)}%`);
    milestone.innerHTML = `
      <div class="vs66-milestone__title"><span>MARCO DO CAPÍTULO</span><b>${completed}/${total}</b></div>
      <div class="vs66-milestone__track"><i></i></div>
      <div class="vs66-milestone__copy"><span>${complete ? 'Domínio consolidado' : 'Complete as missões para consolidar este domínio'}</span><strong>${complete ? 'Selo de conquista registrado' : `${total - completed} missão(ões) restante(s)`}</strong></div>`;
  });
};
const observer = new MutationObserver(() => requestAnimationFrame(annotateChapterMilestones));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', annotateChapterMilestones, { once: true });
