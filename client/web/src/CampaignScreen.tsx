import { useMemo, useState } from "react";

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
  const [selectedId, setSelectedId] = useState(firstUnlocked?.id ?? "");
  const selected = useMemo(() => catalog.missions.find((mission) => mission.id === selectedId) ?? firstUnlocked, [catalog, selectedId, firstUnlocked]);

  return (
    <main className="app campaign-screen">
      <header className="topbar campaign-topbar">
        <button className="ghost-button back-button" onClick={onBack}>← Multiplayer</button>
        <div className="campaign-brand"><strong>CAMPANHA OCTARINA</strong><span>{playerName}</span></div>
        <div className="campaign-total"><strong>{catalog.totals.stars} ★</strong><span>{catalog.totals.completed}/12 missões</span></div>
      </header>

      <section className="campaign-layout">
        <div className="chapter-map">
          {catalog.chapters.map((chapter) => (
            <section key={chapter.id} className="chapter-section glass">
              <div className="chapter-heading">
                <div><span>CAPÍTULO {chapter.order}</span><h2>{chapter.title}</h2><p>{chapter.subtitle}</p></div>
                <strong>{catalog.missions.filter((mission) => mission.chapterId === chapter.id && (mission.progress?.stars ?? 0) > 0).length}/4</strong>
              </div>
              <div className="mission-path">
                {catalog.missions.filter((mission) => mission.chapterId === chapter.id).map((mission) => (
                  <button
                    key={mission.id}
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
