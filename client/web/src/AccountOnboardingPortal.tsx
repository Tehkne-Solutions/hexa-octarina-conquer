import { useEffect, useMemo, useState } from "react";

import { AccountOnboardingPanel } from "./AccountOnboardingPanel";
import {
  ACCOUNT_SESSION_EVENT,
  ONBOARDING_DISMISSED_KEY,
  OPEN_ACCOUNT_ONBOARDING_EVENT,
  requestAccountOnboarding,
  shouldOfferAccountOnboarding,
} from "./account-sync";
import { HexaClient } from "./hexa-client";
import type { AccountSession } from "./protocol";
import {
  readLivingCampaignProgress,
  subscribeLivingCampaignProgress,
  type LivingCampaignProgress,
} from "./unified-progress";

function shellState(): { battleActive: boolean; contextVisible: boolean; realmStatus: "loading" | "online" | "offline" } {
  const shell = document.querySelector<HTMLElement>(".unified-game-shell");
  if (!shell) return { battleActive: false, contextVisible: true, realmStatus: navigator.onLine ? "online" : "offline" };
  const realm = shell.dataset.realmStatus;
  return {
    battleActive: shell.classList.contains("battle-active"),
    contextVisible: shell.classList.contains("screen-home") || shell.classList.contains("screen-profile"),
    realmStatus: realm === "online" || realm === "offline" ? realm : "loading",
  };
}

export function AccountOnboardingPortal() {
  const query = useMemo(() => new URL(window.location.href).searchParams, []);
  const qaOpen = query.get("qa") === "1" && query.get("screen") === "ui11-account";
  const [open, setOpen] = useState(qaOpen);
  const [account, setAccount] = useState<AccountSession | null>(() => new HexaClient().accountSession);
  const [progress, setProgress] = useState<LivingCampaignProgress>(readLivingCampaignProgress);
  const [shell, setShell] = useState(shellState);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true");

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onAccount = (event: Event) => {
      setAccount((event as CustomEvent<AccountSession | null>).detail);
      window.dispatchEvent(new Event("focus"));
    };
    const onStorage = () => {
      setAccount(new HexaClient().accountSession);
      setDismissed(localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true");
    };
    window.addEventListener(OPEN_ACCOUNT_ONBOARDING_EVENT, onOpen);
    window.addEventListener(ACCOUNT_SESSION_EVENT, onAccount);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(OPEN_ACCOUNT_ONBOARDING_EVENT, onOpen);
      window.removeEventListener(ACCOUNT_SESSION_EVENT, onAccount);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => subscribeLivingCampaignProgress(setProgress), []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setShell(shellState()));
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const showPrompt = !open
    && !dismissed
    && !shell.battleActive
    && shell.contextVisible
    && shouldOfferAccountOnboarding(account, progress);

  const dismissPrompt = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const refreshShellData = () => {
    setProgress(readLivingCampaignProgress());
    setAccount(new HexaClient().accountSession);
    window.dispatchEvent(new Event("focus"));
  };

  return (
    <>
      {showPrompt ? (
        <aside className="account-sync-prompt" aria-label="Proteger progresso local">
          <span className="account-sync-prompt-icon" aria-hidden="true">✦</span>
          <div><small>Jornada salva neste dispositivo</small><strong>Proteja seu progresso</strong><p>Crie ou conecte uma conta sem interromper a campanha.</p></div>
          <button type="button" className="account-sync-prompt-primary" onClick={requestAccountOnboarding}>Sincronizar</button>
          <button type="button" className="account-sync-prompt-close" onClick={dismissPrompt} aria-label="Dispensar convite">×</button>
        </aside>
      ) : null}
      <AccountOnboardingPanel
        open={open}
        account={account}
        realmStatus={shell.realmStatus}
        onClose={() => setOpen(false)}
        onAccountChanged={(next) => {
          setAccount(next);
          refreshShellData();
        }}
        onSynchronized={refreshShellData}
      />
    </>
  );
}
