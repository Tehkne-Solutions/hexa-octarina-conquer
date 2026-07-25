import { useEffect } from "react";

import {
  applyBoardTheme,
  boardThemeForMission,
  boardThemeFromSelectedMission,
  boardThemeFromUrl,
  type BoardThemeId,
} from "./board-theme";

function authoritativeTheme(node: HTMLElement, override: BoardThemeId | null): BoardThemeId {
  if (override) return override;
  const campaignRoot = node.closest<HTMLElement>("[data-campaign-mission], .campaign-client, .authoritative-client");
  const missionId = campaignRoot?.dataset.campaignMission
    ?? window.sessionStorage.getItem("hexa.campaign.selected-mission");
  const chapterId = campaignRoot?.dataset.campaignChapter ?? null;
  const spectator = Boolean(node.closest(".spectator-replay-screen"));
  return boardThemeForMission(missionId, chapterId, spectator ? "multiplayer" : "campaign");
}

function synchronizeThemes(): void {
  const override = boardThemeFromUrl(new URL(window.location.href));
  const livingTheme = override ?? boardThemeFromSelectedMission(window.sessionStorage);

  document.querySelectorAll<HTMLElement>(".go-dots-board-shell").forEach((node) => {
    applyBoardTheme(node, livingTheme === "ash-fortress" || livingTheme === "prismatic-ruins" ? livingTheme : "orun-mill");
  });

  document.querySelectorAll<HTMLElement>(".board-shell").forEach((node) => {
    applyBoardTheme(node, authoritativeTheme(node, override));
  });
}

export function BoardThemeRuntime() {
  useEffect(() => {
    let frame = 0;
    const requestSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(synchronizeThemes);
    };

    const observer = new MutationObserver(requestSync);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    window.addEventListener("popstate", requestSync);
    window.addEventListener("hashchange", requestSync);
    window.addEventListener("storage", requestSync);
    window.addEventListener("focus", requestSync);
    requestSync();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", requestSync);
      window.removeEventListener("hashchange", requestSync);
      window.removeEventListener("storage", requestSync);
      window.removeEventListener("focus", requestSync);
    };
  }, []);

  return null;
}
