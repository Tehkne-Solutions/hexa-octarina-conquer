import { useEffect, useMemo, useState } from "react";

import { App as MultiplayerApp } from "./App";
import { GoDotsLivingBoardDemo } from "./GoDotsLivingBoardDemo";

type GameScreen = "home" | "campaign" | "multiplayer" | "collection" | "profile" | "settings";

interface MenuItem {
  id: GameScreen;
  title: string;
  description: string;
  eyebrow: string;
  icon: string;
  status?: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: "campaign",
    title: "Campanha",
    description: "Conduza Kael e Lyra pela Ponte das Cinzas e reconquiste Orun.",
    eyebrow: "História tática",
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
    description: "Consulte unidades, cartas, armas e construções conquistadas.",
    eyebrow: "Compêndio",
    icon: "◆",
    status: "Em evolução",
  },
  {
    id: "profile",
    title: "Perfil",
    description: "Acompanhe nível, conquistas, missões e histórico de batalha.",
    eyebrow: "Progressão",
    icon: "✦",
    status: "Em evolução",
  },
];

const screenTitle: Record<GameScreen, string> = {
  home: "Salão de Comando",
  campaign: "A Ponte das Cinzas",
  multiplayer: "Confronto entre Arquitetos",
  collection: "Arquivo Octarino",
  profile: "Crônica do Arquiteto",
  settings: "Configurações",
};

function BrandMark() {
  return (
    <div className="game-brand" aria-label="Hexa Octarina Conquer">
      <span className="game-brand-mark" aria-hidden="true">✦</span>
      <span>
        <strong>Hexa Octarina</strong>
        <small>Conquer</small>
      </span>
    </div>
  );
}

function HomeScreen({ onNavigate }: { onNavigate: (screen: GameScreen) => void }) {
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
          <p className="fantasy-eyebrow">Campanha atual</p>
          <h1 id="campaign-title">A Ponte das Cinzas</h1>
          <p>
            O moinho de Orun foi tomado. Reúna os heróis, controle os nós da rede e
            transforme trilhas em territórios vivos.
          </p>
          <div className="hero-progress" aria-label="Progresso da campanha">
            <span><i style={{ width: "18%" }} /></span>
            <small>Capítulo I · Missão inicial</small>
          </div>
          <button className="fantasy-button primary" onClick={() => onNavigate("campaign")}>
            Continuar campanha
          </button>
        </div>
      </section>

      <section className="home-menu-grid" aria-label="Modos de jogo">
        {MENU_ITEMS.map((item) => (
          <button
            className={`home-mode-card mode-${item.id}`}
            key={item.id}
            onClick={() => onNavigate(item.id)}
          >
            <span className="mode-card-icon" aria-hidden="true">{item.icon}</span>
            <span className="mode-card-copy">
              <small>{item.eyebrow}</small>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </span>
            {item.status ? <em>{item.status}</em> : <span className="mode-card-arrow">→</span>}
          </button>
        ))}
      </section>

      <aside className="home-chronicle" aria-label="Crônica do jogador">
        <div>
          <p className="fantasy-eyebrow">Arquiteto</p>
          <strong>Nível 4</strong>
          <span className="profile-xp"><i style={{ width: "63%" }} /></span>
          <small>630 / 1.000 XP</small>
        </div>
        <div className="chronicle-stat"><strong>8</strong><span>Conquistas</span></div>
        <div className="chronicle-stat"><strong>12</strong><span>Cartas</span></div>
        <div className="chronicle-stat"><strong>2</strong><span>Heróis</span></div>
      </aside>
    </main>
  );
}

function PlaceholderScreen({
  screen,
  onBack,
}: {
  screen: "collection" | "profile" | "settings";
  onBack: () => void;
}) {
  const content = {
    collection: {
      icon: "◆",
      title: "Arquivo Octarino",
      text: "A coleção unificada será conectada às cartas, unidades, armas e construções desbloqueadas na campanha.",
      columns: ["Unidades", "Cartas TCG", "Armas", "Construções"],
    },
    profile: {
      icon: "✦",
      title: "Crônica do Arquiteto",
      text: "O perfil reunirá nível, conquistas, histórico, estrelas da campanha e classificação multiplayer.",
      columns: ["Nível 4", "8 conquistas", "3 missões", "Rating 1.000"],
    },
    settings: {
      icon: "⚙",
      title: "Configurações",
      text: "Controles de áudio, animação, acessibilidade, instalação PWA e qualidade visual ficarão neste salão.",
      columns: ["Áudio", "Interface", "Acessibilidade", "Conta"],
    },
  }[screen];

  return (
    <main className="unified-placeholder">
      <div className="placeholder-seal" aria-hidden="true">{content.icon}</div>
      <p className="fantasy-eyebrow">Em construção</p>
      <h1>{content.title}</h1>
      <p>{content.text}</p>
      <div className="placeholder-grid">
        {content.columns.map((column) => <span key={column}>{column}</span>)}
      </div>
      <button className="fantasy-button" onClick={onBack}>Voltar ao salão</button>
    </main>
  );
}

export function GameApp() {
  const initialScreen = useMemo<GameScreen>(() => {
    const stored = window.sessionStorage.getItem("hexa.unified.screen");
    return stored === "campaign" || stored === "multiplayer" ? stored : "home";
  }, []);
  const [screen, setScreen] = useState<GameScreen>(initialScreen);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (screen === "campaign" || screen === "multiplayer") {
      window.sessionStorage.setItem("hexa.unified.screen", screen);
    } else {
      window.sessionStorage.removeItem("hexa.unified.screen");
    }
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);

  const navigate = (next: GameScreen) => setScreen(next);
  const backHome = () => setScreen("home");
  const battleActive = screen === "campaign";

  return (
    <div className={`unified-game-shell screen-${screen} ${battleActive ? "battle-active" : ""}`}>
      {!battleActive ? (
        <header className="unified-header">
          <button className="brand-button" onClick={backHome} aria-label="Ir para o início">
            <BrandMark />
          </button>
          <nav className={menuOpen ? "open" : ""} aria-label="Navegação principal">
            <button className={screen === "home" ? "active" : ""} onClick={() => navigate("home")}>Início</button>
            <button className={screen === "campaign" ? "active" : ""} onClick={() => navigate("campaign")}>Campanha</button>
            <button className={screen === "multiplayer" ? "active" : ""} onClick={() => navigate("multiplayer")}>Multiplayer</button>
            <button className={screen === "collection" ? "active" : ""} onClick={() => navigate("collection")}>Coleção</button>
          </nav>
          <div className="header-actions">
            <span className="connection-indicator"><i /> Reino online</span>
            <button className="icon-button" onClick={() => navigate("profile")} aria-label="Abrir perfil">♙</button>
            <button className="icon-button" onClick={() => navigate("settings")} aria-label="Abrir configurações">⚙</button>
            <button
              className="mobile-menu-button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-expanded={menuOpen}
              aria-label="Abrir menu"
            >☰</button>
          </div>
        </header>
      ) : null}

      <div className="unified-screen-frame">
        {screen === "home" ? <HomeScreen onNavigate={navigate} /> : null}
        {screen === "campaign" ? (
          <GoDotsLivingBoardDemo playerName="Arquiteto" onBack={backHome} />
        ) : null}
        {screen === "multiplayer" ? (
          <section className="embedded-multiplayer">
            <div className="screen-heading">
              <div>
                <p className="fantasy-eyebrow">Duelo online</p>
                <h1>{screenTitle.multiplayer}</h1>
              </div>
              <button className="fantasy-button compact" onClick={backHome}>Voltar</button>
            </div>
            <MultiplayerApp />
          </section>
        ) : null}
        {screen === "collection" || screen === "profile" || screen === "settings" ? (
          <PlaceholderScreen screen={screen} onBack={backHome} />
        ) : null}
      </div>

      {!battleActive ? (
        <footer className="unified-footer">
          <span>Hexa Octarina Conquer</span>
          <small>Tehkné Solutions</small>
        </footer>
      ) : null}

      {!battleActive ? (
        <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
          <button className={screen === "home" ? "active" : ""} onClick={() => navigate("home")}><span>⌂</span>Início</button>
          <button className={screen === "campaign" ? "active" : ""} onClick={() => navigate("campaign")}><span>⚔</span>Campanha</button>
          <button className={screen === "multiplayer" ? "active" : ""} onClick={() => navigate("multiplayer")}><span>♜</span>Jogar</button>
          <button className={screen === "collection" ? "active" : ""} onClick={() => navigate("collection")}><span>◆</span>Cartas</button>
        </nav>
      ) : null}
    </div>
  );
}
