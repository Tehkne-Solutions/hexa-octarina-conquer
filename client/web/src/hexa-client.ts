import {
  emitAccountSessionChanged,
  type GuestProgressStrategy,
  type GuestProgressSyncResponse,
} from "./account-sync";
import {
  PROTOCOL_VERSION,
  type AccountSession,
  type CampaignCatalog,
  type CampaignResult,
  type CardState,
  type OutgoingMessage,
  type Point,
  type PrivateState,
  type RoomSession,
  type RoomSnapshot,
  type ServerMessage,
  makeRequestId,
} from "./protocol";
import type { LivingCampaignProgress } from "./unified-progress";

const ROOM_SESSION_KEY = "hexa.web.room-session.v1";
const ACCOUNT_SESSION_KEY = "hexa.web.account-session.v1";

function defaultSocketUrl(): string {
  const configured = import.meta.env.VITE_HEXA_WS_URL as string | undefined;
  if (configured) return configured;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function apiUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({ message: response.statusText }));
  if (!response.ok) throw new Error(String(payload.message ?? payload.error ?? `Erro HTTP ${response.status}`));
  return payload as T;
}

function requestError(message: ServerMessage): Error {
  const payload = message.payload as { code?: string; message?: string };
  const error = new Error(payload.message ?? "A solicitação foi recusada pelo servidor.");
  error.name = payload.code ?? "SERVER_ERROR";
  return error;
}

export class HexaClient extends EventTarget {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private manualClose = false;
  private attempts = 0;

  roomSession = readJson<RoomSession>(ROOM_SESSION_KEY);
  accountSession = readJson<AccountSession>(ACCOUNT_SESSION_KEY);

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(url = defaultSocketUrl()): void {
    if (
      this.socket
      && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) return;
    this.manualClose = false;
    this.dispatch("connection", { status: "connecting", url });
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.attempts = 0;
      this.dispatch("connection", { status: "open", url });
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        this.consume(message);
      } catch (error) {
        this.dispatch("client-error", { message: "Resposta inválida do servidor.", error });
      }
    });

    socket.addEventListener("error", () => {
      this.dispatch("connection", { status: "error", url });
    });

    socket.addEventListener("close", () => {
      this.socket = null;
      this.dispatch("connection", { status: "closed", url });
      if (!this.manualClose) this.scheduleReconnect(url);
    });
  }

  async connectReady(timeoutMs = 10_000): Promise<void> {
    if (this.connected) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("O reino demorou para responder. Verifique a conexão e tente novamente."));
      }, timeoutMs);
      const onConnection = (event: Event) => {
        const status = (event as CustomEvent<{ status?: string }>).detail?.status;
        if (status === "open") {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        this.removeEventListener("connection", onConnection);
      };
      this.addEventListener("connection", onConnection);
      this.connect();
    });
  }

  close(): void {
    this.manualClose = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  send<T>(type: string, payload: T, requestPrefix = "web"): string {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Servidor indisponível. Reconecte antes de enviar a ação.");
    }
    const requestId = makeRequestId(requestPrefix);
    const message: OutgoingMessage<T> = { protocolVersion: PROTOCOL_VERSION, type, requestId, payload };
    this.socket.send(JSON.stringify(message));
    return requestId;
  }

  request<T>(
    type: string,
    payload: unknown,
    expectedType: string | string[],
    requestPrefix = "request",
    timeoutMs = 12_000,
  ): Promise<T> {
    const accepted = new Set(Array.isArray(expectedType) ? expectedType : [expectedType]);
    return new Promise<T>((resolve, reject) => {
      let requestId = "";
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("A solicitação expirou antes da resposta do reino."));
      }, timeoutMs);
      const onMessage = (event: Event) => {
        const message = (event as CustomEvent<ServerMessage>).detail;
        if (!requestId || message.requestId !== requestId) return;
        if (message.type === "error") {
          cleanup();
          reject(requestError(message));
          return;
        }
        if (!accepted.has(message.type)) return;
        cleanup();
        resolve(message.payload as T);
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        this.removeEventListener("message", onMessage);
      };
      this.addEventListener("message", onMessage);
      try {
        requestId = this.send(type, payload, requestPrefix);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  register(handle: string, displayName: string, password: string): void {
    this.send("account.register", { handle, displayName, password }, "register");
  }

  async registerAsync(handle: string, displayName: string, password: string): Promise<AccountSession> {
    await this.connectReady();
    return this.request<AccountSession>(
      "account.register",
      { handle, displayName, password },
      "account.session",
      "register",
    );
  }

  login(handle: string, password: string): void {
    this.send("account.login", { handle, password }, "login");
  }

  async loginAsync(handle: string, password: string): Promise<AccountSession> {
    await this.connectReady();
    return this.request<AccountSession>(
      "account.login",
      { handle, password },
      "account.session",
      "login",
    );
  }

  async requestRecovery(handle: string): Promise<{ accepted: boolean; expiresAt: number; recoveryCode?: string }> {
    await this.connectReady();
    return this.request(
      "account.recovery.request",
      { handle },
      "account.recovery.requested",
      "recovery-request",
    );
  }

  async confirmRecovery(handle: string, recoveryCode: string, newPassword: string): Promise<AccountSession> {
    await this.connectReady();
    return this.request<AccountSession>(
      "account.recovery.confirm",
      { handle, recoveryCode, newPassword },
      "account.session",
      "recovery-confirm",
    );
  }

  useGuest(): void {
    this.accountSession = null;
    localStorage.removeItem(ACCOUNT_SESSION_KEY);
    this.dispatch("account", null);
    emitAccountSessionChanged(null);
  }

  async syncGuestProgress(
    localProgress: LivingCampaignProgress,
    strategy: GuestProgressStrategy,
  ): Promise<GuestProgressSyncResponse> {
    const account = this.accountSession;
    if (!account) throw new Error("Entre com uma conta antes de sincronizar o progresso.");
    const response = await readResponse<GuestProgressSyncResponse>(await fetch(apiUrl("/campaign/sync-guest"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.account.id,
        accessToken: account.accessToken,
        localProgress,
        strategy,
      }),
    }));
    this.accountSession = {
      ...account,
      account: { ...account.account, ...(response.profile ?? response.xpReward?.profile ?? {}) },
    };
    localStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(this.accountSession));
    this.dispatch("account", this.accountSession);
    emitAccountSessionChanged(this.accountSession);
    return response;
  }

  listLobby(status = "waiting"): void {
    this.send("lobby.list", { status }, "lobby");
  }

  createRoom(playerName: string, boardSize = 5): void {
    const account = this.accountSession;
    this.send("room.create", account
      ? { accountId: account.account.id, accessToken: account.accessToken, boardSize }
      : { playerName, boardSize }, "create-room");
  }

  joinRoom(roomId: string, playerName: string): void {
    const account = this.accountSession;
    this.send("room.join", account
      ? { roomId, accountId: account.account.id, accessToken: account.accessToken }
      : { roomId, playerName }, "join-room");
  }

  async loadCampaignCatalog(): Promise<CampaignCatalog> {
    const account = this.accountSession;
    const headers: HeadersInit = account
      ? { "x-account-id": account.account.id, authorization: `Bearer ${account.accessToken}` }
      : {};
    return readResponse<CampaignCatalog>(await fetch(apiUrl("/campaign/catalog"), { headers }));
  }

  async loadCampaignProgress(): Promise<{ catalog: CampaignCatalog; progress: unknown }> {
    const account = this.accountSession;
    if (!account) throw new Error("Entre com uma conta para sincronizar o progresso da campanha.");
    return readResponse(await fetch(apiUrl("/campaign/progress"), {
      headers: { "x-account-id": account.account.id, authorization: `Bearer ${account.accessToken}` },
    }));
  }

  async startCampaign(missionId: string, playerName: string): Promise<{ snapshot: RoomSnapshot; privateState: PrivateState }> {
    const account = this.accountSession;
    const payload = account
      ? { missionId, accountId: account.account.id, accessToken: account.accessToken }
      : { missionId, playerName };
    const result = await readResponse<{
      roomId: string;
      playerId: string;
      sessionToken: string;
      snapshot: RoomSnapshot;
      privateState: PrivateState;
    }>(await fetch(apiUrl("/campaign/start"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));
    this.roomSession = {
      roomId: result.roomId,
      playerId: result.playerId,
      sessionToken: result.sessionToken,
      lastRevision: result.snapshot.revision,
    };
    localStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(this.roomSession));
    this.dispatch("message", { type: "session.established", payload: result } satisfies ServerMessage);
    if (this.connected) this.reconnectRoom();
    return result;
  }

  async completeCampaign(roomId: string): Promise<{
    result: CampaignResult;
    catalog: CampaignCatalog;
    unlockedAchievements: string[];
    xpReward: {
      recorded: boolean;
      xpAwarded: number;
      profile: AccountSession["account"];
    };
  }> {
    const account = this.accountSession;
    if (!account) throw new Error("O progresso visitante é salvo somente neste aparelho.");
    const result = await readResponse<{
      result: CampaignResult;
      catalog: CampaignCatalog;
      unlockedAchievements: string[];
      xpReward: {
        recorded: boolean;
        xpAwarded: number;
        profile: AccountSession["account"];
      };
    }>(await fetch(apiUrl("/campaign/complete"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomId,
        accountId: account.account.id,
        accessToken: account.accessToken,
      }),
    }));

    if (result.xpReward?.profile) {
      this.accountSession = {
        ...account,
        account: { ...account.account, ...result.xpReward.profile },
      };
      localStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(this.accountSession));
      this.dispatch("account", this.accountSession);
      emitAccountSessionChanged(this.accountSession);
    }
    return result;
  }

  reconnectRoom(): void {
    const session = this.roomSession;
    if (!session) return;
    this.send("room.reconnect", {
      roomId: session.roomId,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      lastRevision: session.lastRevision,
    }, "reconnect-room");
  }

  leaveRoomLocal(): void {
    this.roomSession = null;
    localStorage.removeItem(ROOM_SESSION_KEY);
  }

  playEdge(start: Point, end: Point): void {
    const session = this.requireRoomSession();
    this.send("action.play_edge", {
      roomId: session.roomId,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      expectedRevision: session.lastRevision,
      start,
      end,
    }, "edge");
  }

  playCard(card: CardState, options: { provinceId?: string; start?: Point; end?: Point } = {}): void {
    const session = this.requireRoomSession();
    this.send("action.play_card", {
      roomId: session.roomId,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      expectedRevision: session.lastRevision,
      cardId: card.id,
      ...options,
    }, "card");
  }

  resolveDuelRound(duelId: string, cardIds: string[]): void {
    const session = this.requireRoomSession();
    this.send("action.resolve_duel_round", {
      roomId: session.roomId,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      expectedRevision: session.lastRevision,
      duelId,
      cardIds,
    }, "duel");
  }

  forfeit(): void {
    const session = this.requireRoomSession();
    this.send("match.forfeit", {
      roomId: session.roomId,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      expectedRevision: session.lastRevision,
    }, "forfeit");
  }

  private consume(message: ServerMessage): void {
    if (message.type === "account.session") {
      this.accountSession = message.payload as AccountSession;
      localStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(this.accountSession));
      this.dispatch("account", this.accountSession);
      emitAccountSessionChanged(this.accountSession);
    }

    if (message.type === "session.established" || message.type === "session.reconnected") {
      const payload = message.payload as Record<string, unknown>;
      const snapshot = payload.snapshot as { revision?: number } | undefined;
      this.roomSession = {
        roomId: String(payload.roomId),
        playerId: String(payload.playerId),
        sessionToken: String(payload.sessionToken),
        lastRevision: Number(snapshot?.revision ?? payload.revision ?? 0),
      };
      localStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(this.roomSession));
    }

    if (message.type === "room.patch") {
      const patch = message.payload as { revision?: number };
      if (this.roomSession && typeof patch.revision === "number") {
        this.roomSession.lastRevision = patch.revision;
        localStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(this.roomSession));
      }
    }

    this.dispatch("message", message);
    this.dispatch(message.type, message.payload);
  }

  private requireRoomSession(): RoomSession {
    if (!this.roomSession) throw new Error("Nenhuma sessão de partida está ativa.");
    return this.roomSession;
  }

  private scheduleReconnect(url: string): void {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(10_000, 800 * 2 ** this.attempts++);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(url);
    }, delay);
  }

  private dispatch(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
