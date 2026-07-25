import type { AccountSession, CampaignCatalog } from "./protocol";
import {
  deriveProfileSummary,
  type LivingCampaignProgress,
} from "./unified-progress";

interface ProfileScreenProps {
  account: AccountSession | null;
  catalog: CampaignCatalog | null;
  progress: LivingCampaignProgress;
  onBack: () => void;
  onOpenCollection: () => void;
  onOpenCampaign: () => void;
  onOpenAccount: () => void;
}

function statusLabel(progress: LivingCampaignProgress): string {
  if (progress.status === "victory") return "Missão concluída";
  if (progress.status === "defeat") return "Reagrupando";
  if (progress.status === "active") return "Expedição em andamento";
  return "Campanha não iniciada";
}

export function ProfileScreen({
  account,
  catalog,
  progress,
  onBack,
  onOpenCollection,
  onOpenCampaign,
  onOpenAccount,
}: ProfileScreenProps) {
  const summary = deriveProfileSummary(account, catalog, progress);
  const unlockedAchievements = catalog?.achievements.filter((item) => item.unlockedAt !== null) ?? [];
  const lockedAchievements = catalog?.achievements.filter((item) => item.unlockedAt === null) ?? [];
  const currentMission = catalog?.missions.find((mission) => mission.unlocked && !mission.progress?.stars)
    ?? catalog?.missions.find((mission) => mission.unlocked)
    ?? null;

  return (
    <main className="profile-screen">
      <header className="screen-heading profile-heading">
        <div>
          <p className="fantasy-eyebrow">Progressão sincronizada</p>
          <h1>Crônica do Arquiteto</h1>
          <p>Dados da conta, campanha persistente e coleção reunidos no mesmo registro.</p>
        </div>
        <button className="fantasy-button compact" onClick={onBack}>Voltar</button>
      </header>

      <section className="profile-hero-card">
        <div className="profile-avatar" aria-hidden="true"><span>✦</span><i /></div>
        <div className="profile-identity">
          <small>{summary.isAuthenticated ? `@${summary.handle ?? "arquiteto"}` : "Perfil local deste dispositivo"}</small>
          <h2>{summary.displayName}</h2>
          <p>{summary.isAuthenticated ? "Conta conectada ao reino Octarina" : "Crie ou conecte uma conta quando quiser proteger esta jornada em outros dispositivos."}</p>
          <button type="button" className="profile-account-action" onClick={onOpenAccount}>
            {summary.isAuthenticated ? "Gerenciar conta e sincronização" : "Proteger progresso local"}
          </button>
          <div className="profile-level-row">
            <b>Nível {summary.level}</b>
            <span>{summary.xp.toLocaleString("pt-BR")} XP</span>
          </div>
          <div className="profile-level-bar"><i style={{ width: `${summary.xpPercent}%` }} /></div>
        </div>
        <div className="profile-rating">
          <small>Rating global</small>
          <strong>{summary.rating.toLocaleString("pt-BR")}</strong>
          <span>{summary.isAuthenticated ? "Classificação multiplayer" : "Rating inicial"}</span>
        </div>
      </section>

      <section className="profile-stat-grid" aria-label="Estatísticas do jogador">
        <article><span>⚔</span><div><strong>{summary.completedMissions}/{summary.totalMissions}</strong><small>Missões concluídas</small></div></article>
        <article><span>★</span><div><strong>{summary.stars}</strong><small>Estrelas da campanha</small></div></article>
        <article><span>◆</span><div><strong>{summary.cardsUnlocked}/{summary.cardsTotal}</strong><small>Cartas registradas</small></div></article>
        <article><span>⬡</span><div><strong>{summary.achievementsUnlocked}/{summary.achievementsTotal}</strong><small>Conquistas</small></div></article>
      </section>

      <section className="profile-content-grid">
        <article className="profile-campaign-card">
          <div className="profile-section-title">
            <div><p className="fantasy-eyebrow">Campanha atual</p><h2>A Ponte das Cinzas</h2></div>
            <span className={`campaign-status status-${progress.status}`}>{statusLabel(progress)}</span>
          </div>
          <p>Kael e Lyra avançam pela rede viva de Orun. O progresso abaixo é salvo conforme os objetivos aparecem no campo.</p>
          <div className="campaign-progress-large">
            <span><i style={{ width: `${progress.percent}%` }} /></span>
            <b>{progress.percent}%</b>
          </div>
          <div className="campaign-progress-meta">
            <span><b>{progress.completedObjectives}/5</b> objetivos</span>
            <span><b>{progress.attempts}</b> tentativas</span>
            <span><b>{progress.bestTurn ?? "—"}</b> melhor rodada</span>
          </div>
          <div className="profile-card-actions">
            <button className="fantasy-button primary" onClick={onOpenCampaign}>
              {progress.status === "victory" ? "Jogar novamente" : progress.status === "not-started" ? "Iniciar campanha" : "Continuar campanha"}
            </button>
            <button className="fantasy-button" onClick={onOpenCollection}>Abrir coleção</button>
          </div>
        </article>

        <article className="profile-next-mission">
          <p className="fantasy-eyebrow">Jornada autoritativa</p>
          <h2>{currentMission?.title ?? "Próximo capítulo"}</h2>
          <p>{currentMission?.briefing ?? "O catálogo completo ficará disponível quando o servidor da campanha responder."}</p>
          <dl>
            <div><dt>Progresso geral</dt><dd>{summary.campaignPercent}%</dd></div>
            <div><dt>Tentativas registradas</dt><dd>{summary.attempts}</dd></div>
            <div><dt>Heróis disponíveis</dt><dd>{summary.heroesUnlocked}/{summary.heroesTotal}</dd></div>
          </dl>
        </article>

        <article className="profile-achievements">
          <div className="profile-section-title">
            <div><p className="fantasy-eyebrow">Conquistas</p><h2>Selos recentes</h2></div>
            <button onClick={onOpenCollection}>Ver todas</button>
          </div>
          <div className="achievement-row">
            {unlockedAchievements.slice(0, 4).map((achievement) => (
              <div key={achievement.id} className="achievement-token unlocked">
                <span>{achievement.icon}</span>
                <div><strong>{achievement.title}</strong><small>{achievement.description}</small></div>
              </div>
            ))}
            {unlockedAchievements.length === 0 && lockedAchievements.slice(0, 3).map((achievement) => (
              <div key={achievement.id} className="achievement-token locked">
                <span>{achievement.icon}</span>
                <div><strong>{achievement.title}</strong><small>{achievement.description}</small></div>
              </div>
            ))}
            {(catalog?.achievements.length ?? 0) === 0 ? (
              <div className="profile-empty-state">Conecte-se ao reino para carregar os selos da campanha.</div>
            ) : null}
          </div>
        </article>

        <article className="profile-activity">
          <p className="fantasy-eyebrow">Atividade</p>
          <h2>Últimos registros</h2>
          <ol>
            <li><span>✦</span><div><strong>{statusLabel(progress)}</strong><small>A Ponte das Cinzas · {progress.percent}%</small></div></li>
            {progress.rewards.map((reward) => (
              <li key={reward}><span>◆</span><div><strong>{reward}</strong><small>Recompensa adicionada à coleção</small></div></li>
            ))}
            <li><span>⬡</span><div><strong>{summary.cardsUnlocked} cartas catalogadas</strong><small>Arquivo Octarino atualizado</small></div></li>
          </ol>
        </article>
      </section>
    </main>
  );
}
