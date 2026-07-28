import { useEffect, useRef, useState } from "react";

import {
  PWA_STATE_EVENT,
  mergePwaRuntimeSnapshot,
  pwaPatchFromEvent,
  readPwaRuntimeSnapshot,
  requestPwaUpdate,
  requestPwaUpdateCheck,
} from "./pwa-lifecycle";

interface SystemStatusCenterProps {
  battleActive: boolean;
  realmStatus: "loading" | "online" | "offline";
  onRetrySync: () => void;
}

export function SystemStatusCenter({ battleActive, realmStatus, onRetrySync }: SystemStatusCenterProps) {
  const [runtime, setRuntime] = useState(readPwaRuntimeSnapshot);
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [offlineReadyDismissed, setOfflineReadyDismissed] = useState(false);
  const [deferredUpdate, setDeferredUpdate] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onPwaState = (event: Event) => {
      const patch = pwaPatchFromEvent(event);
      setRuntime((current) => mergePwaRuntimeSnapshot(current, patch));
      if (patch.updateAvailable) setUpdateDismissed(false);
    };
    const onOnline = () => {
      setBrowserOnline(true);
      setReconnected(true);
      onRetrySync();
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = window.setTimeout(() => setReconnected(false), 4_000);
    };
    const onOffline = () => {
      setBrowserOnline(false);
      setReconnected(false);
    };

    window.addEventListener(PWA_STATE_EVENT, onPwaState);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener(PWA_STATE_EVENT, onPwaState);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
    };
  }, [onRetrySync]);

  useEffect(() => {
    if (!battleActive && deferredUpdate && runtime.updateAvailable) {
      setDeferredUpdate(false);
      requestPwaUpdate();
    }
  }, [battleActive, deferredUpdate, runtime.updateAvailable]);

  const applyUpdate = () => {
    if (battleActive) {
      setDeferredUpdate(true);
      setUpdateDismissed(true);
      return;
    }
    requestPwaUpdate();
  };

  const connectionMessage = !browserOnline
    ? "Sem internet. O prólogo, a coleção e os dados já salvos continuam disponíveis neste aparelho."
    : realmStatus === "offline"
      ? "O servidor está indisponível. O jogo está usando os dados locais enquanto tenta reconectar."
      : reconnected
        ? "Conexão restaurada. O progresso está sendo sincronizado."
        : null;

  return (
    <div className={`system-status-center ${battleActive ? "is-battle-active" : ""}`} aria-live="polite" aria-atomic="true">
      {connectionMessage ? battleActive ? (
        <button type="button" className={`system-status-chip connection-chip ${!browserOnline || realmStatus === "offline" ? "warning" : "success"}`} onClick={browserOnline && realmStatus === "offline" ? onRetrySync : undefined}>
          <span aria-hidden="true">{!browserOnline || realmStatus === "offline" ? "◇" : "✓"}</span>
          {!browserOnline ? "Offline" : realmStatus === "offline" ? "Modo local" : "Reconectado"}
        </button>
      ) : (
        <section className={`system-status-card connection-status ${!browserOnline || realmStatus === "offline" ? "warning" : "success"}`}>
          <span aria-hidden="true">{!browserOnline || realmStatus === "offline" ? "◇" : "✓"}</span>
          <div><strong>{!browserOnline ? "Modo offline" : realmStatus === "offline" ? "Modo local" : "Reino reconectado"}</strong><p>{connectionMessage}</p></div>
          {browserOnline && realmStatus === "offline" ? <button type="button" onClick={onRetrySync}>Tentar novamente</button> : null}
        </section>
      ) : null}

      {runtime.updateAvailable && !updateDismissed ? battleActive ? (
        <button type="button" className="system-status-chip update-chip" onClick={applyUpdate} title="Aplicar atualização ao sair da batalha">
          ✦ Atualizar depois
        </button>
      ) : (
        <section className="system-status-card update-status" role="alert">
          <span aria-hidden="true">✦</span>
          <div><strong>Uma nova versão do reino chegou</strong><p>Atualize para receber as correções e melhorias mais recentes.</p></div>
          <div className="system-status-actions">
            <button type="button" className="status-primary" onClick={applyUpdate}>Atualizar agora</button>
            <button type="button" onClick={() => { setUpdateDismissed(true); setDeferredUpdate(false); }}>Depois</button>
          </div>
        </section>
      ) : null}

      {runtime.updateAvailable && updateDismissed ? (
        <button type="button" className="system-update-chip" onClick={() => setUpdateDismissed(false)}>✦ Nova versão</button>
      ) : null}

      {runtime.offlineReady && !offlineReadyDismissed && !connectionMessage && !battleActive ? (
        <section className="system-status-card offline-ready-status">
          <span aria-hidden="true">⬡</span>
          <div><strong>Conteúdo preparado para uso offline</strong><p>O shell e os recursos principais foram armazenados neste dispositivo.</p></div>
          <button type="button" onClick={() => setOfflineReadyDismissed(true)} aria-label="Fechar aviso de conteúdo offline">×</button>
        </section>
      ) : null}

      {runtime.registrationError && !battleActive ? (
        <section className="system-status-card registration-error" role="alert">
          <span aria-hidden="true">!</span>
          <div><strong>Atualização automática indisponível</strong><p>O jogo continua funcionando, mas pode ser necessário recarregar a página manualmente.</p></div>
          <button type="button" onClick={requestPwaUpdateCheck}>Verificar novamente</button>
        </section>
      ) : null}
    </div>
  );
}
