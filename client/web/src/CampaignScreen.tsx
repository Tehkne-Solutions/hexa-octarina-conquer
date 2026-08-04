import { useEffect, useMemo, useState } from "react";

import { campaignCompletionSummary } from "./campaign-completion";
import "./campaign-completion.css";
import type { CampaignCatalog, CampaignMission } from "./protocol";

interface CampaignScreenProps {
  catalog: CampaignCatalog;
  loading: boolean;
  playerName: string;
  onStart: (missionId: string) => void;
  onBack: () => void;
}

function stars(amount = 0): string {
  return [0, 1, 2].map((index) => index < amount ? "★" : "☆").join("");
}

function difficultyLabel(difficulty: CampaignMission["difficulty"]): string {
  if (difficulty === "novice") return "Iniciante";
  if (difficulty === "adept") return "Tático";
  return "Mestre";
}

export function CampaignScreen({ catalog, loading, playerName, onStart, onBack }: CampaignScreenProps) {
  const firstUnlocked = catalog.missions.find((mission) => mission.unlocked && !mission.progress?.stars) ?? catalog.missions[0];
  const storedSelectedId = window.sessionStorage.getItem("hexa.campaign.selected-mission");
  const storedMission = catalog.missions.find((mission) => mission.id === storedSelectedId && mission.unlocked);
  const [selectedId, setSelectedId] = useState(storedMission?.id ?? firstUnlocked?.id ?? "");
  const selected = useMemo(() => catalog.missions.find((mission) => mission.id === selectedId) ?? firstUnlocked, [catalog, selectedId, firstUnlocked]);
  const completion = useMemo(() => campaignCompletionSummary(catalog), [catalog]);

  useEffect(() => {
    if (selected?.id) window.sessionStorage.setItem("hexa.campaign.selected-mission", selected.id);
  }, [selected?.id]);

  return (
    <main className="app campaign-screen">
      <header className="topbar campaign-topbar">
        <button className="ghost-button back-button" onClick={onBack}>← Salão multiplayer</button>
        <div className="campaign-brand"><strong>CAMPANHA OCTARINA</strong><span>{playerName}</span></div>
        <div className="campaign-total"><strong>{catalog.totals.stars} ★</strong><span>{catalog.totals.completed}/{catalog.missions.length} missões</span></div>
      </header>

      {completion.complete && (
        <section className="campaign-epilogue glass" data-campaign-complete="true" aria-label="Conclusão da Campanha Octarina">
          <div className="campaign-epilogue__heading">
            <div><small>CAMPANHA CONCLUÍDA</small><h1>Octarina Absoluta</h1></div>
            {completion.legend && (
              <div className="campaign-epilogue__legend" title="Conquista registrada pela campanha autoritativa">
                <b>{completion.legend.icon}</b><span>{completion.legend.title}</span>
              </div>
            )}
          </div>
          <p>Os três capítulos e as doze missões foram vencidos. O mapa permanece aberto para revisitar confrontos, aperfeiçoar estrelas e consolidar o domínio de cada frente.</p>
          <div className="campaign-epilogue__stats">
            <span><small>MISSÕES VENCIDAS</small><strong>{completion.completed}/{completion.total}</strong></span>
            <span><small>ESTRELAS REGISTRADAS</small><strong>{completion.stars}</strong></span>
            <span><small>MISSÕES DOMINADAS</small><strong>{completion.mastered}/{completion.total}</strong></span>
          </div>
        </section>
      )}

      <section className="campaign-layout">
        <div className="chapter-map">
          {catalog.chapters.map((chapter) => (
            <section key={chapter.id} className="chapter-section glass">
              <div className="chapter-heading">
                <div><span>CAPÍTULO {chapter.order}</span><h2>{chapter.title}</h2><p>{chapter.subtitle}</p></div>
                <strong>{catalog.missions.filter((mission) => mission.chapterId === chapter.id && (mission.progress?.stars ?? 0) > 0).length}/{catalog.missions.filter((mission) => mission.chapterId === chapter.id).length}</strong>
              </div>
              <div className="mission-path">
                {catalog.missions.filter((mission) => mission.chapterId === chapter.id).map((mission) => (
                  <button
                    key={mission.id}
                    data-mission-id={mission.id}
                    className={`mission-node ${mission.unlocked ? "unlocked" : "locked"} ${selected?.id === mission.id ? "selected" : ""}`}
                    onClick={() => mission.unlocked && setSelectedId(mission.id)}
                    disabled={!mission.unlocked}
                  >
                    <span className="mission-number">{mission.order}</span>
                    <strong>{mission.title}</strong>
                    <small>{mission.unlocked ? stars(mission.progress?.stars ?? 0) : "🔒 Bloqueada"}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="mission-detail glass">
          {selected && (
            <>
              <div className="mission-detail-header">
                <span>MISSÃO {selected.order}</span>
                <strong className={`difficulty ${selected.difficulty}`}>{difficultyLabel(selected.difficulty)}</strong>
              </div>
              <h1>{selected.title}</h1>
              <p className="mission-briefing">{selected.briefing}</p>
              <div className="enemy-card">
                <span>ADVERSÁRIO</span>
                <strong>{selected.aiName}</strong>
                <small>Tabuleiro {selected.boardSize}×{selected.boardSize}</small>
              </div>
              <div className="objective-list">
                <div className="objective primary"><span>◆</span><div><strong>Objetivo principal</strong><p>{selected.primary.label}</p></div></div>
                {selected.bonus.map((objective) => (
                  <div className="objective" key={`${selected.id}-${objective.type}`}><span>☆</span><div><strong>Estrela adicional</strong><p>{objective.label}</p></div></div>
                ))}
              </div>
              <div className="mission-record">
                <span>Melhor resultado</span>
                <strong>{stars(selected.progress?.stars ?? 0)}</strong>
                <small>{selected.progress?.attempts ?? 0} tentativa(s)</small>
              </div>
              <button className="primary-button campaign-start" disabled={loading || !selected.unlocked} onClick={() => onStart(selected.id)}>
                {loading ? "Preparando missão..." : selected.progress?.stars ? "Jogar novamente" : "Iniciar missão"}
              </button>
            </>
          )}
        </aside>
      </section>

      <section className="achievement-strip glass">
        <div><span>CONQUISTAS</span><strong>{catalog.achievements.filter((item) => item.unlockedAt).length}/{catalog.achievements.length}</strong></div>
        <div className="achievement-scroll">
          {catalog.achievements.map((achievement) => (
            <article key={achievement.id} className={`achievement ${achievement.unlockedAt ? "earned" : ""}`}>
              <span>{achievement.unlockedAt ? achievement.icon : "?"}</span>
              <div><strong>{achievement.title}</strong><small>{achievement.description}</small></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
