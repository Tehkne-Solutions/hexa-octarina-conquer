import { type CSSProperties, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { pack99PublicUrl, resolvePack99Asset } from "./pack99-runtime";

type WorldVfxType = "move" | "attack" | "impact" | "collect" | "capture" | "build" | "victory" | "defeat";

interface WorldVfxEvent {
  token: number;
  type: WorldVfxType;
  label: string;
}

const VFX_QUERY: Record<WorldVfxType, { required: string[]; preferred: string[] }> = {
  move: { required: ["vfx"], preferred: ["move", "trail", "rune", "base", "01"] },
  attack: { required: ["vfx"], preferred: ["attack", "slash", "projectile", "base", "01"] },
  impact: { required: ["vfx"], preferred: ["impact", "hit", "burst", "base", "01"] },
  collect: { required: ["vfx"], preferred: ["collect", "resource", "spark", "base", "01"] },
  capture: { required: ["vfx"], preferred: ["capture", "territory", "rune", "base", "01"] },
  build: { required: ["vfx"], preferred: ["build", "construction", "summon", "base", "01"] },
  victory: { required: ["vfx"], preferred: ["victory", "celebration", "octarine", "base", "01"] },
  defeat: { required: ["vfx"], preferred: ["defeat", "corruption", "smoke", "base", "01"] },
};

function classifyEvent(text: string, root: HTMLElement): WorldVfxType | null {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (root.querySelector(".outcome-screen.victory")) return "victory";
  if (root.querySelector(".outcome-screen.defeat")) return "defeat";
  if (/construiu|fazenda arcana|torre runica|construcao/.test(normalized)) return "build";
  if (/territorio|reivindic|captur|moinho ocupado/.test(normalized)) return "capture";
  if (/colet|recurso|cristal|madeira|alimento/.test(normalized)) return "collect";
  if (/dano|golpe|impact|atingiu|derrotou/.test(normalized)) return "impact";
  if (/combate|confronto|ataque|disparo|flecha/.test(normalized)) return "attack";
  if (/moveu|avancou|atravessou|trilha|liberdade/.test(normalized)) return "move";
  return null;
}

export function Pack99WorldVfx({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [event, setEvent] = useState<WorldVfxEvent | null>(null);
  const [assets, setAssets] = useState<Partial<Record<WorldVfxType, string | null>>>({});
  const lastSignatureRef = useRef("");
  const tokenRef = useRef(0);

  useEffect(() => {
    let active = true;
    void Promise.all((Object.keys(VFX_QUERY) as WorldVfxType[]).map(async (type) => {
      const query = VFX_QUERY[type];
      const asset = await resolvePack99Asset(query.required, query.preferred);
      return [type, pack99PublicUrl(asset)] as const;
    })).then((entries) => {
      if (active) setAssets(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;
    let clearTimer = 0;

    const synchronize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const world = root.querySelector<HTMLElement>(".go-dots-world");
        setTarget((current) => current === world ? current : world);
        const latest = root.querySelector<HTMLElement>(".event-timeline p")?.textContent?.trim()
          ?? root.querySelector<HTMLElement>(".living-notice p")?.textContent?.trim()
          ?? "";
        const outcome = root.querySelector<HTMLElement>(".outcome-screen")?.className ?? "";
        const signature = `${latest}|${outcome}`;
        if (!latest || signature === lastSignatureRef.current) return;
        const type = classifyEvent(latest, root);
        if (!type) return;
        lastSignatureRef.current = signature;
        tokenRef.current += 1;
        setEvent({ token: tokenRef.current, type, label: latest });
        window.clearTimeout(clearTimer);
        clearTimer = window.setTimeout(() => setEvent(null), type === "victory" || type === "defeat" ? 2400 : 1100);
      });
    };

    const observer = new MutationObserver(synchronize);
    observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true });
    synchronize();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clearTimer);
    };
  }, [rootRef]);

  const source = useMemo(() => event ? assets[event.type] ?? null : null, [assets, event]);
  if (!target || !event) return null;

  return createPortal(
    <div key={event.token} className={`pack99-world-vfx vfx-${event.type}`} aria-hidden="true" data-vfx-event={event.type}>
      <span className="pack99-vfx-glow" />
      <span className="pack99-vfx-ring" />
      <span className="pack99-vfx-particles">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--particle": index } as CSSProperties} />)}</span>
      {source ? <img className="pack99-vfx-asset" src={source} alt="" draggable={false} /> : null}
      <b>{event.type === "collect" ? "+ RECURSO" : event.type === "capture" ? "TERRITÓRIO" : event.type === "build" ? "CONSTRUÇÃO" : event.type === "victory" ? "VITÓRIA" : event.type === "defeat" ? "DERROTA" : ""}</b>
    </div>,
    target,
  );
}
