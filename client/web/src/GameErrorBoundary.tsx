import { Component, type ErrorInfo, type ReactNode } from "react";

interface GameErrorBoundaryProps {
  children: ReactNode;
}

interface GameErrorBoundaryState {
  failed: boolean;
}

const VOLATILE_SESSION_KEYS = [
  "hexa.unified.screen",
  "hexa.unified.campaign-view",
  "hexa.campaign.selected-mission",
];

export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  state: GameErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): GameErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Falha recuperável no shell do Hexa Octarina Conquer", error, info);
  }

  private returnHome = () => {
    VOLATILE_SESSION_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
    window.location.assign("/");
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="fatal-game-screen">
        <section>
          <span className="fatal-game-rune" aria-hidden="true">◇</span>
          <p className="fantasy-eyebrow">Falha recuperável</p>
          <h1>O portal perdeu a estabilidade</h1>
          <p>Seu progresso local e sua conta não foram apagados. Recarregue a interface ou volte ao salão principal para restaurar a navegação.</p>
          <div>
            <button type="button" className="fantasy-button primary" onClick={() => window.location.reload()}>Recarregar interface</button>
            <button type="button" className="fantasy-button compact" onClick={this.returnHome}>Voltar ao início</button>
          </div>
          <small>Tehkné Solutions</small>
        </section>
      </main>
    );
  }
}
