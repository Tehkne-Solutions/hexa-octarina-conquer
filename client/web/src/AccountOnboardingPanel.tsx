import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  applySynchronizedProgress,
  createProgressBackup,
  guestProgressHasActivity,
  progressSummary,
  readProgressBackups,
  type GuestProgressStrategy,
  type GuestProgressSyncResponse,
} from "./account-sync";
import { HexaClient } from "./hexa-client";
import type { AccountSession } from "./protocol";
import { readLivingCampaignProgress, type LivingCampaignProgress } from "./unified-progress";

type PanelMode = "intro" | "login" | "register" | "recovery-request" | "recovery-confirm" | "sync" | "success" | "account";

interface AccountOnboardingPanelProps {
  open: boolean;
  account: AccountSession | null;
  realmStatus: "loading" | "online" | "offline";
  onClose: () => void;
  onAccountChanged: (account: AccountSession | null) => void;
  onSynchronized: () => void;
}

function relationCopy(relation: GuestProgressSyncResponse["relation"]): { title: string; description: string } {
  if (relation === "local-ahead") return {
    title: "Este dispositivo está mais avançado",
    description: "A união recomendada leva o avanço local para a conta sem apagar registros remotos.",
  };
  if (relation === "remote-ahead") return {
    title: "A conta está mais avançada",
    description: "Você pode restaurar o avanço da conta neste dispositivo ou unir recompensas e registros.",
  };
  if (relation === "conflict") return {
    title: "Encontramos duas versões da jornada",
    description: "Nenhuma será sobrescrita automaticamente. Escolha como resolver após revisar os dois lados.",
  };
  return {
    title: "Progresso já sincronizado",
    description: "O dispositivo e a conta possuem o mesmo registro.",
  };
}

function accountInitial(account: AccountSession | null): PanelMode {
  return account ? "account" : "intro";
}

export function AccountOnboardingPanel({
  open,
  account,
  realmStatus,
  onClose,
  onAccountChanged,
  onSynchronized,
}: AccountOnboardingPanelProps) {
  const clientRef = useRef<HexaClient | null>(null);
  if (!clientRef.current) clientRef.current = new HexaClient();
  const client = clientRef.current;
  const [mode, setMode] = useState<PanelMode>(() => accountInitial(account));
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [exposedRecoveryCode, setExposedRecoveryCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<GuestProgressSyncResponse | null>(null);
  const [localProgress, setLocalProgress] = useState<LivingCampaignProgress>(readLivingCampaignProgress);
  const [synchronized, setSynchronized] = useState<GuestProgressSyncResponse | null>(null);

  const activeAccount = account ?? client.accountSession;
  const backupCount = useMemo(() => readProgressBackups().filter((item) => item.accountId === activeAccount?.account.id).length, [activeAccount?.account.id, synchronized]);

  useEffect(() => {
    if (!open) return;
    setLocalProgress(readLivingCampaignProgress());
    setMode(accountInitial(account));
    setPreview(null);
    setSynchronized(null);
    setNotice(null);
    setPassword("");
    setRecoveryCode("");
    setExposedRecoveryCode(null);
  }, [open, account?.account.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  useEffect(() => () => client.close(), [client]);

  if (!open) return null;

  const prepareSynchronization = async (session: AccountSession) => {
    onAccountChanged(session);
    const currentLocal = readLivingCampaignProgress();
    setLocalProgress(currentLocal);
    const result = await client.syncGuestProgress(currentLocal, "preview");
    setPreview(result);
    if (result.relation === "equal") {
      applySynchronizedProgress(result);
      setSynchronized(result);
      setMode("success");
      onSynchronized();
      return;
    }
    setMode("sync");
  };

  const submitAuthentication = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const session = mode === "register"
        ? await client.registerAsync(handle.trim(), displayName.trim(), password)
        : await client.loginAsync(handle.trim(), password);
      await prepareSynchronization(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível autenticar a conta.");
    } finally {
      setBusy(false);
    }
  };

  const requestRecovery = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const result = await client.requestRecovery(handle.trim());
      setExposedRecoveryCode(result.recoveryCode ?? null);
      setMode("recovery-confirm");
      setNotice("Se o usuário existir, o código foi enviado pelo canal configurado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível iniciar a recuperação.");
    } finally {
      setBusy(false);
    }
  };

  const confirmRecovery = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const session = await client.confirmRecovery(handle.trim(), recoveryCode.trim(), password);
      await prepareSynchronization(session);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Código inválido ou expirado.");
    } finally {
      setBusy(false);
    }
  };

  const synchronize = async (strategy: Exclude<GuestProgressStrategy, "preview">) => {
    const session = client.accountSession ?? account;
    if (!session) return;
    setBusy(true);
    setNotice(null);
    try {
      createProgressBackup(session.account.id, strategy, localProgress);
      const result = await client.syncGuestProgress(localProgress, strategy);
      applySynchronizedProgress(result);
      setSynchronized(result);
      setPreview(result);
      setMode("success");
      onAccountChanged(client.accountSession);
      onSynchronized();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível sincronizar o progresso.");
    } finally {
      setBusy(false);
    }
  };

  const disconnectAccount = () => {
    client.useGuest();
    onAccountChanged(null);
    setMode("intro");
    setPreview(null);
    setSynchronized(null);
    onSynchronized();
  };

  const openSyncForAccount = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const current = readLivingCampaignProgress();
      setLocalProgress(current);
      const result = await client.syncGuestProgress(current, "preview");
      setPreview(result);
      if (result.relation === "equal") {
        setSynchronized(result);
        setMode("success");
      } else setMode("sync");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível comparar o progresso.");
    } finally {
      setBusy(false);
    }
  };

  const copy = preview ? relationCopy(preview.relation) : null;
  const hasLocalProgress = guestProgressHasActivity(localProgress);

  return (
    <div className="account-onboarding-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="account-onboarding-panel" role="dialog" aria-modal="true" aria-labelledby="account-panel-title">
        <button type="button" className="account-panel-close" onClick={onClose} disabled={busy} aria-label="Fechar painel de conta">×</button>
        <header className="account-panel-header">
          <span className="account-panel-sigil" aria-hidden="true">✦</span>
          <div>
            <p className="fantasy-eyebrow">Conta e sincronização</p>
            <h1 id="account-panel-title">Proteja sua jornada</h1>
            <small className={`account-realm-state state-${realmStatus}`}>{realmStatus === "online" ? "Reino disponível" : realmStatus === "loading" ? "Conectando ao reino" : "Sincronização indisponível offline"}</small>
          </div>
        </header>

        {mode === "intro" ? (
          <div className="account-panel-content account-intro">
            <div className="account-local-summary">
              <span aria-hidden="true">⬡</span>
              <div><small>Salvo neste dispositivo</small><strong>{progressSummary(localProgress)}</strong><p>Você pode continuar como visitante. A conta serve para recuperar e usar o progresso em outros dispositivos.</p></div>
            </div>
            <div className="account-benefit-grid">
              <article><b>01</b><strong>Sem bloqueio</strong><span>Jogue antes de criar a conta.</span></article>
              <article><b>02</b><strong>Com backup</strong><span>Toda migração guarda uma cópia local.</span></article>
              <article><b>03</b><strong>Sem sobrescrita</strong><span>Conflitos exigem uma decisão explícita.</span></article>
            </div>
            <div className="account-panel-actions">
              <button type="button" className="fantasy-button primary" onClick={() => setMode("register")} disabled={realmStatus !== "online"}>Criar conta</button>
              <button type="button" className="fantasy-button" onClick={() => setMode("login")} disabled={realmStatus !== "online"}>Já tenho conta</button>
              <button type="button" className="account-text-button" onClick={onClose}>Continuar como visitante</button>
            </div>
          </div>
        ) : null}

        {mode === "login" || mode === "register" ? (
          <form className="account-auth-form" onSubmit={submitAuthentication}>
            <div className="account-segmented" role="tablist" aria-label="Tipo de acesso">
              <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
              <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Criar conta</button>
            </div>
            <label><span>Usuário</span><input autoFocus value={handle} onChange={(event) => setHandle(event.target.value)} minLength={3} maxLength={32} autoComplete="username" required /></label>
            {mode === "register" ? <label><span>Nome de batalha</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={48} autoComplete="nickname" required /></label> : null}
            <label><span>Senha</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} required /></label>
            <button type="submit" className="fantasy-button primary" disabled={busy || realmStatus !== "online"}>{busy ? "Conectando..." : mode === "register" ? "Criar e revisar progresso" : "Entrar e comparar progresso"}</button>
            {mode === "login" ? <button type="button" className="account-text-button" onClick={() => setMode("recovery-request")}>Esqueci minha senha</button> : null}
            <button type="button" className="account-text-button" onClick={() => setMode("intro")}>Voltar</button>
          </form>
        ) : null}

        {mode === "recovery-request" ? (
          <form className="account-auth-form" onSubmit={requestRecovery}>
            <p className="account-form-copy">Informe seu usuário. A resposta é sempre neutra para não revelar contas cadastradas.</p>
            <label><span>Usuário</span><input autoFocus value={handle} onChange={(event) => setHandle(event.target.value)} minLength={3} maxLength={32} autoComplete="username" required /></label>
            <button type="submit" className="fantasy-button primary" disabled={busy || realmStatus !== "online"}>{busy ? "Solicitando..." : "Solicitar código"}</button>
            <button type="button" className="account-text-button" onClick={() => setMode("login")}>Voltar ao login</button>
          </form>
        ) : null}

        {mode === "recovery-confirm" ? (
          <form className="account-auth-form" onSubmit={confirmRecovery}>
            <p className="account-form-copy">Digite o código recebido e defina uma nova senha. As sessões anteriores serão encerradas.</p>
            {exposedRecoveryCode ? <div className="account-dev-code"><small>Código do ambiente de teste</small><strong>{exposedRecoveryCode}</strong></div> : null}
            <label><span>Código de recuperação</span><input autoFocus value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} minLength={4} maxLength={64} inputMode="numeric" required /></label>
            <label><span>Nova senha</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required /></label>
            <button type="submit" className="fantasy-button primary" disabled={busy || realmStatus !== "online"}>{busy ? "Restaurando..." : "Redefinir e entrar"}</button>
            <button type="button" className="account-text-button" onClick={() => setMode("recovery-request")}>Solicitar outro código</button>
          </form>
        ) : null}

        {mode === "sync" && preview && copy ? (
          <div className="account-sync-review">
            <div className={`account-sync-alert relation-${preview.relation}`}><span aria-hidden="true">◇</span><div><strong>{copy.title}</strong><p>{copy.description}</p></div></div>
            <div className="account-sync-columns">
              <article><small>Este dispositivo</small><strong>{progressSummary(preview.local)}</strong><dl><div><dt>Tentativas</dt><dd>{preview.local.attempts}</dd></div><div><dt>Recompensas</dt><dd>{preview.local.rewards.length}</dd></div><div><dt>Construção</dt><dd>{preview.local.building === "farm" ? "Fazenda" : preview.local.building === "tower" ? "Torre" : "—"}</dd></div></dl></article>
              <article><small>Conta no reino</small><strong>{progressSummary(preview.remote)}</strong><dl><div><dt>Tentativas</dt><dd>{preview.remote.attempts}</dd></div><div><dt>Recompensas</dt><dd>{preview.remote.rewards.length}</dd></div><div><dt>Construção</dt><dd>{preview.remote.building === "farm" ? "Fazenda" : preview.remote.building === "tower" ? "Torre" : "—"}</dd></div></dl></article>
            </div>
            <p className="account-backup-note"><span>▣</span> Um backup local será criado antes de aplicar sua decisão.</p>
            <div className="account-sync-actions">
              <button type="button" className="fantasy-button primary" disabled={busy} onClick={() => void synchronize("merge")}>Unir progresso <small>Recomendado</small></button>
              <button type="button" className="fantasy-button" disabled={busy} onClick={() => void synchronize("remote")}>Manter a conta</button>
              <button type="button" className="fantasy-button" disabled={busy} onClick={() => void synchronize("local")}>Usar este dispositivo</button>
            </div>
          </div>
        ) : null}

        {mode === "success" ? (
          <div className="account-sync-success">
            <span className="success-rune" aria-hidden="true">✦</span>
            <p className="fantasy-eyebrow">Jornada protegida</p>
            <h2>{client.accountSession?.account.displayName ?? account?.account.displayName ?? "Arquiteto"}</h2>
            <p>{synchronized?.changed ? "O progresso foi resolvido e salvo na conta." : "O dispositivo e a conta já estavam alinhados."}</p>
            <div className="success-progress"><strong>{progressSummary(synchronized?.resolved ?? readLivingCampaignProgress())}</strong><span>{synchronized?.xpReward?.xpAwarded ? `+${synchronized.xpReward.xpAwarded} XP de migração` : "Backup e sessão preservados"}</span></div>
            <button type="button" className="fantasy-button primary" onClick={onClose}>Continuar no reino</button>
          </div>
        ) : null}

        {mode === "account" && activeAccount ? (
          <div className="account-connected-view">
            <div className="connected-profile"><span>{activeAccount.account.displayName.slice(0, 1).toUpperCase()}</span><div><small>@{activeAccount.account.handle}</small><h2>{activeAccount.account.displayName}</h2><p>Nível {activeAccount.account.level ?? 1} · {(activeAccount.account.xp ?? 0).toLocaleString("pt-BR")} XP</p></div></div>
            <div className="account-connected-stats"><article><small>Progresso local</small><strong>{progressSummary(localProgress)}</strong></article><article><small>Backups disponíveis</small><strong>{backupCount}</strong></article></div>
            <div className="account-panel-actions">
              <button type="button" className="fantasy-button primary" disabled={busy || realmStatus !== "online" || !hasLocalProgress} onClick={() => void openSyncForAccount()}>{busy ? "Comparando..." : "Revisar sincronização"}</button>
              <button type="button" className="fantasy-button" onClick={onClose}>Fechar</button>
              <button type="button" className="account-danger-button" onClick={disconnectAccount}>Sair da conta</button>
            </div>
            <p className="account-signout-note">Sair remove a sessão deste navegador, mas não apaga o progresso local nem os backups.</p>
          </div>
        ) : null}

        {notice ? <p className="account-panel-notice" role="status">{notice}</p> : null}
        <footer className="account-panel-footer">Tehkné Solutions</footer>
      </section>
    </div>
  );
}
