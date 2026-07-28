import { type RefObject, useEffect, useState } from "react";

type DockPanel = "map" | "events" | null;

function clickWithin(root: HTMLElement, selector: string): void {
  root.querySelector<HTMLButtonElement>(selector)?.click();
}

export function Pack99RightCommandDock({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const [panel, setPanel] = useState<DockPanel>(null);
  const [unread, setUnread] = useState(0);
  const [zoom, setZoom] = useState("100%");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const count = root.querySelector<HTMLElement>(".pack99-notification-toggle b")?.textContent ?? "0";
        setUnread(Number.parseInt(count, 10) || 0);
        setZoom(root.querySelector<HTMLElement>(".pack99-rts-camera-controls .camera-label")?.textContent?.trim() ?? "100%");
        root.classList.toggle("right-dock-map-open", panel === "map");
      });
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true });
    sync();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); root.classList.remove("right-dock-map-open"); };
  }, [panel, rootRef]);

  const toggleMap = () => setPanel((current) => current === "map" ? null : "map");
  const toggleEvents = () => {
    const root = rootRef.current;
    if (!root) return;
    clickWithin(root, ".pack99-notification-toggle");
    setPanel((current) => current === "events" ? null : "events");
  };

  return (
    <nav className="pack99-right-command-dock" aria-label="Comandos de campanha">
      <button type="button" className={panel === "map" ? "active" : ""} onClick={toggleMap} aria-pressed={panel === "map"} title="Mostrar minimapa"><span aria-hidden="true">⌖</span><small>Mapa</small></button>
      <button type="button" className={panel === "events" ? "active" : ""} onClick={toggleEvents} aria-pressed={panel === "events"} title="Abrir eventos"><span aria-hidden="true">☰</span><small>Eventos</small>{unread > 0 ? <b>{Math.min(unread, 99)}</b> : null}</button>
      <span className="dock-divider" />
      <button type="button" onClick={() => rootRef.current && clickWithin(rootRef.current, ".pack99-rts-camera-controls button[aria-label='Diminuir zoom']")} title="Diminuir zoom"><span aria-hidden="true">−</span><small>Zoom</small></button>
      <button type="button" className="dock-zoom-value" onClick={() => rootRef.current && clickWithin(rootRef.current, ".pack99-rts-camera-controls .camera-label")} title="Restaurar visão geral"><span>{zoom}</span><small>Visão</small></button>
      <button type="button" onClick={() => rootRef.current && clickWithin(rootRef.current, ".pack99-rts-camera-controls button[aria-label='Aumentar zoom']")} title="Aumentar zoom"><span aria-hidden="true">+</span><small>Zoom</small></button>
      <button type="button" onClick={() => rootRef.current && clickWithin(rootRef.current, ".pack99-rts-camera-controls button[title*='Focar unidade']")} title="Focar unidade"><span aria-hidden="true">♙</span><small>Herói</small></button>
      <button type="button" onClick={() => rootRef.current && clickWithin(rootRef.current, ".pack99-rts-camera-controls button:last-child")} title="Focar objetivo"><span aria-hidden="true">⚑</span><small>Missão</small></button>
      <span className="dock-divider" />
      <button type="button" onClick={() => rootRef.current && clickWithin(rootRef.current, ".battle-help-button")} title="Ajuda"><span aria-hidden="true">?</span><small>Ajuda</small></button>
    </nav>
  );
}
