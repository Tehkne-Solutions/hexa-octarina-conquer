import { type CSSProperties, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  loadPack99RuntimeState,
  pack99PublicUrl,
  resolvePack99MissionAsset,
  type Pack99MissionAssetReference,
} from "./pack99-runtime";

type WorldVfxType = "move" | "attack" | "impact" | "collect" | "capture" | "build" | "victory" | "defeat";

interface WorldVfxEvent {
  token: number;
  type: WorldVfxType;
  label: string;
}

const VFX_REFERENCE: Record<WorldVfxType, Pack99MissionAssetReference> = {
  move: {
    canonicalId: "VFX_MAP_PATH_01",
    sourceSuffixes: ["VFX_MAP_PATH_01.png"],
    required: ["vfx", "map", "path"],
    preferred: ["01"],
  },
  attack: {
    canonicalId: "VFX_COMBAT_SLASH_01",
    sourceSuffixes: ["VFX_COMBAT_SLASH_01.png"],
    required: ["vfx", "combat", "slash"],
    preferred: ["01"],
  },
  impact: {
    canonicalId: "VFX_COMBAT_HEAVY_STRIKE_01",
    sourceSuffixes: ["VFX_COMBAT_HEAVY_STRIKE_01.png"],
    required: ["vfx", "combat", "heavy", "strike"],
    preferred: ["01"],
  },
  collect: {
    canonicalId: "VFX_RESOURCE_COLLECT_01",
    sourceSuffixes: ["VFX_RESOURCE_COLLECT_01.png"],
    required: ["vfx", "resource", "collect"],
    preferred: ["01"],
  },
  capture: {
    canonicalId: "VFX_TERRITORY_CONQUEST_01",
    sourceSuffixes: ["VFX_TERRITORY_CONQUEST_01.png"],
    required: ["vfx", "territory", "conquest"],
    preferred: ["01"],
  },
  build: {
    canonicalId: "VFX_CONSTRUCTION_01",
    sourceSuffixes: ["VFX_CONSTRUCTION_01.png"],
    required: ["vfx", "construction"],
    preferred: ["01"],
  },
  victory: {
    canonicalId: "VFX_COMBAT_VICTORY_01",
    sourceSuffixes: ["VFX_COMBAT_VICTORY_01.png"],
    required: ["vfx", "combat", "victory"],
    preferred: ["01"],
  },
  defeat: {
    canonicalId: "VFX_COMBAT_DEATH_01",
    sourceSuffixes: ["VFX_COMBAT_DEATH_01.png"],
    required: ["vfx", "combat", "death"],
    preferred: ["01"],
  },
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
  const [strictFullRuntime, setStrictFullRuntime] = useState(
    () => document.documentElement.dataset.pack99Full === "true",
  );
  const lastSignatureRef = useRef("");
  const tokenRef = useRef(0);

  useEffect(() => {
    let active = true;
    void loadPack99RuntimeState()
      .then((state) => {
        if (active) setStrictFullRuntime(state.isFullRuntime);
      })
      .catch(() => {
        if (active) setStrictFullRuntime(false);
      });
    void Promise.all((Object.keys(VFX_REFERENCE) as WorldVfxType[]).map(async (type) => {
      const asset = await resolvePack99MissionAsset(VFX_REFERENCE[type]);
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
  if (!source && strictFullRuntime) return null;

  return createPortal(
    <div
      key={event.token}
      className={`pack99-world-vfx vfx-${event.type}`}
      aria-hidden="true"
      data-vfx-event={event.type}
      data-pack99-canonical-id={VFX_REFERENCE[event.type].canonicalId}
    >
      <span className="pack99-vfx-glow" />
      <span className="pack99-vfx-ring" />
      <span className="pack99-vfx-particles">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--particle": index } as CSSProperties} />)}</span>
      {source ? <img className="pack99-vfx-asset" src={source} alt="" draggable={false} /> : null}
      <b>{event.type === "collect" ? "+ RECURSO" : event.type === "capture" ? "TERRITÓRIO" : event.type === "build" ? "CONSTRUÇÃO" : event.type === "victory" ? "VITÓRIA" : event.type === "defeat" ? "DERROTA" : ""}</b>
    </div>,
    target,
  );
}
