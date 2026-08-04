const VS65_MARKER = "data-vs65-reward";

function rewardValue(text, pattern, fallback = "—") {
  return text.match(pattern)?.[1] ?? fallback;
}

function enhanceCampaignResult() {
  const result = document.querySelector(".campaign-result.victory");
  if (!result || result.hasAttribute(VS65_MARKER)) return;
  result.setAttribute(VS65_MARKER, "true");

  const text = result.textContent ?? "";
  const xp = rewardValue(text, /Recompensa:\s*([0-9.]+\s*XP)/i);
  const stars = result.querySelector(".result-stars")?.textContent?.trim() ?? "☆☆☆";
  const stats = [...result.querySelectorAll(".result-stats span")];
  const turns = stats.find((item) => /Rodadas/i.test(item.textContent ?? ""))?.querySelector("b")?.textContent?.trim() ?? "—";

  const ledger = document.createElement("div");
  ledger.className = "vs65-reward-ledger";
  ledger.setAttribute("aria-label", "Resumo das recompensas");
  ledger.innerHTML = `
    <div class="vs65-reward-card"><small>Experiência obtida</small><strong>${xp}</strong></div>
    <div class="vs65-reward-card"><small>Estrelas da missão</small><strong>${stars}</strong></div>
    <div class="vs65-reward-card"><small>Eficiência</small><strong>${turns} rodadas</strong></div>
  `;

  const actions = result.querySelector(".result-actions");
  const nextButton = actions?.querySelector(".primary-button");
  const unlock = document.createElement("div");
  unlock.className = "vs65-unlock-moment";
  unlock.innerHTML = nextButton?.textContent?.includes("Próxima missão")
    ? "<small>NOVO CAMINHO ABERTO</small><strong>Próxima missão liberada</strong><span>Seu avanço foi registrado. O próximo confronto da campanha já pode ser iniciado.</span>"
    : "<small>PROGRESSO REGISTRADO</small><strong>Recompensas consolidadas</strong><span>Seu resultado foi incorporado à campanha. Volte ao mapa para revisar estrelas, conquistas e caminhos disponíveis.</span>";

  const statsNode = result.querySelector(".result-stats");
  statsNode?.before(ledger);
  actions?.before(unlock);
}

const observer = new MutationObserver(enhanceCampaignResult);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("DOMContentLoaded", enhanceCampaignResult);
enhanceCampaignResult();
