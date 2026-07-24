import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const SpectatorReplayScreen = lazy(() => import("./SpectatorReplayScreen").then((module) => ({ default: module.SpectatorReplayScreen })));

interface PortalTargets {
  desktopNav: HTMLElement | null;
  mobileNav: HTMLElement | null;
  homeGrid: HTMLElement | null;
}

function findTargets(): PortalTargets {
  return {
    desktopNav: document.querySelector<HTMLElement>(".unified-header nav"),
    mobileNav: document.querySelector<HTMLElement>(".mobile-bottom-nav"),
    homeGrid: document.querySelector<HTMLElement>(".home-menu-grid"),
  };
}

function sameTargets(left: PortalTargets, right: PortalTargets): boolean {
  return left.desktopNav === right.desktopNav && left.mobileNav === right.mobileNav && left.homeGrid === right.homeGrid;
}

function SpectatorLoader() {
  return <div className="spectator-screen-loader" role="status"><span>✦</span><strong>Abrindo o Observatório...</strong><small>Preparando partidas públicas e replays.</small></div>;
}

export function SpectatorReplayPortal() {
  const qaRequested = useMemo(() => {
    const params = new URL(window.location.href).searchParams;
    return params.get("qa") === "1" && params.get("screen") === "spectator";
  }, []);
  const [open, setOpen] = useState(() => window.location.hash === "#spectator" || qaRequested);
  const [targets, setTargets] = useState<PortalTargets>(findTargets);

  useEffect(() => {
    const refresh = () => setTargets((current) => {
      const next = findTargets();
      return sameTargets(current, next) ? current : next;
    });
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    refresh();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onHashChange = () => setOpen(window.location.hash === "#spectator");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("spectator-overlay-open", open);
    return () => document.documentElement.classList.remove("spectator-overlay-open");
  }, [open]);

  const openSpectator = () => {
    setOpen(true);
    if (window.location.hash !== "#spectator") window.history.pushState({ spectator: true }, "", `${window.location.pathname}${window.location.search}#spectator`);
  };

  const closeSpectator = () => {
    setOpen(false);
    if (window.location.hash === "#spectator") window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  };

  return (
    <>
      {targets.desktopNav ? createPortal(
        <button type="button" className="spectator-nav-entry" aria-current={open ? "page" : undefined} onClick={openSpectator}>Assistir</button>,
        targets.desktopNav,
      ) : null}
      {targets.mobileNav ? createPortal(
        <button type="button" className="spectator-mobile-entry" aria-current={open ? "page" : undefined} onClick={openSpectator}><span>◉</span>Assistir</button>,
        targets.mobileNav,
      ) : null}
      {targets.homeGrid ? createPortal(
        <button type="button" className="home-mode-card mode-spectator" onClick={openSpectator}>
          <span className="mode-card-icon" aria-hidden="true">◉</span>
          <span className="mode-card-copy"><small>Observatório público</small><strong>Espectador e Replay</strong><p>Assista partidas ao vivo e reveja cada decisão sem expor dados privados.</p></span>
          <span className="mode-card-arrow" aria-hidden="true">→</span>
        </button>,
        targets.homeGrid,
      ) : null}
      {open ? createPortal(
        <div className="spectator-overlay-root"><Suspense fallback={<SpectatorLoader />}><SpectatorReplayScreen onClose={closeSpectator} /></Suspense></div>,
        document.body,
      ) : null}
    </>
  );
}
