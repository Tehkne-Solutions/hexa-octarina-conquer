import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { CampaignNarrativeArt } from "./CampaignNarrativeArt";
import {
  campaignNarrativeTheme,
  campaignThemeStyle,
  visualQaCampaignCatalog,
} from "./campaign-narrative";
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

function visualQaRequest(): { chapterId: string | null; briefing: boolean; enabled: boolean } {
  if (typeof window === "undefined") return { chapterId: null, briefing: false, enabled: false };
  const params = new URL(window.location.href).searchParams;
  return {
    chapterId: params.get("chapter"),
    briefing: params.get("briefing") === "1",
    enabled: params.get("qa") === "1" && params.get("screen") === "campaign",
  };
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
  const qaRequest = useMemo(visualQaRequest, []);
  const effectiveCatalog = catalog ?? (qaRequest.enabled ? visualQaCampaignCatalog() : null);
  const chapters = useMemo(() => createCampaignJourney(effectiveCatalog, progress), [effectiveCatalog, progress]);
  const missions = useMemo(() => flattenCampaignJourney(chapters), [chapters]);
  const recommended = useMemo(() => recommendedCampaignMission(chapters), [chapters]);
  const totals = useMemo(() => campaignTotals(chapters), [chapters]);
  const [selectedId, setSelectedId] = useState(() => recommended?.id ?? missions[0]?.id ?? "");
  const [briefingOpen, setBriefingOpen] = useState(false);

  useEffect(() => {
    const qaSelected = qaRequest.enabled && qaRequest.chapterId
      ? missions.find((mission) => mission.chapterId === qaRequest.chapterId)
      : null;
    if (qaSelected) {
      if (selectedId !== qaSelected.id) setSelectedId(qaSelected.id);
      if (qaRequest.briefing && !briefingOpen) setBriefingOpen(true);
      return;
    }
    if (!missions.some((mission) => mission.id === selectedId)) {
      setSelectedId(recommended?.id ?? missions[0]?.id ?? "");
    }
  }, [briefingOpen, missions, qaRequest, recommended, selectedId]);

  const selected = missions.find((mission) => mission.id === selectedId) ?? recommended ?? null;
  const selectedNeedsNetwork = selected?.source === "server";
  const selectedCanStart = Boolean(selected?.unlocked && (!selectedNeedsNetwork || realmStatus === "online"));
  const selectedTheme = campaignNarrativeTheme(selected?.chapterId ?? "living-prologue");
  const selectedThemeStyle = campaignThemeStyle(selectedTheme) as CSSProperties;

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
      <main
        className={`campaign-briefing-screen narrative-theme-${selectedTheme.id}`}
        data-chapter-theme={selectedTheme.id}
        style={selectedThemeStyle}
      >
        <button type="button" className="campaign-back-link" onClick={() => setBriefingOpen(false)}>← Mapa da campanha</button>
        <CampaignNarrativeArt
          key={`briefing-${selected.id}`}
          theme={selectedTheme}
          missionOrder={selected.order}
          missionTitle={selected.title}
          variant="briefing"
          loading="eager"
        />
        <section className="briefing-content narrative-content-reveal">
          <div className="briefing-topline">
            <div>
              <p className="fantasy-eyebrow">{selected.chapterTitle} · Missão {selected.order}</p>
              <span className="briefing-region-label">{selectedTheme.region}</span>
            </div>
            <span className={`mission-difficulty difficulty-${selected.difficulty}`}>{difficultyLabel(selected.difficulty)}</span>
          </div>
          <h1>{selected.title}</h1>
          <p className="briefing-story">{selected.briefing}</p>
          <p className="briefing-atmosphere"><span aria-hidden="true">✦</span>{selectedTheme.atmosphere}</p>

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
            <p className="briefing-offline-note" role="status">Esta missão usa o servidor autoritativo. A arte e o briefing permanecem disponíveis offline; a batalha será liberada quando a conexão voltar.</p>
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
    <main
      className={`campaign-journey-screen narrative-theme-${selectedTheme.id}`}
      data-chapter-theme={selectedTheme.id}
      style={selectedThemeStyle}
    >
      <header className="campaign-journey-header">
        <div>
          <button type="button" className="campaign-back-link" onClick={onBack}>← Início</button>
          <p className="fantasy-eyebrow">As Crônicas de Orun</p>
          <h1>Mapa da campanha</h1>
          <p>Escolha uma região, leia o briefing ilustrado e continue a reconquista sem sair do shell principal.</p>
        </div>
        <div className="campaign-account-summary">
          <span className={`realm-state state-${realmStatus}`}><i />{realmStatus === "online" ? "Sincronizada" : realmStatus === "loading" ? "Sincronizando" : "Modo local"}</span>
          <strong>{playerName}</strong>
          <small>{totals.completed}/{totals.missions} missões · {totals.stars}/{totals.availableStars} estrelas</small>
        </div>
      </header>

      <section className="campaign-region-banner" key={`region-${selectedTheme.id}`} aria-live="polite">
        <span>{selectedTheme.shortRegion}</span>
        <strong>{selected?.chapterTitle ?? "Prólogo Vivo"}</strong>
        <small>{selectedTheme.atmosphere}</small>
      </section>

      <section className="campaign-map-layout">
        <div className="campaign-chapter-list">
          {chapters.map((chapter) => {
            const chapterTheme = campaignNarrativeTheme(chapter.id);
            const chapterThemeStyle = campaignThemeStyle(chapterTheme) as CSSProperties;
            const featuredMission = chapter.missions.find((mission) => mission.unlocked) ?? chapter.missions[0];
            return (
              <article
                className={`campaign-chapter chapter-${chapter.id} chapter-theme-${chapterTheme.id}`}
                key={chapter.id}
                data-chapter-id={chapter.id}
                style={chapterThemeStyle}
              >
                <CampaignNarrativeArt
                  theme={chapterTheme}
                  missionOrder={featuredMission?.order ?? chapter.order}
                  missionTitle={chapter.title}
                  variant="chapter"
                  decorative
                />
                <header>
                  <div>
                    <small>{chapter.order === 0 ? "PRÓLOGO" : `CAPÍTULO ${chapter.order}`}</small>
                    <h2>{chapter.title}</h2>
                    <p>{chapter.subtitle}</p>
                    <span className="chapter-region-name">{chapterTheme.shortRegion}</span>
                  </div>
                  <span><strong>{chapter.completed}/{chapter.missions.length}</strong><small>{chapter.stars} ★</small></span>
                </header>
                <div className="campaign-mission-track" role="list">
                  {chapter.missions.map((mission, index) => (
                    <button
                      type="button"
                      role="listitem"
                      key={mission.id}
                      data-mission-id={mission.id}
                      data-chapter-id={mission.chapterId}
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
            );
          })}
        </div>

        <aside className="campaign-selected-panel" key={`selected-${selected?.id ?? "none"}`}>
          {selected ? (
            <>
              <CampaignNarrativeArt
                theme={selectedTheme}
                missionOrder={selected.order}
                missionTitle={selected.title}
                variant="selected"
                decorative
                loading="eager"
              />
              <p className="fantasy-eyebrow">{selected.chapterTitle} · Missão {selected.order}</p>
              <span className="selected-region-label">{selectedTheme.region}</span>
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
