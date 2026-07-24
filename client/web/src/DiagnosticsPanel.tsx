import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CLIENT_RELEASE_SHA,
  CLIENT_RELEASE_VERSION,
  collectSupportBundle,
  type SupportBundle,
} from "./experience-telemetry";

interface DiagnosticsPanelProps {
  realmStatus: "loading" | "online" | "offline";
}

function formatBytes(value: number | null): string {
  if (value === null) return "Não disponível";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function healthLabel(bundle: SupportBundle | null): string {
  const health = bundle?.health;
  if (!health || typeof health !== "object") return "Não consultado";
  if ("ok" in health && health.ok === true) return "Saudável";
  return "Indisponível";
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function DiagnosticsPanel({ realmStatus }: DiagnosticsPanelProps) {
  const [bundle, setBundle] = useState<SupportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setBundle(await collectSupportBundle(realmStatus));
    setLoading(false);
  }, [realmStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const report = useMemo(() => bundle ? JSON.stringify(bundle, null, 2) : "", [bundle]);
  const copyReport = async () => {
    if (!report) return;
    await copyText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <section className="diagnostics-panel" aria-labelledby="diagnostics-title">
      <header>
        <div>
          <p className="fantasy-eyebrow">Suporte e publicação</p>
          <h2 id="diagnostics-title">Diagnóstico do reino</h2>
          <p>Verifique release, servidor, PWA, armazenamento e viewport sem expor dados da conta ou da partida.</p>
        </div>
        <div className="diagnostics-actions">
          <button type="button" className="fantasy-button compact" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Verificando..." : "Verificar novamente"}
          </button>
          <button type="button" className="fantasy-button compact" onClick={() => void copyReport()} disabled={!bundle}>
            {copied ? "Relatório copiado" : "Copiar relatório"}
          </button>
        </div>
      </header>

      <div className="diagnostics-grid" aria-live="polite">
        <article>
          <span aria-hidden="true">◆</span>
          <div><small>Cliente</small><strong>v{CLIENT_RELEASE_VERSION}</strong><p>Commit {CLIENT_RELEASE_SHA}</p></div>
        </article>
        <article className={healthLabel(bundle) === "Saudável" ? "healthy" : "warning"}>
          <span aria-hidden="true">⬡</span>
          <div><small>Servidor</small><strong>{healthLabel(bundle)}</strong><p>Reino {realmStatus}</p></div>
        </article>
        <article>
          <span aria-hidden="true">▣</span>
          <div><small>PWA</small><strong>{bundle?.pwa.registrationReady ? "Registrada" : "Verificando"}</strong><p>{bundle?.pwa.offlineReady ? "Shell offline disponível" : "Cache em preparação"}</p></div>
        </article>
        <article>
          <span aria-hidden="true">▤</span>
          <div><small>Armazenamento</small><strong>{formatBytes(bundle?.storage.usage ?? null)}</strong><p>{bundle?.storage.caches.length ?? 0} cache(s) ativo(s)</p></div>
        </article>
        <article>
          <span aria-hidden="true">▱</span>
          <div><small>Viewport</small><strong>{bundle ? `${bundle.viewport.width}×${bundle.viewport.height}` : "—"}</strong><p>{bundle?.viewport.widthClass ?? "unknown"} · {bundle?.viewport.heightClass ?? "unknown"}</p></div>
        </article>
        <article>
          <span aria-hidden="true">◉</span>
          <div><small>Conexão</small><strong>{bundle?.connection.online ? "Navegador online" : "Navegador offline"}</strong><p>{bundle?.connection.origin ?? window.location.origin}</p></div>
        </article>
      </div>

      <details className="diagnostics-raw">
        <summary>Visualizar relatório técnico</summary>
        <pre>{report || "Coletando diagnóstico..."}</pre>
      </details>
      <small className="diagnostics-privacy">O relatório copiado fica sob controle do jogador. A telemetria enviada automaticamente contém somente eventos operacionais agregáveis.</small>
    </section>
  );
}
