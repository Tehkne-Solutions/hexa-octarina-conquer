import { useEffect, useMemo, useRef, useState } from "react";

import { ASH_BRIDGE_UNITS } from "./pack99-ash-bridge-manifest";
import type { LivingUnit } from "./living-board-data";
import {
  pack99PublicUrl,
  resolvePack99MissionAsset,
  resolvePack99SiblingLayer,
} from "./pack99-runtime";

interface Pack99UnitSpriteProps {
  unit: LivingUnit;
  selected?: boolean;
  compact?: boolean;
}

interface UnitLayers {
  base: string | null;
  shadow: string | null;
  emissive: string | null;
}

type AssetState = "loading" | "ready" | "missing";
type TransientState = "entering" | "hit" | "healed" | null;

export function Pack99UnitSprite({ unit, selected = false, compact = false }: Pack99UnitSpriteProps) {
  const reference = useMemo(() => ASH_BRIDGE_UNITS[unit.id] ?? ASH_BRIDGE_UNITS["raider-bridge"], [unit.id]);
  const [layers, setLayers] = useState<UnitLayers>({ base: null, shadow: null, emissive: null });
  const [assetState, setAssetState] = useState<AssetState>("loading");
  const [transientState, setTransientState] = useState<TransientState>("entering");
  const previousHp = useRef(unit.hp);
  const clearTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setAssetState("loading");
    setLayers({ base: null, shadow: null, emissive: null });

    void resolvePack99MissionAsset(reference)
      .then(async (baseAsset) => {
        if (!baseAsset) {
          if (active) setAssetState("missing");
          return;
        }
        const [shadowAsset, emissiveAsset] = await Promise.all([
          resolvePack99SiblingLayer(baseAsset, "shadow"),
          resolvePack99SiblingLayer(baseAsset, "emissive"),
        ]);
        if (!active) return;
        const next = {
          base: pack99PublicUrl(baseAsset),
          shadow: pack99PublicUrl(shadowAsset),
          emissive: pack99PublicUrl(emissiveAsset),
        };
        setLayers(next);
        setAssetState(next.base ? "ready" : "missing");
      })
      .catch(() => {
        if (active) setAssetState("missing");
      });

    return () => { active = false; };
  }, [reference]);

  useEffect(() => {
    const oldHp = previousHp.current;
    previousHp.current = unit.hp;
    if (unit.hp === oldHp) return;
    setTransientState(unit.hp < oldHp ? "hit" : "healed");
    if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => setTransientState(null), 620);
  }, [unit.hp]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTransientState((state) => state === "entering" ? null : state), 520);
    return () => {
      window.clearTimeout(timer);
      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
    };
  }, []);

  const hpPercent = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) * 100 : 0;
  const visualState = unit.defeated || unit.hp <= 0 ? "defeated" : !unit.active ? "captive" : hpPercent <= 45 ? "wounded" : selected ? "selected" : "neutral";

  if (assetState !== "ready" || !layers.base) {
    return (
      <div
        className={`pack99-unit-sprite pack99-unit-asset-state asset-${assetState} faction-${unit.faction} role-${unit.role} state-${visualState} ${compact ? "compact" : ""}`}
        data-pack99-unit={unit.id}
        data-pack99-asset={reference.id}
        data-pack99-canonical-id={reference.canonicalId}
        data-pack99-asset-state={assetState}
        data-pack99-asset-error={assetState === "missing" ? "canonical-payload-missing" : undefined}
        aria-label={`${unit.name}: asset ${assetState === "loading" ? "carregando" : "ausente"}`}
      >
        <span className="pack99-unit-loading-sigil" aria-hidden="true">{assetState === "loading" ? "◌" : "!"}</span>
        <span className="pack99-unit-loading-name">{unit.name}</span>
        <span className="fantasy-unit-level">Nv.{unit.level}</span>
        <span className="fantasy-unit-health"><i style={{ width: `${hpPercent}%` }} /></span>
      </div>
    );
  }

  return (
    <div
      className={`pack99-unit-sprite faction-${unit.faction} role-${unit.role} state-${visualState} ${transientState ? `motion-${transientState}` : ""} ${compact ? "compact" : ""}`}
      data-pack99-unit={unit.id}
      data-pack99-asset={reference.id}
      data-pack99-canonical-id={reference.canonicalId}
      data-pack99-asset-state="ready"
      data-unit-state={visualState}
    >
      <span className="pack99-unit-ring" aria-hidden="true" />
      <span className="pack99-unit-aura" aria-hidden="true" />
      <span className="pack99-unit-impact" aria-hidden="true" />
      <span className="pack99-unit-stack" role="img" aria-label={`${unit.name}, ${unit.title}`}>
        {layers.shadow ? <img className="pack99-unit-layer pack99-unit-shadow" src={layers.shadow} alt="" aria-hidden="true" /> : null}
        <img className="pack99-unit-layer pack99-unit-base" src={layers.base} alt="" onError={() => setAssetState("missing")} />
        {layers.emissive ? <img className="pack99-unit-layer pack99-unit-emissive" src={layers.emissive} alt="" aria-hidden="true" /> : null}
      </span>
      <span className="fantasy-unit-level">Nv.{unit.level}</span>
      <span className="fantasy-unit-health"><i style={{ width: `${hpPercent}%` }} /></span>
      {visualState === "wounded" ? <span className="fantasy-unit-status">FERIDO</span> : null}
      {visualState === "defeated" ? <span className="fantasy-unit-status">DERROTADO</span> : null}
      {visualState === "captive" ? <span className="fantasy-unit-lock">SELADA</span> : null}
    </div>
  );
}
