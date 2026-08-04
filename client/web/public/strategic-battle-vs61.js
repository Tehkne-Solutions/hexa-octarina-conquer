const LOW_VALUE_PATTERNS = [
  / selecionad[oa] em /i,
  /^(CONSTRUIR ESTRADA|MOVER UNIDADE|CONSTRUIR BASTIÃO|ATACAR) selecionado\.$/i,
];

function normalizeOpeningCopy(text) {
  if (text.includes('Abertura balanceada: nenhuma estrada começa construída.')) {
    return 'A fronteira está aberta. Nenhuma estrada foi erguida ainda.';
  }
  return text;
}

function isLowValueMessage(text) {
  return LOW_VALUE_PATTERNS.some((pattern) => pattern.test(text));
}

function renderQualityClosure() {
  const root = document.querySelector('main.strategic-slice');
  if (!root) return;

  const commandBanner = root.querySelector('.strategic-command-banner');
  if (commandBanner) {
    commandBanner.setAttribute('aria-hidden', 'true');
    commandBanner.classList.add('is-vs61-redundant');
  }

  const entries = [...root.querySelectorAll('.strategic-objectives ol li')];
  let visible = 0;
  for (const entry of entries) {
    const original = (entry.textContent || '').trim();
    const normalized = normalizeOpeningCopy(original);
    if (normalized !== original) entry.textContent = normalized;

    const lowValue = isLowValueMessage(normalized);
    const shouldShow = !lowValue && visible < 2;
    entry.classList.toggle('is-vs61-muted-log', !shouldShow);
    if (shouldShow) visible += 1;
  }

  root.dataset.gameplayQualityClosure = 'active';
}

let pending = false;
function scheduleQualityClosure() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    renderQualityClosure();
  });
}

new MutationObserver(scheduleQualityClosure).observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
});
document.addEventListener('click', scheduleQualityClosure, true);
window.addEventListener('hoc:gameplay-quality-refresh', scheduleQualityClosure);
scheduleQualityClosure();
