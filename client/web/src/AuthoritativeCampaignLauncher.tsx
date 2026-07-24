import { useEffect, useRef } from "react";

import { App as AuthoritativeCampaignApp } from "./App";

interface AuthoritativeCampaignLauncherProps {
  missionId: string;
  onBack: () => void;
}

export function AuthoritativeCampaignLauncher({ missionId, onBack }: AuthoritativeCampaignLauncherProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.sessionStorage.setItem("hexa.campaign.selected-mission", missionId);
    const root = rootRef.current;
    if (!root) return undefined;

    let lastClick = 0;
    const enterCampaign = () => {
      if (root.querySelector(".campaign-screen") || root.querySelector(".game-screen")) return;
      const campaignButton = root.querySelector<HTMLButtonElement>(".lobby-screen .campaign-button");
      if (!campaignButton || Date.now() - lastClick < 800) return;
      lastClick = Date.now();
      campaignButton.click();
    };

    const observer = new MutationObserver(enterCampaign);
    observer.observe(root, { childList: true, subtree: true });
    enterCampaign();
    return () => observer.disconnect();
  }, [missionId]);

  return (
    <section className="authoritative-campaign-launcher" ref={rootRef}>
      <button type="button" className="campaign-floating-back" onClick={onBack}>← Mapa unificado</button>
      <AuthoritativeCampaignApp />
    </section>
  );
}
