import { useEffect } from "react";

import "./vertical-slice-11-status-tray.css";
import "./vertical-slice-10-status-layout.css";
import { Pack99HomeHeroArt } from "./Pack99HomeHeroArt";
import { Pack99InterfaceCleanup } from "./Pack99InterfaceCleanup";
import { Pack99PlayerSurfaceCleanup } from "./Pack99PlayerSurfaceCleanup";
import { installIntentPrefetch, prefetchGameScreen } from "./screen-prefetch";
import { installViewportProfile } from "./viewport-profile";

const QA_SCREENS = new Set(["home", "campaign", "collection", "profile", "settings"]);

function buttonWithText(label: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find((button) => button.textContent?.trim() === label) ?? null;
}

function openQaScreen(screen: string): boolean {
  if (screen === "home") return true;
  if (screen === "profile") {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Abrir perfil"]');
    if (!button) return false;
    button.click();
    return true;
  }
  if (screen === "settings") {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Abrir configurações"]');
    if (!button) return false;
    button.click();
    return true;
  }

  const label = screen === "campaign" ? "Campanha" : "Coleção";
  const button = buttonWithText(label);
  if (!button) return false;
  button.click();
  return true;
}

export function RuntimeEnhancements() {
  useEffect(() => {
    const removeViewportProfile = installViewportProfile();
    const removeIntentPrefetch = installIntentPrefetch();
    const idlePrefetch = window.setTimeout(() => void prefetchGameScreen("campaign"), 900);
    const params = new URL(window.location.href).searchParams;
    const qaEnabled = params.get("qa") === "1";
    let qaTimer = 0;

    if (qaEnabled) {
      const requestedScreen = params.get("screen") ?? "home";
      const qaScreen = QA_SCREENS.has(requestedScreen) ? requestedScreen : "home";
      document.documentElement.dataset.visualQa = "true";
      document.documentElement.dataset.qaScreen = qaScreen;
      if (params.get("stable") === "1") document.documentElement.dataset.qaStable = "true";

      let routeOpened = qaScreen === "home";
      let briefingOpened = params.get("briefing") !== "1";
      let attempts = 0;
      qaTimer = window.setInterval(() => {
        attempts += 1;
        if (!routeOpened) routeOpened = openQaScreen(qaScreen);
        if (routeOpened && !briefingOpened) {
          const briefing = buttonWithText("Abrir briefing");
          if (briefing) {
            briefing.click();
            briefingOpened = true;
          }
        }
        if ((routeOpened && briefingOpened) || attempts >= 40) window.clearInterval(qaTimer);
      }, 150);
    }

    if (typeof performance !== "undefined" && typeof performance.mark === "function") {
      performance.mark("hexa-runtime-enhancements-ready");
    }

    return () => {
      window.clearTimeout(idlePrefetch);
      window.clearInterval(qaTimer);
      removeIntentPrefetch();
      removeViewportProfile();
    };
  }, []);

  return <><Pack99HomeHeroArt /><Pack99InterfaceCleanup /><Pack99PlayerSurfaceCleanup /></>;
}
