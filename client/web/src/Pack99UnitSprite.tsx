import { useEffect, useMemo, useState } from "react";

import { FantasyUnitSprite } from "./FantasyUnitSprite";
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

export function Pack99UnitSprite({ unit, selected = false, compact = false }: Pack99UnitSpriteProps) {
  const reference = useMemo(() => ASH_BRIDGE_UNITS[unit.id] ?? ASH_BRIDGE_UNITS["raider-bridge"], [unit.id]);
  const [layers, setLayers] = useState<UnitLayers>({ base: null, shadow: null, emissive: null });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    void resolvePack99MissionAsset(reference)
      .then(async (baseAsset) => {
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
        setFailed(!next.base);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => { active = false; };
  }, [reference]);

  if (failed || !layers.base) {
    return <FantasyUnitSprite unit={unit} selected={selected} compact={compact} />;
  }

  const hpPercent = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) * 100 : 0;
  const visualState = unit.defeated || unit.hp <= 0 ? "defeated" : !unit.active ? "captive" : hpPercent <= 45 ? "wounded" : selected ? "selected" : "neutral";

  return (
    <div
      className={`pack99-unit-sprite faction-${unit.faction} role-${unit.role} state-${visualState} ${compact ? "compact" : ""}`}
      data-pack99-unit={unit.id}
      data-pack99-asset={reference.id}
    >
      <span className="pack99-unit-ring" aria-hidden="true" />
      <span className="pack99-unit-aura" aria-hidden="true" />
      <span className="pack99-unit-stack" role="img" aria-label={`${unit.name}, ${unit.title}`}>
        {layers.shadow ? <img className="pack99-unit-layer pack99-unit-shadow" src={layers.shadow} alt="" aria-hidden="true" /> : null}
        <img className="pack99-unit-layer pack99-unit-base" src={layers.base} alt="" onError={() => setFailed(true)} />
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
