import { useEffect, useMemo, useState } from "react";

import { FantasyUnitSprite } from "./FantasyUnitSprite";
import type { LivingUnit } from "./living-board-data";
import { resolvePack99Layer } from "./pack99-runtime";

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

function unitSearch(unit: LivingUnit): { required: string[]; preferred: string[] } {
  if (unit.id === "kael") return { required: ["hero", "warrior"], preferred: ["idle", "se", "base"] };
  if (unit.id === "lyra") return { required: ["hero", "ranger"], preferred: ["idle", "ne", "base"] };
  if (unit.id === "raider-mill") return { required: ["unit", "skeleton"], preferred: ["idle", "nw", "base", "elite"] };
  return { required: ["unit", "skeleton"], preferred: ["idle", "nw", "base"] };
}

export function Pack99UnitSprite({ unit, selected = false, compact = false }: Pack99UnitSpriteProps) {
  const search = useMemo(() => unitSearch(unit), [unit.id]);
  const [layers, setLayers] = useState<UnitLayers>({ base: null, shadow: null, emissive: null });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    Promise.all([
      resolvePack99Layer(search.required, "base", search.preferred),
      resolvePack99Layer(search.required, "shadow", search.preferred),
      resolvePack99Layer(search.required, "emissive", search.preferred),
    ]).then(([base, shadow, emissive]) => {
      if (!active) return;
      setLayers({ base, shadow, emissive });
      setFailed(!base);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [search]);

  if (failed || !layers.base) {
    return <FantasyUnitSprite unit={unit} selected={selected} compact={compact} />;
  }

  const hpPercent = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) * 100 : 0;
  const visualState = unit.defeated || unit.hp <= 0 ? "defeated" : !unit.active ? "captive" : hpPercent <= 45 ? "wounded" : selected ? "selected" : "neutral";

  return (
    <div
      className={`pack99-unit-sprite faction-${unit.faction} role-${unit.role} state-${visualState} ${compact ? "compact" : ""}`}
      data-pack99-unit={unit.id}
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
