import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Board } from "./Board";
import { CampaignScreen } from "./CampaignScreen";
import { decorateGuestCampaign, recordGuestCampaignResult } from "./campaign-local";
import { HexaClient } from "./hexa-client";
import type {
  AccountSession,
  CampaignCatalog,
  CampaignResult,
  CardState,
  LobbyRoom,
  Point,
  PrivateState,
  RoomSnapshot,
  ServerMessage,
} from "./protocol";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type ConnectionStatus = "idle" | "connecting" | "open" | "closed" | "error";
type AuthMode = "login" | "register";
type LobbyMode = "multiplayer" | "campaign";

function snapshotFromPatch(previous: RoomSnapshot | null, payload: Record<string, unknown>): RoomSnapshot | null {
  const state = payload.state as Partial<RoomSnapshot> | undefined;
  if (!state) return previous;
  return {
    roomId: String(payload.roomId ?? previous?.roomId ?? ""),
    mode: state.mode ?? previous?.mode ?? "multiplayer",
    revision: Number(payload.revision ?? previous?.revision ?? 0),
    status: (state.status ?? previous?.status ?? "waiting") as RoomSnapshot["status"],
    board: state.board ?? previous?.board ?? {
      boardSize: 5,
      currentPlayerId: null,
      turnNumber: 1,
      actionsRemaining: 1,
      edges: [],
      cells: [],
      provinces: [],
    },
    players: state.players ?? previous?.players ?? [],
    duels: state.duels ?? previous?.duels ?? [],
    campaign: state.campaign ?? previous?.campaign ?? null,
    matchResult: state.matchResult ?? previous?.matchResult ?? null,
  };
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  return {
    canInstall: Boolean(prompt),
    install: async () => {
      if (!prompt) return;
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    },
  };
}

function resultStars(amount: number): string {
  return [0, 1, 2].map((index) => index < amount ? "★" : "☆").join("");
}

export function App() {
  const clientRef = useRef<HexaClient | null>(null);
  if (!clientRef.current) clientRef.current = new HexaClient();
  const client = clientRef.current;
  const recordedCampaignRoom = useRef<string | null>(null);

  const [connection, setConnection] = useState<ConnectionStatus>("idle");
  const [account, setAccount] = useState<AccountSession | null>(client.accountSession);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [privateState, setPrivateState] = useState<PrivateState | null>(null);
  const [lobby, setLobby] = useState<LobbyRoom[]>([]);
  const [campaignCatalog, setCampaignCatalog] = useState<CampaignCatalog | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>("multiplayer");
  const [notice, setNotice] = useState("Inicializando conexão...");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("Arquiteto");
  const [roomCode, setRoomCode] = useState("");
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [armedCard, setArmedCard] = useState<CardState | null>(null);
  const [duelCards, setDuelCards] = useState<string[]>([]);
  const [showAuth, setShowAuth] = useState(!client.accountSession);
  const installPrompt = useInstallPrompt();

  const refreshCampaign = async () => {
    try {
      const catalog = await client.loadCampaignCatalog();
      setCampaignCatalog(client.accountSession ? catalog : decorateGuestCampaign(catalog));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar a campanha.");
    }
  };

  useEffect(() => {
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ status: ConnectionStatus }>).detail;
      setConnection(detail.status);
      if (detail.status === "open") setNotice("Conectado ao reino Octarina.");
      if (detail.status === "closed") setNotice("Reconectando ao servidor...");
      if (detail.status === "error") setNotice("Falha de conexão. Tentando novamente.");
    };

    const onMessage = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      const payload = message.payload as Record<string, unknown>;

      if (message.type === "server.hello") {
        if (client.roomSession) client.reconnectRoom();
        else client.listLobby();
        void refreshCampaign();
      }

      if (message.type === "account.session") {
        setAccount(payload as unknown as AccountSession);
        setShowAuth(false);
        setNotice("Conta autenticada.");
      }

      if (message.type === "session.established") {
        setSnapshot(payload.snapshot as RoomSnapshot);
        setPrivateState(payload.privateState as PrivateState);
        recordedCampaignRoom.current = null;
        setNotice(`Sala ${String(payload.roomId)} conectada.`);
      }

      if (message.type === "session.reconnected") {
        if (payload.snapshot) setSnapshot(payload.snapshot as RoomSnapshot);
        if (Array.isArray(payload.patches)) {
          const patches = payload.patches as Record<string, unknown>[];
          setSnapshot((current) => patches.reduce<RoomSnapshot | null>(
            (state, patch) => snapshotFromPatch(state, patch),
            current,
          ));
        }
        if (payload.privateState) setPrivateState(payload.privateState as PrivateState);
        setNotice("Partida restaurada.");
      }

      if (message.type === "room.patch") {
        setSnapshot((current) => snapshotFromPatch(current, payload));
        const eventType = (payload.event as { type?: string } | undefined)?.type;
        if (eventType) setNotice(eventType.replaceAll(".", " "));
      }

      if (message.type === "player.private_state") {
        setPrivateState(payload as unknown as PrivateState);
      }

      if (message.type === "lobby.rooms" || message.type === "lobby.updated") {
        const rooms = (payload.rooms ?? payload.lobby ?? []) as LobbyRoom[];
        if (Array.isArray(rooms)) setLobby(rooms.filter((room) => room.mode !== "campaign"));
      }

      if (message.type === "error") {
        setNotice(`${String(payload.code ?? "ERRO")}: ${String(payload.message ?? "Ação recusada")}`);
        if (payload.code === "REVISION_CONFLICT" && client.roomSession) client.reconnectRoom();
      }
    };

    const onAccount = (event: Event) => setAccount((event as CustomEvent<AccountSession | null>).detail);

    client.addEventListener("connection", onConnection);
    client.addEventListener("message", onMessage);
    client.addEventListener("account", onAccount);
    client.connect();

    return () => {
      client.removeEventListener("connection", onConnection);
      client.removeEventListener("message", onMessage);
      client.removeEventListener("account", onAccount);
      client.close();
    };
  }, [client]);

  useEffect(() => {
    if (connection === "open") void refreshCampaign();
  }, [account]);

  useEffect(() => {
    const result = snapshot?.campaign?.result;
    if (!result || !snapshot || recordedCampaignRoom.current === snapshot.roomId) return;
    recordedCampaignRoom.current = snapshot.roomId;
    if (account) {
      client.completeCampaign(snapshot.roomId)
        .then((recorded) => {
          setCampaignCatalog(recorded.catalog);
          if (recorded.unlockedAchievements.length > 0) {
            setNotice(`Conquista desbloqueada: ${recorded.unlockedAchievements.join(", ")}`);
          }
        })
        .catch((error) => setNotice(error instanceof Error ? error.message : "Falha ao salvar progresso."));
    } else if (campaignCatalog) {
      setCampaignCatalog(recordGuestCampaignResult(campaignCatalog, result));
    }
  }, [snapshot?.campaign?.result, account, campaignCatalog, client]);

  const localPlayerId = client.roomSession?.playerId ?? null;
  const localPlayer = snapshot?.players.find((player) => player.id === localPlayerId) ?? null;
  const opponent = snapshot?.players.find((player) => player.id !== localPlayerId) ?? null;
  const activeDuel = snapshot?.duels.find((duel) => duel.status !== "resolved") ?? null;
  const isMyTurn = snapshot?.board.currentPlayerId === localPlayerId;
  const duelEnergy = activeDuel?.attackerId === localPlayerId
    ? activeDuel.attacker?.energy ?? 0
    : activeDuel?.defender?.energy ?? 0;

  const selectedDuelCost = useMemo(() => {
    return privateState?.hand
      .filter((card) => duelCards.includes(card.id))
      .reduce((sum, card) => sum + card.cost, 0) ?? 0;
  }, [privateState, duelCards]);

  const submitAuth = (event: FormEvent) => {
    event.preventDefault();
    try {
      if (authMode === "register") client.register(handle.trim(), displayName.trim(), password);
      else client.login(handle.trim(), password);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível autenticar.");
    }
  };

  const createRoom = () => {
    try {
      client.createRoom(account?.account.displayName || guestName.trim() || "Arquiteto", 5);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível criar a sala.");
    }
  };

  const joinRoom = (id: string) => {
    try {
      client.joinRoom(id.trim().toUpperCase(), account?.account.displayName || guestName.trim() || "Conjurador");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível entrar na sala.");
    }
  };

  const startCampaign = async (missionId: string) => {
    setCampaignLoading(true);
    try {
      const result = await client.startCampaign(missionId, account?.account.displayName || guestName.trim() || "Arquiteto");
      setSnapshot(result.snapshot);
      setPrivateState(result.privateState);
      setSelectedProvinceId(null);
      recordedCampaignRoom.current = null;
      setNotice(`Missão iniciada: ${result.snapshot.campaign?.mission.title ?? missionId}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível iniciar a missão.");
    } finally {
      setCampaignLoading(false);
    }
  };

  const returnToLobby = async (mode: LobbyMode) => {
    client.leaveRoomLocal();
    setSnapshot(null);
    setPrivateState(null);
    setSelectedProvinceId(null);
    setArmedCard(null);
    setDuelCards([]);
    setLobbyMode(mode);
    await refreshCampaign();
    if (mode === "multiplayer" && connection === "open") client.listLobby();
  };

  const playEdge = (start: Point, end: Point) => {
    try {
      if (armedCard?.effect === "expansion") {
        client.playCard(armedCard, { start, end });
        setArmedCard(null);
      } else client.playEdge(start, end);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ação inválida.");
    }
  };

  const playMacroCard = (card: CardState) => {
    try {
      if (card.effect === "expansion") {
        setArmedCard(card);
        setNotice("Expansão armada: toque em dois pilares adjacentes.");
        return;
      }
      if (["fortify", "duel"].includes(card.effect)) {
        if (!selectedProvinceId) {
          setNotice("Selecione uma província no tabuleiro primeiro.");
          return;
        }
        client.playCard(card, { provinceId: selectedProvinceId });
        return;
      }
      client.playCard(card);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Carta recusada.");
    }
  };

  const toggleDuelCard = (card: CardState) => {
    setDuelCards((current) => current.includes(card.id)
      ? current.filter((id) => id !== card.id)
      : [...current, card.id]);
  };

  const submitDuel = () => {
    if (!activeDuel) return;
    if (selectedDuelCost > duelEnergy) {
      setNotice("A sequência excede a energia disponível.");
      return;
    }
    client.resolveDuelRound(activeDuel.id, duelCards);
    setDuelCards([]);
  };

  if (showAuth && !snapshot) {
    return (
      <main className="app auth-screen">
        <section className="brand-panel">
          <div className="octarina-mark">⬡</div>
          <p className="eyebrow">TEHKNÉ SOLUTIONS APRESENTA</p>
          <h1>HEXA<br /><span>OCTARINA</span></h1>
          <p className="tagline">Conquiste linhas. Feche territórios. Domine as eras.</p>
          <div className={`connection-pill ${connection}`}>{notice}</div>
        </section>

        <section className="auth-card glass">
          <div className="segmented">
            <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Entrar</button>
            <button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Criar conta</button>
          </div>
          <form onSubmit={submitAuth}>
            <label>Usuário<input value={handle} onChange={(event) => setHandle(event.target.value)} minLength={3} required /></label>
            {authMode === "register" && (
              <label>Nome de batalha<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} required /></label>
            )}
            <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
            <button className="primary-button" type="submit">{authMode === "register" ? "Criar conta" : "Entrar no reino"}</button>
          </form>
          <button className="ghost-button" onClick={() => { client.useGuest(); setShowAuth(false); }}>Continuar como visitante</button>
          {installPrompt.canInstall && <button className="install-button" onClick={installPrompt.install}>Instalar na tela inicial</button>}
        </section>
      </main>
    );
  }

  if (!snapshot && lobbyMode === "campaign" && campaignCatalog) {
    return (
      <CampaignScreen
        catalog={campaignCatalog}
        loading={campaignLoading}
        playerName={account?.account.displayName ?? guestName}
        onStart={startCampaign}
        onBack={() => setLobbyMode("multiplayer")}
      />
    );
  }

  if (!snapshot) {
    return (
      <main className="app lobby-screen">
        <header className="topbar">
          <div><strong>HEXA OCTARINA</strong><span>WEB MOBILE</span></div>
          <button className="profile-button" onClick={() => setShowAuth(true)}>{account?.account.displayName ?? "Visitante"}</button>
        </header>
        <section className="lobby-content">
          <div className="hero-card glass">
            <p className="eyebrow">ESCOLHA SEU DESTINO</p>
            <h2>Campanha solo ou batalha multiplayer.</h2>
            {!account && <label>Nome de batalha<input value={guestName} onChange={(event) => setGuestName(event.target.value)} /></label>}
            <button className="campaign-button" onClick={() => setLobbyMode("campaign")}>
              <span>⬡</span><div><strong>Campanha solo</strong><small>12 missões, IA, estrelas e conquistas</small></div>
            </button>
            <button className="primary-button" onClick={createRoom}>Criar sala multiplayer</button>
            <div className="join-row">
              <input placeholder="Código da sala" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
              <button onClick={() => joinRoom(roomCode)}>Entrar</button>
            </div>
          </div>

          <section className="rooms-panel">
            <div className="section-heading"><h3>Salas aguardando</h3><button onClick={() => client.listLobby()}>Atualizar</button></div>
            <div className="room-list">
              {lobby.length === 0 && <div className="empty-state">Nenhuma sala pública disponível. A campanha solo está sempre disponível.</div>}
              {lobby.map((room) => (
                <button key={room.roomId} className="room-card" onClick={() => joinRoom(room.roomId)}>
                  <span className="room-code">{room.roomId}</span>
                  <span>{room.playerCount}/2 jogadores</span>
                  <small>Tabuleiro {room.boardSize}×{room.boardSize}</small>
                </button>
              ))}
            </div>
          </section>
        </section>
        <footer className="mobile-footer"><span className={connection === "open" ? "online-dot" : "offline-dot"} />{notice}</footer>
      </main>
    );
  }

  const campaign = snapshot.campaign;
  const campaignResult = campaign?.result ?? null;
  const nextMission = campaignCatalog?.missions.find((mission) => mission.order === (campaign?.mission.order ?? 0) + 1 && mission.unlocked);

  return (
    <main className="app game-screen">
      <header className="game-header glass">
        <div className="player-summary local">
          <strong>{localPlayer?.name ?? privateState?.name ?? "Você"}</strong>
          <span>♥ {privateState?.hp ?? localPlayer?.hp ?? 0}</span>
          <span>✦ {privateState?.mana ?? localPlayer?.mana ?? 0}</span>
        </div>
        <div className="turn-summary">
          <small>{campaign ? `MISSÃO ${campaign.mission.order}` : `SALA ${snapshot.roomId}`}</small>
          <strong>{snapshot.status === "finished" ? "PARTIDA ENCERRADA" : isMyTurn ? "SEU TURNO" : opponent?.isBot ? "IA PENSANDO" : "TURNO RIVAL"}</strong>
          <span>Rodada {snapshot.board.turnNumber} · {snapshot.board.actionsRemaining} ação</span>
        </div>
        <div className="player-summary rival">
          <strong>{opponent?.name ?? "Aguardando rival"}{opponent?.isBot ? " · IA" : ""}</strong>
          <span>♥ {opponent?.hp ?? 0}</span>
          <span>{opponent?.isBot ? opponent.difficulty : opponent?.connected ? "Online" : "Reconectando"}</span>
        </div>
      </header>

      <section className="battlefield">
        <Board
          snapshot={snapshot}
          localPlayerId={localPlayerId}
          disabled={Boolean(activeDuel) || snapshot.status === "finished"}
          onPlayEdge={playEdge}
          onSelectProvince={setSelectedProvinceId}
          selectedProvinceId={selectedProvinceId}
        />
        <aside className={`battle-log glass ${campaign ? "campaign-objectives" : ""}`}>
          {campaign ? (
            <>
              <strong>{campaign.mission.title}</strong>
              <p>{campaign.mission.briefing}</p>
              <div className={`live-objective ${campaign.primary.completed ? "done" : ""}`}><span>◆</span><div><b>{campaign.primary.label}</b><small>{campaign.primary.current}/{campaign.primary.target}</small></div></div>
              {campaign.bonus.map((objective) => (
                <div key={objective.type} className={`live-objective bonus ${objective.completed ? "done" : ""}`}><span>☆</span><div><b>{objective.label}</b><small>{objective.current}/{objective.target}</small></div></div>
              ))}
              <small className="mission-limit">Limite: {campaign.failure.turnLimit} rodadas</small>
            </>
          ) : (
            <><strong>ORÁCULO</strong><p>{notice}</p></>
          )}
          {armedCard && <button className="cancel-button" onClick={() => setArmedCard(null)}>Cancelar {armedCard.name}</button>}
          <button className="danger-link" onClick={() => client.forfeit()}>{campaign ? "Abandonar missão" : "Abandonar partida"}</button>
        </aside>
      </section>

      {activeDuel && snapshot.status !== "finished" && (
        <section className="duel-panel glass">
          <div className="duel-heading">
            <div><small>DUELO DE CÉLULA</small><strong>Energia {selectedDuelCost}/{duelEnergy}</strong></div>
            <button className="primary-button" onClick={submitDuel}>Confirmar sequência</button>
          </div>
          <div className="duel-cards">
            {privateState?.hand.filter((card) => card.kind === "duel").map((card) => (
              <button
                key={card.id}
                className={`card ${duelCards.includes(card.id) ? "selected" : ""}`}
                onClick={() => toggleDuelCard(card)}
              >
                <span className="card-icon">{card.icon}</span><strong>{card.name}</strong><small>{card.description}</small><em>{card.cost}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {!activeDuel && snapshot.status !== "finished" && (
        <section className="hand-tray glass">
          <div className="hand-label"><strong>MÃO</strong><span>{privateState?.hand.length ?? 0} cartas</span></div>
          <div className="hand-scroll">
            {privateState?.hand.map((card) => (
              <button key={card.id} className={`card ${armedCard?.id === card.id ? "selected" : ""}`} onClick={() => playMacroCard(card)}>
                <span className="card-icon">{card.icon}</span>
                <strong>{card.name}</strong>
                <small>{card.description}</small>
                <em>{card.cost}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {campaignResult && (
        <section className="campaign-result-backdrop">
          <div className={`campaign-result glass ${campaignResult.success ? "victory" : "defeat"}`}>
            <span className="result-rune">{campaignResult.success ? "⬡" : "◇"}</span>
            <p className="eyebrow">{campaignResult.success ? "MISSÃO CONCLUÍDA" : "MISSÃO FRACASSADA"}</p>
            <h2>{campaign?.mission.title}</h2>
            <div className="result-stars">{resultStars(campaignResult.stars)}</div>
            <p>{campaignResult.success ? `Recompensa: ${campaignResult.rewardXp} XP` : "Ajuste sua estratégia e tente novamente."}</p>
            <div className="result-stats">
              <span><b>{campaignResult.stats.cells ?? 0}</b>Células</span>
              <span><b>{campaignResult.stats.duelsWon ?? 0}</b>Duelos</span>
              <span><b>{campaignResult.stats.turns ?? 0}</b>Rodadas</span>
            </div>
            <div className="result-actions">
              <button className="ghost-button" onClick={() => void returnToLobby("campaign")}>Mapa da campanha</button>
              <button className="primary-button" onClick={() => {
                const missionId = nextMission?.id ?? campaignResult.missionId;
                void returnToLobby("campaign").then(() => startCampaign(missionId));
              }}>{nextMission ? "Próxima missão" : "Jogar novamente"}</button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
