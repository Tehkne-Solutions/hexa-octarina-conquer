import type { RoomSnapshot, ServerMessage } from "./protocol";
import type { ReplayPatch, ReplayRecord, ReplaySummary } from "./replay-state";

function apiUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

function spectatorUrl(roomId: string): string {
  const configured = import.meta.env.VITE_HEXA_SPECTATOR_URL as string | undefined;
  const base = configured
    ? new URL(configured, window.location.origin)
    : new URL(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/spectator`);
  base.searchParams.set("roomId", roomId);
  return base.toString();
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({ message: response.statusText }));
  if (!response.ok) throw new Error(String(payload.message ?? payload.error ?? `Erro HTTP ${response.status}`));
  return payload as T;
}

export async function loadPublicReplays(options: { status?: string; limit?: number } = {}): Promise<ReplaySummary[]> {
  const url = new URL(apiUrl("/replays"));
  url.searchParams.set("limit", String(Math.min(100, Math.max(1, options.limit ?? 50))));
  if (options.status) url.searchParams.set("status", options.status);
  const payload = await readResponse<{ replays: ReplaySummary[] }>(await fetch(url, { headers: { accept: "application/json" } }));
  return Array.isArray(payload.replays) ? payload.replays : [];
}

export async function loadPublicReplay(roomId: string, afterRevision = 0): Promise<ReplayRecord> {
  const url = new URL(apiUrl(`/replays/${encodeURIComponent(roomId)}`));
  url.searchParams.set("afterRevision", String(Math.max(0, afterRevision)));
  url.searchParams.set("limit", "2000");
  return readResponse<ReplayRecord>(await fetch(url, { headers: { accept: "application/json" } }));
}

export interface SpectatorEstablishedPayload {
  roomId: string;
  snapshot: RoomSnapshot;
  presence: Array<{ playerId: string; online: boolean; lastSeen: number; instances: number }>;
  replay: ReplayRecord | null;
  signature: string;
}

export class SpectatorClient extends EventTarget {
  private socket: WebSocket | null = null;
  private roomId = "";

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(roomId: string): void {
    this.close();
    this.roomId = roomId;
    const url = spectatorUrl(roomId);
    this.dispatchEvent(new CustomEvent("connection", { detail: { status: "connecting", roomId } }));
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.dispatchEvent(new CustomEvent("connection", { detail: { status: "open", roomId } }));
    });
    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        this.dispatchEvent(new CustomEvent("message", { detail: message }));
        this.dispatchEvent(new CustomEvent(message.type, { detail: message.payload }));
      } catch (error) {
        this.dispatchEvent(new CustomEvent("error", { detail: { message: "Evento público inválido.", error } }));
      }
    });
    socket.addEventListener("error", () => {
      this.dispatchEvent(new CustomEvent("connection", { detail: { status: "error", roomId } }));
    });
    socket.addEventListener("close", () => {
      this.socket = null;
      this.dispatchEvent(new CustomEvent("connection", { detail: { status: "closed", roomId } }));
    });
  }

  requestReplay(afterRevision: number): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({
      protocolVersion: "1.0",
      type: "replay.get",
      requestId: `spectator-${crypto.randomUUID()}`,
      payload: { afterRevision: Math.max(0, afterRevision), limit: 2000 },
    }));
  }

  ping(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({
      protocolVersion: "1.0",
      type: "ping",
      requestId: `spectator-ping-${crypto.randomUUID()}`,
      payload: { roomId: this.roomId },
    }));
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
    this.roomId = "";
  }
}

export function isReplayPatch(value: unknown): value is ReplayPatch {
  if (!value || typeof value !== "object") return false;
  const patch = value as ReplayPatch;
  return Number.isFinite(Number(patch.revision)) && Boolean(patch.state || patch.event);
}
