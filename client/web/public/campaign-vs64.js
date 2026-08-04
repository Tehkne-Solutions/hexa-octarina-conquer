const PROFILES = [
  { id: 'fortification', label: 'FORTIFICAÇÃO', hint: 'Consolide posições e estruturas.', terms: ['fortifica', 'fortaleza', 'basti', 'estrutura'] },
  { id: 'pressure', label: 'PRESSÃO', hint: 'Converta confronto em vantagem.', terms: ['duelo', 'derrot', 'baixa', 'advers'] },
  { id: 'tempo', label: 'RITMO', hint: 'Resolva antes que a janela se feche.', terms: ['turno', 'turnos', 'rodada', 'rodadas', 'efici'] },
  { id: 'survival', label: 'RESISTÊNCIA', hint: 'Preserve seus heróis sob pressão.', terms: ['hp', 'preserve', 'sobreviv', 'perder'] },
  { id: 'conquest', label: 'CONQUISTA', hint: 'Controle território e feche regiões.', terms: ['célula', 'celula', 'territ', 'região', 'regiao', 'controle', 'núcleo', 'nucleo'] },
];

function normalize(text) {
  return text.toLocaleLowerCase('pt-BR');
}

function missionProfiles(root) {
  const objectiveText = [...root.querySelectorAll('.briefing-objectives article')]
    .map((entry) => entry.textContent || '')
    .join(' · ');
  const normalized = normalize(objectiveText);
  const matches = PROFILES.filter((profile) => profile.terms.some((term) => normalized.includes(term)));
  return matches.length > 0 ? matches.slice(0, 3) : [{ id: 'strategy', label: 'ESTRATÉGIA', hint: 'Leia o campo e cumpra o objetivo principal.' }];
}

function ensureIdentity(root) {
  let surface = root.querySelector('.campaign-mission-identity');
  if (surface) return surface;
  surface = document.createElement('section');
  surface.className = 'campaign-mission-identity';
  surface.setAttribute('aria-label', 'Perfil tático da missão');
  const objectives = root.querySelector('.briefing-objectives');
  objectives?.insertAdjacentElement('beforebegin', surface);
  return surface;
}

function renderMissionIdentity() {
  const root = document.querySelector('.campaign-briefing-screen .briefing-content');
  if (!root) return;
  const surface = ensureIdentity(root);
  const profiles = missionProfiles(root);
  const signature = profiles.map((profile) => profile.id).join('|');
  if (surface.dataset.signature === signature) return;
  surface.dataset.signature = signature;
  surface.innerHTML = `
    <div class="mission-identity-heading"><small>PERFIL DA MISSÃO</small><strong>${profiles.map((profile) => profile.label).join(' · ')}</strong></div>
    <div class="mission-identity-tags">${profiles.map((profile) => `<span class="identity-${profile.id}"><b>${profile.label}</b><em>${profile.hint}</em></span>`).join('')}</div>
  `;
}

let scheduled = false;
function scheduleMissionIdentity() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderMissionIdentity();
  });
}

new MutationObserver(scheduleMissionIdentity).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
window.addEventListener('popstate', scheduleMissionIdentity);
scheduleMissionIdentity();
