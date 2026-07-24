import { useCallback, useEffect, useMemo, useState } from "react";

import { App as MultiplayerApp } from "./App";
import { CampaignExperience } from "./CampaignExperience";
import { AuthoritativeCampaignLauncher, CampaignJourneyScreen } from "./CampaignJourneyScreen";
import { decorateGuestCampaign } from "./campaign-local";
import { CollectionScreen } from "./CollectionScreen";
import { HexaClient } from "./hexa-client";
import { ProfileScreen } from "./ProfileScreen";
import type { AccountSession, CampaignCatalog } from "./protocol";
import {
  deriveProfileSummary,
  readLivingCampaignProgress,
  subscribeLivingCampaignProgress,
  type LivingCampaignProgress,
  type UnifiedProfileSummary,
} from "./unified-progress";

type GameScreen = "home" | "campaign" | "multiplayer" | "collection" | "profile" | "settings";
type CampaignView = "map" | "living" | "server";
type RealmStatus = "loading" | "online" | "offline";

interface MenuItem {
  id: GameScreen;
  title: string;
  description: string;
  eyebrow: string;
  icon: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: "campaign",
    title: "Campanha",
    description: "Percorra capítulos, briefings e batalhas das Crônicas de Orun.",
    eyebrow: "Jornada narrativa",
    icon: "⚔",
  },
  {
    id: "multiplayer",
    title: "Multiplayer",
    description: "Crie uma sala, convide um rival e dispute a rede Octarina.",
    eyebrow: "Duelo online",
    icon: "♜",
  },
  {
    id: "collection",
    title: "Coleção",
    description: "Consulte cartas, unidades, relíquias e conquistas desbloqueadas.",
    eyebrow: "Arquivo funcional",
    icon: "◆",
  },
  {
    id: "profile",
    title: "Perfil",
    description: "Acompanhe nível, XP, campanha, estrelas e rating multiplayer.",
    eyebrow: "Progressão real",
    icon: "✦",
  },
];

function BrandMark() {
  return (
    <div className="game-brand" aria-label="Hexa Octarina Conquer">
      <span className="game-brand-mark" aria-hidden="true">✦</span>
      <span><strong>Hexa Octarina</strong><small>Conquer</small></span>
    </div>
  );
}

function campaignStage(progress: LivingCampaignProgress): string {
  if (progress.status === "victory") return "Prólogo concluído";
  if (progress.completedObjectives > 0) return `Objetivo ${Math.min(5, progress.completedObjectives + 1)} de 5`;
  if (progress.status === "active") return "Prólogo iniciado";
  if (progress.status === "defeat") return "Nova tentativa disponível";
  return "Missão inicial";
}

function HomeScreen({
  onNavigate,
  onContinueCampaign,
  summary,
  progress,
  realmStatus,
}: {
  onNavigate: (screen: GameScreen) => void;
  onContinueCampaign: () => void;
  summary: UnifiedProfileSummary;
  progress: LivingCampaignProgress;
  realmStatus: RealmStatus;
}) {
  const continueLabel = progress.status === "not-started"
    ? "Abrir campanha"
    : progress.status === "victory"
      ? "Ver próximas missões"
      : "Continuar campanha";

  return (
    <main className="unified-home">
      <section className="campaign-hero" aria-labelledby="campaign-title">
        <div className="campaign-hero-art" aria-hidden="true">
          <span className="hero-moon" />
          <span className="hero-mountain mountain-one" />
          <span className="hero-mountain mountain-two" />
          <span className="hero-bridge" />
          <span className="hero-rune rune-one">✦</span>
          <span className="hero-rune rune-two">◇</span>
          <span className="hero-figure hero-kael">♜</span>
          <span className="hero-figure hero-lyra">➶</span>
        </div>
        <div className="campaign-hero-copy">
          <div className="hero-copy-topline">
            <p className="fantasy-eyebrow">Campanha atual</p>
            <span className={`realm-state state-${realmStatus}`}>
              <i />{realmStatus === "online" ? "Sincronizada" : realmStatus === "loading" ? "Sincronizando" : "Progresso local"}
            </span>
          </div>
          <h1 id="campaign-title">A Ponte das Cinzas</h1>
          <p>O moinho de Orun foi tomado. Reúna os heróis, controle os nós da rede e transforme trilhas em territórios vivos.</p>
          <div className="hero-progress" aria-label={`Progresso da campanha: ${progress.percent}%`}>
            <span><i style={{ width: `${progress.percent}%` }} /></span>
            <small>{campaignStage(progress)} · {progress.percent}%</small>
          </div>
          <div className="hero-action-row">
            <button className="fantasy-button primary" onClick={onContinueCampaign}>{continueLabel}</button>
            <button className="fantasy-button compact" onClick={() => onNavigate("profile")}>Ver progresso</button>
          </div>
        </div>
      </section>

      <section className="home-menu-grid" aria-label="Modos de jogo">
        {MENU_ITEMS.map((item) => (
          <button className={`home-mode-card mode-${item.id}`} key={item.id} onClick={() => onNavigate(item.id)}>
            <span className="mode-card-icon" aria-hidden="true">{item.icon}</span>
            <span className="mode-card-copy"><small>{item.eyebrow}</small><strong>{item.title}</strong><p>{item.description}</p></span>
            <span className="mode-card-arrow">→</span>
          </button>
        ))}
      </section>

      <aside className="home-chronicle" aria-label="Crônica do jogador">
        <div className="chronicle-profile">
          <p className="fantasy-eyebrow">{summary.isAuthenticated ? "Arquiteto conectado" : "Arquiteto visitante"}</p>
          <strong>{summary.displayName}</strong>
          <span>Nível {summary.level} · {summary.xp.toLocaleString("pt-BR")} XP</span>
          <span className="profile-xp"><i style={{ width: `${summary.xpPercent}%` }} /></span>
          <small>{summary.isAuthenticated ? `Rating ${summary.rating.toLocaleString("pt-BR")}` : "Progresso salvo neste dispositivo"}</small>
        </div>
        <button className="chronicle-stat" onClick={() => onNavigate("profile")}><strong>{summary.achievementsUnlocked}</strong><span>Conquistas</span></button>
        <button className="chronicle-stat" onClick={() => onNavigate("collection")}><strong>{summary.cardsUnlocked}</strong><span>Cartas</span></button>
        <button className="chronicle-stat" onClick={() => onNavigate("collection")}><strong>{summary.heroesUnlocked}</strong><span>Heróis</span></button>
      </aside>
    </main>
  );
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem("hexa.settings.reduced-motion") === "true");
  const [denseInterface, setDenseInterface] = useState(() => localStorage.getItem("hexa.settings.dense-interface") === "true");
  const [contextualTutorial, setContextualTutorial] = useState(() => localStorage.getItem("hexa.settings.contextual-tutorial") !== "false");

  useEffect(() => {
    document.documentElement.classList.toggle("hexa-reduced-motion", reducedMotion);
    document.documentElement.classList.toggle("hexa-dense-interface", denseInterface);
    localStorage.setItem("hexa.settings.reduced-motion", String(reducedMotion));
    localStorage.setItem("hexa.settings.dense-interface", String(denseInterface));
    localStorage.setItem("hexa.settings.contextual-tutorial", String(contextualTutorial));
  }, [reducedMotion, denseInterface, contextualTutorial]);

  return (
    <main className="settings-screen">
      <header className="screen-heading">
        <div><p className="fantasy-eyebrow">Preferências locais</p><h1>Configurações</h1></div>
        <button className="fantasy-button compact" onClick={onBack}>Voltar</button>
      </header>
      <section className="settings-panel">
        <label><span><strong>Reduzir animações</strong><small>Minimiza transições e efeitos de batalha.</small></span><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label>
        <label><span><strong>Interface compacta</strong><small>Otimiza o espaço em notebooks com menor altura.</small></span><input type="checkbox" checked={denseInterface} onChange={(event) => setDenseInterface(event.target.checked)} /></label>
        <label><span><strong>Tutorial contextual</strong><small>Mostra uma regra por vez durante a missão viva.</small></span><input type="checkbox" checked={contextualTutorial} onChange={(event) => setContextualTutorial(event.target.checked)} /></label>
        <article><span>⬡</span><div><strong>PWA e conta</strong><small>A instalação e autenticação continuam disponíveis dentro dos modos online.</small></div></article>
      </section>
    </main>
  );
}

export function GameApp() {
  const initialScreen = useMemo<GameScreen>(() => {
    const stored = window.sessionStorage.getItem("hexa.unified.screen");
    return stored === "campaign" || stored === "multiplayer" ? stored : "home";
  }, []);
  const initialCampaignView = useMemo<CampaignView>(() => {
    const stored = window.sessionStorage.getItem("hexa.unified.campaign-view");
    return stored === "living" || stored === "server" ? stored : "map";
  }, []);
  const [screen, setScreen] = useState<GameScreen>(initialScreen);
  const [campaignView, setCampaignView] = useState<CampaignView>(initialCampaignView);
  const [serverMissionId, setServerMissionId] = useState(() => window.sessionStorage.getItem("hexa.campaign.selected-mission") ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [account, setAccount] = useState<AccountSession | null>(() => new HexaClient().accountSession);
  const [catalog, setCatalog] = useState<CampaignCatalog | null>(null);
  const [progress, setProgress] = useState<LivingCampaignProgress>(() => readLivingCampaignProgress());
  const [realmStatus, setRealmStatus] = useState<RealmStatus>("loading");

  const refreshDashboard = useCallback(async () => {
    const client = new HexaClient();
    setAccount(client.accountSession);
    setRealmStatus("loading");
    try {
      const loaded = await client.loadCampaignCatalog();
      setCatalog(client.accountSession ? loaded : decorateGuestCampaign(loaded));
      setRealmStatus("online");
    } catch {
      setRealmStatus("offline");
    }
    setProgress(readLivingCampaignProgress());
  }, []);

  useEffect(() => {
    void refreshDashboard();
    const unsubscribe = subscribeLivingCampaignProgress(setProgress);
    const refreshOnFocus = () => void refreshDashboard();
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("storage", refreshOnFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("storage", refreshOnFocus);
    };
  }, [refreshDashboard]);

  useEffect(() => {
    if (screen === "campaign" || screen === "multiplayer") window.sessionStorage.setItem("hexa.unified.screen", screen);
    else window.sessionStorage.removeItem("hexa.unified.screen");
    if (screen === "campaign") window.sessionStorage.setItem("hexa.unified.campaign-view", campaignView);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [screen, campaignView]);

  const summary = useMemo(() => deriveProfileSummary(account, catalog, progress), [account, catalog, progress]);
  const openCampaignMap = () => { setCampaignView("map"); setScreen("campaign"); };
  const startLivingCampaign = () => { setCampaignView("living"); setScreen("campaign"); };
  const startServerCampaign = (missionId: string) => {
    setServerMissionId(missionId);
    window.sessionStorage.setItem("hexa.campaign.selected-mission", missionId);
    setCampaignView("server");
    setScreen("campaign");
  };
  const continueCampaign = () => {
    if (progress.status === "active" || progress.status === "defeat") startLivingCampaign();
    else openCampaignMap();
  };
  const navigate = (next: GameScreen) => {
    if (next === "campaign") openCampaignMap();
    else setScreen(next);
  };
  const backHome = () => { setCampaignView("map"); setScreen("home"); void refreshDashboard(); };
  const backToCampaignMap = () => { setCampaignView("map"); void refreshDashboard(); };
  const isScreen = (target: GameScreen) => screen === target;
  const campaignBattleActive = isScreen("campaign") && campaignView !== "map";
  const battleActive = isScreen("multiplayer") || campaignBattleActive;

  return (
    <div className={`unified-game-shell screen-${screen} campaign-view-${campaignView} ${battleActive ? "battle-active" : ""}`}>
      {!battleActive ? (
        <header className="unified-header">
          <button className="brand-button" onClick={backHome} aria-label="Ir para o início"><BrandMark /></button>
          <nav className={menuOpen ? "open" : ""} aria-label="Navegação principal">
            <button className={isScreen("home") ? "active" : ""} onClick={() => setScreen("home")}>Início</button>
            <button className={isScreen("campaign") ? "active" : ""} onClick={openCampaignMap}>Campanha</button>
            <button className={isScreen("multiplayer") ? "active" : ""} onClick={() => setScreen("multiplayer")}>Multiplayer</button>
            <button className={isScreen("collection") ? "active" : ""} onClick={() => setScreen("collection")}>Coleção</button>
          </nav>
          <div className="header-actions">
            <span className={`connection-indicator ${realmStatus}`}><i /> {realmStatus === "online" ? "Reino online" : realmStatus === "loading" ? "Sincronizando" : "Modo local"}</span>
            <button className="icon-button profile-avatar-button" onClick={() => setScreen("profile")} aria-label="Abrir perfil">{summary.displayName.slice(0, 1).toUpperCase()}</button>
            <button className="icon-button" onClick={() => setScreen("settings")} aria-label="Abrir configurações">⚙</button>
            <button className="mobile-menu-button" onClick={() => setMenuOpen((current) => !current)} aria-expanded={menuOpen} aria-label="Abrir menu">☰</button>
          </div>
        </header>
      ) : null}

      <div className="unified-screen-frame">
        {isScreen("home") ? <HomeScreen onNavigate={navigate} onContinueCampaign={continueCampaign} summary={summary} progress={progress} realmStatus={realmStatus} /> : null}
        {isScreen("campaign") && campaignView === "map" ? (
          <CampaignJourneyScreen
            catalog={catalog}
            progress={progress}
            playerName={summary.displayName}
            realmStatus={realmStatus}
            onBack={backHome}
            onStartLiving={startLivingCampaign}
            onStartServer={startServerCampaign}
          />
        ) : null}
        {isScreen("campaign") && campaignView === "living" ? <CampaignExperience playerName={summary.displayName} onBack={backToCampaignMap} /> : null}
        {isScreen("campaign") && campaignView === "server" && serverMissionId ? <AuthoritativeCampaignLauncher missionId={serverMissionId} onBack={backToCampaignMap} /> : null}
        {isScreen("multiplayer") ? (
          <section className="embedded-multiplayer">
            <div className="screen-heading multiplayer-shell-heading">
              <div><p className="fantasy-eyebrow">Duelo online</p><h1>Confronto entre Arquitetos</h1><p>O multiplayer utiliza a mesma linguagem visual, densidade e shell responsivo da campanha.</p></div>
              <button className="fantasy-button compact" onClick={backHome}>Voltar ao salão</button>
            </div>
            <MultiplayerApp />
          </section>
        ) : null}
        {isScreen("collection") ? <CollectionScreen catalog={catalog} progress={progress} onBack={backHome} /> : null}
        {isScreen("profile") ? (
          <ProfileScreen account={account} catalog={catalog} progress={progress} onBack={backHome} onOpenCollection={() => setScreen("collection")} onOpenCampaign={openCampaignMap} />
        ) : null}
        {isScreen("settings") ? <SettingsScreen onBack={backHome} /> : null}
      </div>

      {!battleActive ? <footer className="unified-footer"><span>Hexa Octarina Conquer</span><small>Tehkné Solutions</small></footer> : null}
      {!battleActive ? (
        <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
          <button className={isScreen("home") ? "active" : ""} onClick={() => setScreen("home")}><span>⌂</span>Início</button>
          <button className={isScreen("campaign") ? "active" : ""} onClick={openCampaignMap}><span>⚔</span>Campanha</button>
          <button className={isScreen("multiplayer") ? "active" : ""} onClick={() => setScreen("multiplayer")}><span>♜</span>Jogar</button>
          <button className={isScreen("collection") ? "active" : ""} onClick={() => setScreen("collection")}><span>◆</span>Cartas</button>
        </nav>
      ) : null}
    </div>
  );
}
