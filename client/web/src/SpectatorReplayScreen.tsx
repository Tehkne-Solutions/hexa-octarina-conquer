import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Board } from "./Board";
import { trackExperience } from "./experience-telemetry";
import {
  isReplayPatch,
  loadPublicReplay,
  loadPublicReplays,
  SpectatorClient,
  type SpectatorEstablishedPayload,
} from "./replay-client";
import {
  applyReplayEvent,
  buildReplayFrames,
  createQaReplayRecord,
  eventFromPatch,
  mergeReplayEvents,
  nearestSignificantFrame,
  replayEventMeta,
  sanitizePublicSnapshot,
  type ReplayRecord,
  type ReplaySummary,
} from "./replay-state";
import type { RoomSnapshot, ServerMessage } from "./protocol";

interface SpectatorReplayScreenProps {
  onClose: () => void;
}

type ReplayFilter = "live" | "finished" | "all";
type StreamStatus = "idle" | "connecting" | "open" | "closed" | "error";

function shortDate(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function elapsedTime(start: number, end: number): string {
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}min ${String(rest).padStart(2, "0")}s` : `${rest}s`;
}

function roomStatus(summary: ReplaySummary): { label: string; tone: string } {
  if (summary.status === "active") return { label: "AO VIVO", tone: "live" };
  if (summary.status === "waiting") return { label: "AGUARDANDO", tone: "waiting" };
  return { label: "REPLAY", tone: "finished" };
}

function publicWinner(snapshot: RoomSnapshot): string | null {
  const winnerId = snapshot.matchResult?.winnerPlayerId;
  return snapshot.players.find((player) => player.id === winnerId)?.name ?? null;
}

function privacyLabel(snapshot: RoomSnapshot): string {
  const handTotal = snapshot.players.reduce((total, player) => total + player.handSize, 0);
  return `${snapshot.players.length} jogadores públicos · ${handTotal} cartas ocultas`;
}

function ReplayPlayerCard({ player, currentPlayer, winner }: { player: RoomSnapshot["players"][number]; currentPlayer: boolean; winner: boolean }) {
  return (
    <article className={`spectator-player ${currentPlayer ? "current" : ""} ${winner ? "winner" : ""}`}>
      <div className="spectator-player-avatar" aria-hidden="true">{player.name.slice(0, 1).toUpperCase()}</div>
      <div>
        <small>{winner ? "VENCEDOR" : currentPlayer ? "TURNO ATUAL" : player.isBot ? "ARQUITETO IA" : "ARQUITETO"}</small>
        <strong>{player.name}</strong>
        <span>♥ {player.hp} · ✦ {player.mana} · Mão {player.handSize}</span>
      </div>
      <i className={player.connected ? "online" : "offline"} title={player.connected ? "Conectado" : "Desconectado"} />
    </article>
  );
}

export function SpectatorReplayScreen({ onClose }: SpectatorReplayScreenProps) {
  const qaMode = useMemo(() => new URL(window.location.href).searchParams.get("qa") === "1", []);
  const streamRef = useRef<SpectatorClient | null>(null);
  const [filter, setFilter] = useState<ReplayFilter>("live");
  const [summaries, setSummaries] = useState<ReplaySummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [record, setRecord] = useState<ReplayRecord | null>(null);
  const [liveSnapshot, setLiveSnapshot] = useState<RoomSnapshot | null>(null);
  const [presence, setPresence] = useState<Array<{ playerId: string; online: boolean }>>([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [followingLive, setFollowingLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("Carregando partidas públicas...");

  const loadIndex = useCallback(async () => {
    if (qaMode) {
      const fixture = createQaReplayRecord();
      const liveFixture: ReplaySummary = {
        ...fixture,
        roomId: "LIVE09",
        status: "active",
        finishedAt: null,
        result: null,
        latestRevision: 4,
        updatedAt: fixture.updatedAt + 20_000,
      };
      setSummaries([liveFixture, fixture]);
      setSelectedRoomId((current) => current || fixture.roomId);
      setRecord(fixture);
      setFrameIndex(fixture.events.length);
      setFollowingLive(false);
      setFilter("all");
      setLoading(false);
      setNotice("Cenário visual de espectador carregado.");
      return;
    }

    try {
      const loaded = await loadPublicReplays({ limit: 80 });
      const publicMatches = loaded.filter((item) => item.players.length >= 2 && item.status !== "waiting");
      setSummaries(publicMatches);
      setSelectedRoomId((current) => current || publicMatches[0]?.roomId || "");
      setNotice(publicMatches.length > 0 ? `${publicMatches.length} partidas públicas encontradas.` : "Nenhuma partida pública disponível agora.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível consultar os replays.");
    } finally {
      setLoading(false);
    }
  }, [qaMode]);

  useEffect(() => {
    trackExperience("screen_view", { screen: "unknown", value: "spectator-opened" });
    void loadIndex();
    if (qaMode) return undefined;
    const timer = window.setInterval(() => void loadIndex(), 15_000);
    return () => window.clearInterval(timer);
  }, [loadIndex, qaMode]);

  const selectedSummary = useMemo(
    () => summaries.find((summary) => summary.roomId === selectedRoomId) ?? null,
    [summaries, selectedRoomId],
  );

  useEffect(() => {
    streamRef.current?.close();
    streamRef.current = null;
    setStreamStatus("idle");
    setPresence([]);
    setLiveSnapshot(null);
    setPlaying(false);
    setFollowingLive(selectedSummary?.status === "active");
    if (!selectedSummary || qaMode) return undefined;

    let cancelled = false;
    setLoading(true);
    setNotice(`Abrindo sala ${selectedSummary.roomId}...`);
    void loadPublicReplay(selectedSummary.roomId)
      .then((loaded) => {
        if (cancelled) return;
        setRecord(loaded);
        setFrameIndex(Math.max(0, loaded.events.length));
        setNotice(selectedSummary.status === "active" ? "Replay carregado. Conectando ao fluxo ao vivo..." : "Replay público pronto.");
      })
      .catch((error) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "Replay indisponível.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    if (selectedSummary.status !== "active") return () => { cancelled = true; };

    const stream = new SpectatorClient();
    streamRef.current = stream;
    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ status: StreamStatus }>).detail;
      setStreamStatus(detail.status);
      if (detail.status === "open") setNotice("Assistindo a partida em tempo real.");
      if (detail.status === "closed") setNotice("Fluxo ao vivo encerrado. O replay continua disponível.");
      if (detail.status === "error") setNotice("Falha no fluxo ao vivo. Exibindo os eventos já recebidos.");
    };
    const onMessage = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      if (message.type === "spectator.established") {
        const payload = message.payload as SpectatorEstablishedPayload;
        setLiveSnapshot(sanitizePublicSnapshot(payload.snapshot));
        setPresence((payload.presence ?? []).map((entry) => ({ playerId: entry.playerId, online: entry.online })));
        if (payload.replay) {
          setRecord((current) => ({
            ...payload.replay!,
            events: mergeReplayEvents(current?.events ?? [], payload.replay!.events ?? []),
          }));
        }
        setFollowingLive(true);
        return;
      }
      if (message.type === "room.patch" && isReplayPatch(message.payload)) {
        const patch = message.payload;
        const entry = eventFromPatch(selectedSummary.roomId, patch);
        const patchedStatus = patch.state?.status;
        setRecord((current) => current ? { ...current, status: patchedStatus ?? current.status, latestRevision: Math.max(current.latestRevision, entry.revision), updatedAt: entry.occurredAt, events: mergeReplayEvents(current.events, [entry]) } : current);
        setLiveSnapshot((current) => current ? applyReplayEvent(current, entry) : current);
        return;
      }
      if (message.type === "replay.data" && message.payload) {
        const incoming = message.payload as ReplayRecord;
        setRecord((current) => incoming ? { ...incoming, events: mergeReplayEvents(current?.events ?? [], incoming.events ?? []) } : current);
        return;
      }
      if (message.type === "presence.updated") {
        const payload = message.payload as { players?: Array<{ playerId: string; online: boolean }> };
        setPresence(payload.players ?? []);
      }
    };
    stream.addEventListener("connection", onConnection);
    stream.addEventListener("message", onMessage);
    stream.connect(selectedSummary.roomId);

    return () => {
      cancelled = true;
      stream.removeEventListener("connection", onConnection);
      stream.removeEventListener("message", onMessage);
      stream.close();
      if (streamRef.current === stream) streamRef.current = null;
    };
  }, [qaMode, selectedSummary?.roomId, selectedSummary?.status]);

  const frames = useMemo(() => record ? buildReplayFrames(record) : [], [record]);

  useEffect(() => {
    if (followingLive && frames.length > 0) setFrameIndex(frames.length - 1);
  }, [followingLive, frames.length]);

  useEffect(() => {
    if (!playing || followingLive || frames.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, Math.max(180, 1_000 / speed));
    return () => window.clearInterval(timer);
  }, [playing, followingLive, frames.length, speed]);

  const visibleSummaries = useMemo(() => summaries.filter((summary) => {
    if (filter === "live") return summary.status === "active";
    if (filter === "finished") return summary.status === "finished";
    return true;
  }), [filter, summaries]);

  useEffect(() => {
    if (visibleSummaries.some((summary) => summary.roomId === selectedRoomId)) return;
    if (visibleSummaries[0]) setSelectedRoomId(visibleSummaries[0].roomId);
  }, [visibleSummaries, selectedRoomId]);

  const safeIndex = Math.min(Math.max(0, frameIndex), Math.max(0, frames.length - 1));
  const currentFrame = frames[safeIndex] ?? null;
  const currentSnapshot = followingLive && liveSnapshot ? liveSnapshot : currentFrame?.snapshot ?? liveSnapshot;
  const currentMeta = currentFrame?.event ? replayEventMeta(currentFrame.event.eventType) : null;
  const winner = currentSnapshot ? publicWinner(currentSnapshot) : null;
  const live = selectedSummary?.status === "active";

  const selectFrame = (index: number) => {
    setFollowingLive(false);
    setPlaying(false);
    setFrameIndex(Math.min(Math.max(0, index), Math.max(0, frames.length - 1)));
  };

  const jumpLive = () => {
    setPlaying(false);
    setFollowingLive(Boolean(live));
    setFrameIndex(Math.max(0, frames.length - 1));
  };

  return (
    <main className="spectator-replay-screen">
      <header className="spectator-shell-header">
        <button type="button" className="spectator-back" onClick={onClose}>← Voltar</button>
        <div>
          <p className="fantasy-eyebrow">Observatório público</p>
          <h1>Espectador e Replay</h1>
          <p>Acompanhe a rede ao vivo ou reveja cada decisão por revisão.</p>
        </div>
        <div className="spectator-privacy-seal"><span>◇</span><strong>VISÃO PÚBLICA</strong><small>Sem mãos, tokens ou dados privados</small></div>
      </header>

      <section className="spectator-layout">
        <aside className="spectator-library glass">
          <div className="spectator-library-heading">
            <div><small>PARTIDAS PÚBLICAS</small><strong>Salão de observação</strong></div>
            <button type="button" onClick={() => void loadIndex()} aria-label="Atualizar partidas">↻</button>
          </div>
          <div className="spectator-filters" role="tablist" aria-label="Filtrar partidas">
            {(["live", "finished", "all"] as ReplayFilter[]).map((option) => (
              <button key={option} type="button" role="tab" aria-selected={filter === option} className={filter === option ? "active" : ""} onClick={() => setFilter(option)}>
                {option === "live" ? "Ao vivo" : option === "finished" ? "Encerradas" : "Todas"}
              </button>
            ))}
          </div>
          <div className="spectator-room-list">
            {loading && summaries.length === 0 ? <div className="spectator-empty"><span>✦</span><p>Consultando o reino...</p></div> : null}
            {!loading && visibleSummaries.length === 0 ? <div className="spectator-empty"><span>◇</span><p>Nenhuma partida nesta categoria.</p></div> : null}
            {visibleSummaries.map((summary) => {
              const status = roomStatus(summary);
              return (
                <button key={summary.roomId} type="button" className={`spectator-room-card ${selectedRoomId === summary.roomId ? "selected" : ""}`} onClick={() => setSelectedRoomId(summary.roomId)}>
                  <span className={`room-status ${status.tone}`}><i />{status.label}</span>
                  <strong>{summary.players.map((player) => player.name).join(" × ") || `Sala ${summary.roomId}`}</strong>
                  <small>Sala {summary.roomId} · Revisão {summary.latestRevision}</small>
                  <span className="room-card-meta"><b>{shortDate(summary.updatedAt)}</b><em>→</em></span>
                </button>
              );
            })}
          </div>
          <footer><span className={`spectator-stream-dot status-${streamStatus}`} /><p>{notice}</p></footer>
        </aside>

        <section className="spectator-stage-column">
          {currentSnapshot ? (
            <>
              <header className="spectator-match-header glass">
                <div className="spectator-match-players">
                  {currentSnapshot.players.map((player) => (
                    <ReplayPlayerCard
                      key={player.id}
                      player={{ ...player, connected: presence.find((entry) => entry.playerId === player.id)?.online ?? player.connected }}
                      currentPlayer={currentSnapshot.board.currentPlayerId === player.id}
                      winner={currentSnapshot.matchResult?.winnerPlayerId === player.id}
                    />
                  ))}
                </div>
                <div className="spectator-match-state">
                  <span className={live && followingLive ? "live" : "replay"}>{live && followingLive ? "● AO VIVO" : `REVISÃO ${currentFrame?.revision ?? currentSnapshot.revision}`}</span>
                  <strong>{winner ? `${winner} venceu` : currentSnapshot.status === "finished" ? "Partida encerrada" : `Rodada ${currentSnapshot.board.turnNumber}`}</strong>
                  <small>{privacyLabel(currentSnapshot)}</small>
                </div>
              </header>

              <div className="spectator-board-shell glass">
                <Board
                  snapshot={currentSnapshot}
                  localPlayerId={null}
                  disabled
                  selectedProvinceId={null}
                  onPlayEdge={() => undefined}
                  onSelectProvince={() => undefined}
                />
                <div className="spectator-watermark" aria-hidden="true">MODO ESPECTADOR · TEHKNÉ SOLUTIONS</div>
              </div>

              <section className="replay-controls glass" aria-label="Controles do replay">
                <div className="replay-current-event">
                  <span className={`event-icon tone-${currentMeta?.tone ?? "neutral"}`}>{currentMeta?.icon ?? "▶"}</span>
                  <div><small>{currentFrame ? shortDate(currentFrame.occurredAt) : "Agora"}</small><strong>{currentMeta?.label ?? "Estado inicial"}</strong><p>{currentMeta?.detail ?? "A arena pública foi preparada."}</p></div>
                </div>
                <div className="replay-control-row">
                  <button type="button" onClick={() => selectFrame(0)} disabled={safeIndex === 0} aria-label="Ir ao início">|◀</button>
                  <button type="button" onClick={() => selectFrame(nearestSignificantFrame(frames, safeIndex, -1))} disabled={safeIndex === 0} aria-label="Evento anterior">◀</button>
                  <button type="button" className="replay-play" onClick={() => { setFollowingLive(false); setPlaying((current) => !current); }} disabled={frames.length <= 1 || safeIndex >= frames.length - 1}>{playing ? "Ⅱ" : "▶"}</button>
                  <button type="button" onClick={() => selectFrame(nearestSignificantFrame(frames, safeIndex, 1))} disabled={safeIndex >= frames.length - 1} aria-label="Próximo evento">▶</button>
                  <button type="button" onClick={jumpLive} disabled={!live && safeIndex >= frames.length - 1}>{live ? "AO VIVO" : "▶|"}</button>
                  <label>Velocidade<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={0.5}>0,5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
                  <span>{record ? elapsedTime(record.createdAt, currentFrame?.occurredAt ?? record.updatedAt) : "0s"}</span>
                </div>
                <input
                  className="replay-range"
                  type="range"
                  min={0}
                  max={Math.max(0, frames.length - 1)}
                  value={safeIndex}
                  onChange={(event) => selectFrame(Number(event.target.value))}
                  aria-label="Revisão do replay"
                />
              </section>
            </>
          ) : (
            <div className="spectator-stage-empty glass"><span>⬡</span><h2>Escolha uma partida</h2><p>O tabuleiro público, os jogadores e a timeline aparecerão aqui.</p></div>
          )}
        </section>

        <aside className="replay-timeline glass">
          <header><small>LINHA DO TEMPO</small><strong>{record ? `${record.events.length} eventos públicos` : "Nenhum replay aberto"}</strong></header>
          <div className="timeline-scroll">
            {frames.map((frame) => {
              const meta = frame.event ? replayEventMeta(frame.event.eventType) : { label: "Estado inicial", detail: "A sala pública foi criada.", icon: "▶", tone: "neutral" as const, significant: true };
              return (
                <button key={`${frame.revision}-${frame.index}`} type="button" className={`timeline-event tone-${meta.tone} ${safeIndex === frame.index ? "active" : ""} ${meta.significant ? "significant" : ""}`} onClick={() => selectFrame(frame.index)}>
                  <span>{meta.icon}</span>
                  <div><small>R{frame.revision} · {shortDate(frame.occurredAt)}</small><strong>{meta.label}</strong><p>{meta.detail}</p></div>
                </button>
              );
            })}
          </div>
          <footer><span>🔒</span><p>Cartas da mão, submissões de duelo, tokens e dados de conta nunca entram neste fluxo.</p></footer>
        </aside>
      </section>
    </main>
  );
}
