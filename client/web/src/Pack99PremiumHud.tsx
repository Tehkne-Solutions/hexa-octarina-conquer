import { useState } from "react";

import { Pack99UnitSprite } from "./Pack99UnitSprite";
import type { LivingUnit } from "./living-board-data";

interface Pack99PremiumHudProps {
  units: LivingUnit[];
  selectedUnitId: string | null;
  resources: { wood: number; food: number; crystal: number };
  territories: number;
  turn: number;
  commandPoints: number;
  maxCommandPoints: number;
  phase: "story" | "player" | "enemy" | "battle" | "victory" | "defeat";
  objectiveTitle: string;
  objectiveLabel: string;
  objectiveHelp: string;
  notice: string;
  onSelectUnit: (unitId: string) => void;
  onEndTurn: () => void;
}

export function Pack99PremiumHud({
  units,
  selectedUnitId,
  resources,
  territories,
  turn,
  commandPoints,
  maxCommandPoints,
  phase,
  objectiveTitle,
  objectiveLabel,
  objectiveHelp,
  notice,
  onSelectUnit,
  onEndTurn,
}: Pack99PremiumHudProps) {
  const [heroesOpen, setHeroesOpen] = useState(false);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [selectedOpen, setSelectedOpen] = useState(false);
  const playerUnits = units.filter((unit) => unit.faction === "player");
  const selected = playerUnits.find((unit) => unit.id === selectedUnitId) ?? null;
  const phaseLabel = phase === "enemy" ? "Turno inimigo" : phase === "battle" ? "Confronto" : "Seu turno";

  return (
    <div className="pack99-premium-hud">
      <div className="pack99-resource-bar" aria-label="Recursos da missão">
        <span><i className="resource-gold" />{resources.food * 120 + 1870}<small>+{resources.food * 25}</small></span>
        <span><i className="resource-wood" />{resources.wood * 660}<small>+{resources.wood * 15}</small></span>
        <span><i className="resource-octarine" />{resources.crystal * 940}<small>+{resources.crystal * 18}</small></span>
        <span><i className="resource-territory" />{territories}<small>territórios</small></span>
        <span><i className="resource-command" />{commandPoints}/{maxCommandPoints}<small>comando</small></span>
      </div>

      <button type="button" className="pack99-hero-rail-toggle" onClick={() => setHeroesOpen((value) => !value)} aria-expanded={heroesOpen} aria-label={heroesOpen ? "Recolher heróis" : "Mostrar heróis"}>
        ☰<span>Heróis</span>
      </button>
      <aside className={`pack99-hero-rail ${heroesOpen ? "is-open" : "is-collapsed"}`} aria-label="Heróis disponíveis">
        {playerUnits.map((unit) => {
          const hp = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) * 100 : 0;
          return (
            <button
              type="button"
              key={unit.id}
              className={`${selectedUnitId === unit.id ? "selected" : ""} ${!unit.active ? "locked" : ""}`}
              disabled={!unit.active || unit.defeated || phase !== "player"}
              onClick={() => onSelectUnit(unit.id)}
            >
              <Pack99UnitSprite unit={unit} selected={selectedUnitId === unit.id} compact />
              <span className="hero-rail-copy"><strong>{unit.name}</strong><small>{unit.title}</small></span>
              <span className="hero-rail-bars"><i style={{ width: `${hp}%` }} /><b style={{ width: `${Math.min(100, unit.level * 18 + 28)}%` }} /></span>
              <em>Nv.{unit.level}</em>
            </button>
          );
        })}
      </aside>

      <div className="pack99-turn-plaque">
        <small>RODADA {turn}</small>
        <strong>{phaseLabel}</strong>
      </div>

      <button type="button" className="pack99-objective-toggle" onClick={() => setObjectiveOpen((value) => !value)} aria-expanded={objectiveOpen}>
        ◈<span>Missão</span>
      </button>
      <aside className={`pack99-objective-panel ${objectiveOpen ? "is-open" : "is-collapsed"}`}>
        <button type="button" className="pack99-panel-close" onClick={() => setObjectiveOpen(false)} aria-label="Recolher missão">×</button>
        <small>{objectiveTitle}</small>
        <strong>{objectiveLabel}</strong>
        <p>{objectiveHelp}</p>
        <span>{notice}</span>
      </aside>

      {selected ? (
        <>
          <button type="button" className="pack99-selected-toggle" onClick={() => setSelectedOpen((value) => !value)} aria-expanded={selectedOpen}>
            {selected.name}
          </button>
          <div className={`pack99-selected-command ${selectedOpen ? "is-open" : "is-collapsed"}`}>
            <button type="button" className="pack99-panel-close" onClick={() => setSelectedOpen(false)} aria-label="Recolher unidade">×</button>
            <Pack99UnitSprite unit={selected} selected compact />
            <div><small>{selected.title}</small><strong>{selected.name}</strong><span>HP {selected.hp}/{selected.maxHp} · ⚔ {selected.attack} · ◆ {selected.defense} · ➤ {selected.speed}</span></div>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className={`pack99-end-turn ${commandPoints === 0 ? "urgent" : ""}`}
        disabled={phase !== "player"}
        onClick={onEndTurn}
      >
        <span>{commandPoints}/{maxCommandPoints}</span>
        <strong>{commandPoints === 0 ? "Passar para a IA" : "Encerrar turno"}</strong>
      </button>
    </div>
  );
}
