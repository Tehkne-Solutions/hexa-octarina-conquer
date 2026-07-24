import { useEffect, useMemo, useState } from "react";

import {
  campaignTotals,
  createCampaignJourney,
  difficultyLabel,
  flattenCampaignJourney,
  recommendedCampaignMission,
  type CampaignJourneyMission,
} from "./campaign-journey";
import type { CampaignCatalog } from "./protocol";
import type { LivingCampaignProgress } from "./unified-progress";

interface CampaignJourneyScreenProps {
  catalog: CampaignCatalog | null;
  progress: LivingCampaignProgress;
  playerName: string;
  realmStatus: "loading" | "online" | "offline";
  onBack: () => void;
  onStartLiving: () => void;
  onStartServer: (missionId: string) => void;
}

function starLine(amount: number): string {
  return [0, 1, 2].map((index) => index < amount ? "★" : "☆").join("");
}

function missionStatus(mission: CampaignJourneyMission): string {
  if (!mission.unlocked) return "Bloqueada";
  if (mission.completed) return "Concluída";
  if (mission.progressPercent > 0) return `${mission.progressPercent}% concluído`;
  return "Disponível";
}

export function CampaignJourneyScreen({
  catalog,
  progress,
  playerName,
  realmStatus,
  onBack,
  onStartLiving,
  onStartServer,
}: CampaignJourneyScreenProps) {
  const chapters = useMemo(() => createCampaignJourney(catalog, progress), [catalog, progress]);
  const missions = useMemo(() => flattenCampaignJourney(chapters), [chapters]);
  const recommended = useMemo(() => recommendedCampaignMission(chapters), [chapters]);
  const totals = useMemo(() => campaignTotals(chapters), [chapters]);
  const [selectedId, setSelectedId] = useState(() => recommended?.id ?? missions[0]?.id ?? "");
  const [briefingOpen, setBriefingOpen] = useState(false);

  useEffect(() => {
    if (!missions.some((mission) => mission.id === selectedId)) {
      setSelectedId(recommended?.id ?? missions[0]?.id ?? "");
    }
  }, [missions, recommended, selectedId]);

  const selected = missions.find((mission) => mission.id === selectedId) ?? recommended ?? null;
  const selectedNeedsNetwork = selected?.source === "server";
  const selectedCanStart = Boolean(selected?.unlocked && (!selectedNeedsNetwork || realmStatus === "online"));

  const startSelectedMission = () => {
    if (!selected || !selectedCanStart) return;
    window.sessionStorage.setItem("hexa.campaign.selected-mission", selected.id);
    if (selected.source === "living") onStartLiving();
    else onStartServer(selected.id);
  };

  if (briefingOpen && selected) {
    const startLabel = selectedNeedsNetwork && realmStatus !== "online"
      ? "Disponível quando reconectar"
      : selected.completed
        ? "Jogar novamente"
        : selected.progressPercent > 0
          ? "Continuar missão"
          : "Iniciar missão";

    return (
      <main className="campaign-briefing-screen">
        <button type="button" className="campaign-back-link" onClick={() => setBriefingOpen(false)}>← Mapa da campanha</button>
        <section className="briefing-illustration" aria-hidden="true">
          <span className="briefing-moon" />
          <span className="briefing-ridge ridge-one" />
          <span className="briefing-ridge ridge-two" />
          <span className="briefing-path" />
          <span className="briefing-sigil">{selected.source === "living" ? "✦" : "⬡"}</span>
          <span className="briefing-hero">{selected.source === "living" ? "♜" : "◆"}</span>
        </section>
        <section className="briefing-content">
          <div className="briefing-topline">
            <p className="fantasy-eyebrow">{selected.chapterTitle} · Missão {selected.order}</p>
            <span className={`mission-difficulty difficulty-${selected.difficulty}`}>{difficultyLabel(selected.difficulty)}</span>
          </div>
          <h1>{selected.title}</h1>
          <p className="briefing-story">{selected.briefing}</p>

          <div className="briefing-facts">
            <article><small>Adversário</small><strong>{selected.aiName}</strong><span>Tabuleiro {selected.boardSize}×{selected.boardSize}</span></article>
            <article><small>Recompensa</small><strong>{selected.rewardXp.toLocaleString("pt-BR")} XP</strong><span>{selected.source === "living" ? "Arco Prismático e construção" : "Progresso autoritativo"}</span></article>
            <article><small>Registro</small><strong>{starLine(selected.stars)}</strong><span>{selected.attempts} tentativa(s)</span></article>
          </div>

          <div className="briefing-objectives">
            <article className="primary"><span>◆</span><div><small>Objetivo principal</small><strong>{selected.primaryLabel}</strong></div></article>
            {selected.bonusLabels.map((label) => (
              <article key={label}><span>☆</span><div><small>Estrela adicional</small><strong>{label}</strong></div></article>
            ))}
          </div>

          {selectedNeedsNetwork && realmStatus !== "online" ? (
            <p className="briefing-offline-note" role="status">Esta missão usa o servidor autoritativo. O briefing permanece disponível, mas a batalha será liberada quando a conexão voltar.</p>
          ) : null}

          <div className="briefing-actions">
            <label className="tutorial-toggle">
              <input type="checkbox" defaultChecked={localStorage.getItem("hexa.settings.contextual-tutorial") !== "false"} onChange={(event) => localStorage.setItem("hexa.settings.contextual-tutorial", String(event.target.checked))} />
              <span><strong>Tutorial contextual</strong><small>Recomendado na primeira missão.</small></span>
            </label>
            <button type="button" className="fantasy-button primary briefing-start" disabled={!selectedCanStart} onClick={startSelectedMission}>
              {startLabel}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="campaign-journey-screen">
      <header className="campaign-journey-header">
        <div>
          <button type="button" className="campaign-back-link" onClick={onBack}>← Início</button>
          <p className="fantasy-eyebrow">As Crônicas de Orun</p>
          <h1>Mapa da campanha</h1>
          <p>Escolha uma missão, leia o briefing e continue a reconquista sem sair do shell principal.</p>
        </div>
        <div className="campaign-account-summary">
          <span className={`realm-state state-${realmStatus}`}><i />{realmStatus === "online" ? "Sincronizada" : realmStatus === "loading" ? "Sincronizando" : "Modo local"}</span>
          <strong>{playerName}</strong>
          <small>{totals.completed}/{totals.missions} missões · {totals.stars}/{totals.availableStars} estrelas</small>
        </div>
      </header>

      <section className="campaign-map-layout">
        <div className="campaign-chapter-list">
          {chapters.map((chapter) => (
            <article className={`campaign-chapter chapter-${chapter.id}`} key={chapter.id}>
              <header>
                <div><small>{chapter.order === 0 ? "PRÓLOGO" : `CAPÍTULO ${chapter.order}`}</small><h2>{chapter.title}</h2><p>{chapter.subtitle}</p></div>
                <span><strong>{chapter.completed}/{chapter.missions.length}</strong><small>{chapter.stars} ★</small></span>
              </header>
              <div className="campaign-mission-track" role="list">
                {chapter.missions.map((mission, index) => (
                  <button
                    type="button"
                    role="listitem"
                    key={mission.id}
                    className={`campaign-mission-node ${selected?.id === mission.id ? "selected" : ""} ${mission.unlocked ? "unlocked" : "locked"} ${mission.completed ? "completed" : ""}`}
                    disabled={!mission.unlocked}
                    onClick={() => { setSelectedId(mission.id); setBriefingOpen(false); }}
                    aria-current={selected?.id === mission.id ? "step" : undefined}
                    aria-label={`${mission.title}: ${missionStatus(mission)}`}
                  >
                    <span className="mission-track-line" aria-hidden="true" />
                    <span className="mission-node-number">{mission.completed ? "✓" : mission.unlocked ? index + 1 : "🔒"}</span>
                    <strong>{mission.title}</strong>
                    <small>{mission.unlocked ? starLine(mission.stars) : "Bloqueada"}</small>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>

        <aside className="campaign-selected-panel">
          {selected ? (
            <>
              <div className="selected-mission-art" aria-hidden="true"><span>{selected.source === "living" ? "✦" : "⬡"}</span><i /><b /></div>
              <p className="fantasy-eyebrow">{selected.chapterTitle} · Missão {selected.order}</p>
              <h2>{selected.title}</h2>
              <p>{selected.briefing}</p>
              <div className="selected-mission-meta">
                <span><small>Dificuldade</small><strong>{difficultyLabel(selected.difficulty)}</strong></span>
                <span><small>Recompensa</small><strong>{selected.rewardXp.toLocaleString("pt-BR")} XP</strong></span>
                <span><small>Progresso</small><strong>{missionStatus(selected)}</strong></span>
              </div>
              <div className="selected-progress-bar"><i style={{ width: `${selected.progressPercent}%` }} /></div>
              <button type="button" className="fantasy-button primary" disabled={!selected.unlocked} onClick={() => setBriefingOpen(true)}>Abrir briefing</button>
              {!selected.unlocked ? <small className="locked-requirement">Conclua a missão anterior para abrir este caminho.</small> : null}
              {selectedNeedsNetwork && realmStatus !== "online" && selected.unlocked ? <small className="locked-requirement online-requirement">A batalha será liberada quando o servidor reconectar.</small> : null}
            </>
          ) : <div className="campaign-empty-state">O catálogo da campanha está sendo restaurado.</div>}
        </aside>
      </section>
    </main>
  );
}
