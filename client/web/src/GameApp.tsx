import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  campaignCacheScope,
  readCampaignCatalogSnapshot,
  saveCampaignCatalogSnapshot,
} from "./campaign-cache";
import { decorateGuestCampaign } from "./campaign-local";
import { HexaClient } from "./hexa-client";
import {
  applyInterfacePreferences,
  readInterfacePreferences,
  type InterfacePreferences,
} from "./interface-preferences";
import type { AccountSession, CampaignCatalog } from "./protocol";
import { SystemStatusCenter } from "./SystemStatusCenter";
import {
  deriveProfileSummary,
  readLivingCampaignProgress,
  subscribeLivingCampaignProgress,
  type LivingCampaignProgress,
  type UnifiedProfileSummary,
} from "./unified-progress";

const MultiplayerApp = lazy(() => import("./App").then((module) => ({ default: module.App })));
const CampaignExperience = lazy(() => import("./CampaignExperience").then((module) => ({ default: module.CampaignExperience })));
const CampaignJourneyScreen = lazy(() => import("./CampaignJourneyScreen").then((module) => ({ default: module.CampaignJourneyScreen })));
const AuthoritativeCampaignLauncher = lazy(() => import("./AuthoritativeCampaignLauncher").then((module) => ({ default: module.AuthoritativeCampaignLauncher })));
const CollectionScreen = lazy(() => import("./CollectionScreen").then((module) => ({ default: module.CollectionScreen })));
const ProfileScreen = lazy(() => import("./ProfileScreen").then((module) => ({ default: module.ProfileScreen })));

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

function ScreenLoader() {
  return (
    <div className="screen-loader" role="status" aria-live="polite">
      <span aria-hidden="true">✦</span>
      <strong>Preparando o reino...</strong>
      <small>Carregando apenas os recursos necessários para esta tela.</small>
    </div>
  );
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
            <button type="button" className="fantasy-button primary" onClick={onContinueCampaign}>{continueLabel}</button>
            <button type="button" className="fantasy-button compact" onClick={() => onNavigate("profile")}>Ver progresso</button>
          </div>
        </div>
      </section>

      <section className="home-menu-grid" aria-label="Modos de jogo">
        {MENU_ITEMS.map((item) => (
          <button type="button" className={`home-mode-card mode-${item.id}`} key={item.id} onClick={() => onNavigate(item.id)}>
            <span className="mode-card-icon" aria-hidden="true">{item.icon}</span>
            <span className="mode-card-copy"><small>{item.eyebrow}</small><strong>{item.title}</strong><p>{item.description}</p></span>
            <span className="mode-card-arrow" aria-hidden="true">→</span>
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
        <button type="button" className="chronicle-stat" onClick={() => onNavigate("profile")}><strong>{summary.achievementsUnlocked}</strong><span>Conquistas</span></button>
        <button type="button" className="chronicle-stat" onClick={() => onNavigate("collection")}><strong>{summary.cardsUnlocked}</strong><span>Cartas</span></button>
        <button type="button" className="chronicle-stat" onClick={() => onNavigate("collection")}><strong>{summary.heroesUnlocked}</strong><span>Heróis</span></button>
      </aside>
    </main>
  );
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [preferences, setPreferences] = useState<InterfacePreferences>(readInterfacePreferences);

  useEffect(() => {
    applyInterfacePreferences(preferences);
  }, [preferences]);

  const updatePreference = (key: keyof InterfacePreferences, checked: boolean) => {
    setPreferences((current) => ({ ...current, [key]: checked }));
  };

  return (
    <main className="settings-screen">
      <header className="screen-heading">
        <div><p className="fantasy-eyebrow">Preferências locais</p><h1>Configurações</h1></div>
        <button type="button" className="fantasy-button compact" onClick={onBack}>Voltar</button>
      </header>
      <section className="settings-panel">
        <label><span><strong>Reduzir animações</strong><small>Minimiza transições, banners e movimentos de batalha.</small></span><input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => updatePreference("reducedMotion", event.target.checked)} /></label>
        <label><span><strong>Interface compacta</strong><small>Otimiza o espaço em notebooks com menor altura.</small></span><input type="checkbox" checked={preferences.denseInterface} onChange={(event) => updatePreference("denseInterface", event.target.checked)} /></label>
        <label><span><strong>Tutorial contextual</strong><small>Mostra uma regra por vez durante a missão viva.</small></span><input type="checkbox" checked={preferences.contextualTutorial} onChange={(event) => updatePreference("contextualTutorial", event.target.checked)} /></label>
        <label><span><strong>Alto contraste</strong><small>Reforça bordas, foco, textos e estados sem depender somente de cor.</small></span><input type="checkbox" checked={preferences.highContrast} onChange={(event) => updatePreference("highContrast", event.target.checked)} /></label>
        <label><span><strong>Texto ampliado</strong><small>Aumenta textos funcionais e descrições sem aplicar zoom na página.</small></span><input type="checkbox" checked={preferences.largeText} onChange={(event) => updatePreference("largeText", event.target.checked)} /></label>
        <label><span><strong>Efeitos leves</strong><small>Reduz desfoques, filtros e sombras para aparelhos com menor desempenho.</small></span><input type="checkbox" checked={preferences.lowEffects} onChange={(event) => updatePreference("lowEffects", event.target.checked)} /></label>
        <article><span>⬡</span><div><strong>PWA, cache e conta</strong><small>Atualizações agora exigem confirmação e nunca interrompem uma batalha sem autorização.</small></div></article>
      </section>
    </main>
  );
}

function screenAnnouncement(screen: GameScreen, campaignView: CampaignView): string {
  if (screen === "campaign") {
    if (campaignView === "living") return "Missão viva aberta";
    if (campaignView === "server") return "Missão estratégica aberta";
    return "Mapa da campanha aberto";
  }
  const labels: Record<Exclude<GameScreen, "campaign">, string> = {
    home: "Início aberto",
    multiplayer: "Multiplayer aberto",
    collection: "Coleção aberta",
    profile: "Perfil aberto",
    settings: "Configurações abertas",
  };
  return labels[screen];
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
  const contentRef = useRef<HTMLDivElement | null>(null);

  const refreshDashboard = useCallback(async () => {
    const client = new HexaClient();
    const session = client.accountSession;
    const scope = campaignCacheScope(session?.account.id);
    setAccount(session);
    setRealmStatus("loading");
    try {
      const loaded = await client.loadCampaignCatalog();
      saveCampaignCatalogSnapshot(scope, loaded);
      setCatalog(session ? loaded : decorateGuestCampaign(loaded));
      setRealmStatus("online");
    } catch {
      const cached = readCampaignCatalogSnapshot(scope);
      if (cached) setCatalog(session ? cached.catalog : decorateGuestCampaign(cached.catalog));
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => contentRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [screen, campaignView]);

  const summary = useMemo(() => deriveProfileSummary(account, catalog, progress), [account, catalog, progress]);
  const openCampaignMap = () => { setCampaignView("map"); setScreen("campaign"); };
  const startLivingCampaign = () => { setCampaignView("living"); setScreen("campaign"); };
  const startServerCampaign = (missionId: string) => {
    if (realmStatus !== "online") return;
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
    <div className={`unified-game-shell screen-${screen} campaign-view-${campaignView} ${battleActive ? "battle-active" : ""}`} data-realm-status={realmStatus}>
      <a className="game-skip-link" href="#game-main">Pular para o conteúdo</a>
      <div className="sr-only" aria-live="polite">{screenAnnouncement(screen, campaignView)}</div>
      <SystemStatusCenter battleActive={battleActive} realmStatus={realmStatus} onRetrySync={refreshDashboard} />

      {!battleActive ? (
        <header className="unified-header">
          <button type="button" className="brand-button" onClick={backHome} aria-label="Ir para o início"><BrandMark /></button>
          <nav className={menuOpen ? "open" : ""} aria-label="Navegação principal">
            <button type="button" aria-current={isScreen("home") ? "page" : undefined} className={isScreen("home") ? "active" : ""} onClick={() => setScreen("home")}>Início</button>
            <button type="button" aria-current={isScreen("campaign") ? "page" : undefined} className={isScreen("campaign") ? "active" : ""} onClick={openCampaignMap}>Campanha</button>
            <button type="button" aria-current={isScreen("multiplayer") ? "page" : undefined} className={isScreen("multiplayer") ? "active" : ""} onClick={() => setScreen("multiplayer")}>Multiplayer</button>
            <button type="button" aria-current={isScreen("collection") ? "page" : undefined} className={isScreen("collection") ? "active" : ""} onClick={() => setScreen("collection")}>Coleção</button>
          </nav>
          <div className="header-actions">
            <span className={`connection-indicator ${realmStatus}`} aria-live="polite"><i /> {realmStatus === "online" ? "Reino online" : realmStatus === "loading" ? "Sincronizando" : "Modo local"}</span>
            <button type="button" className="icon-button profile-avatar-button" onClick={() => setScreen("profile")} aria-label="Abrir perfil">{summary.displayName.slice(0, 1).toUpperCase()}</button>
            <button type="button" className="icon-button" onClick={() => setScreen("settings")} aria-label="Abrir configurações">⚙</button>
            <button type="button" className="mobile-menu-button" onClick={() => setMenuOpen((current) => !current)} aria-expanded={menuOpen} aria-label="Abrir menu">☰</button>
          </div>
        </header>
      ) : null}

      <div id="game-main" className="unified-screen-frame" ref={contentRef} tabIndex={-1}>
        <Suspense fallback={<ScreenLoader />}>
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
                <button type="button" className="fantasy-button compact" onClick={backHome}>Voltar ao salão</button>
              </div>
              <MultiplayerApp />
            </section>
          ) : null}
          {isScreen("collection") ? <CollectionScreen catalog={catalog} progress={progress} onBack={backHome} /> : null}
          {isScreen("profile") ? (
            <ProfileScreen account={account} catalog={catalog} progress={progress} onBack={backHome} onOpenCollection={() => setScreen("collection")} onOpenCampaign={openCampaignMap} />
          ) : null}
          {isScreen("settings") ? <SettingsScreen onBack={backHome} /> : null}
        </Suspense>
      </div>

      {!battleActive ? <footer className="unified-footer"><span>Hexa Octarina Conquer</span><small>Tehkné Solutions</small></footer> : null}
      {!battleActive ? (
        <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
          <button type="button" aria-current={isScreen("home") ? "page" : undefined} className={isScreen("home") ? "active" : ""} onClick={() => setScreen("home")}><span>⌂</span>Início</button>
          <button type="button" aria-current={isScreen("campaign") ? "page" : undefined} className={isScreen("campaign") ? "active" : ""} onClick={openCampaignMap}><span>⚔</span>Campanha</button>
          <button type="button" aria-current={isScreen("multiplayer") ? "page" : undefined} className={isScreen("multiplayer") ? "active" : ""} onClick={() => setScreen("multiplayer")}><span>♜</span>Jogar</button>
          <button type="button" aria-current={isScreen("collection") ? "page" : undefined} className={isScreen("collection") ? "active" : ""} onClick={() => setScreen("collection")}><span>◆</span>Cartas</button>
        </nav>
      ) : null}
    </div>
  );
}
