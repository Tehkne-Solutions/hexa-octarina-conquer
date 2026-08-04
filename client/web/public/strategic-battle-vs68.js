// VS68 — Campaign replay & mastery loop.
// Presentation-only: reads mission stars already rendered by the authoritative campaign catalog.
function starsCount(text) {
  return (text.match(/★/g) || []).length;
}

function annotateCampaignMastery() {
  const root = document.querySelector('.campaign-screen');
  if (!root) return;
  root.querySelectorAll('.mission-node').forEach((node) => {
    const starText = node.querySelector('small')?.textContent ?? '';
    const stars = starsCount(starText);
    const completed = stars > 0;
    const mastered = stars >= 3;
    node.dataset.vs68Mastery = mastered ? 'mastered' : completed ? 'replay' : 'fresh';

    let badge = node.querySelector('.vs68-mastery-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'vs68-mastery-badge';
      badge.setAttribute('aria-hidden', 'true');
      node.appendChild(badge);
    }

    if (mastered) badge.textContent = 'DOMINADA';
    else if (completed) badge.textContent = 'REVISITAR';
    else badge.textContent = '';
  });
}

let scheduled = false;
function scheduleMastery() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    annotateCampaignMastery();
  });
}

new MutationObserver(scheduleMastery).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('DOMContentLoaded', annotateCampaignMastery, { once: true });
scheduleMastery();
