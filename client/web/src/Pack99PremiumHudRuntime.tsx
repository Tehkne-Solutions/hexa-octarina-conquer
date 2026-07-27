import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Pack99PremiumHud } from "./Pack99PremiumHud";
import type { LivingUnit } from "./living-board-data";

interface HudSnapshot {
  target: HTMLElement | null;
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
}

const EMPTY: HudSnapshot = {
  target: null,
  units: [],
  selectedUnitId: null,
  resources: { wood: 0, food: 0, crystal: 0 },
  territories: 0,
  turn: 1,
  commandPoints: 0,
  maxCommandPoints: 0,
  phase: "story",
  objectiveTitle: "",
  objectiveLabel: "",
  objectiveHelp: "",
  notice: "",
};

function numberFrom(text: string | null | undefined): number {
  const match = text?.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function unitFromButton(button: HTMLButtonElement, index: number): LivingUnit {
  const sprite = button.querySelector<HTMLElement>("[data-pack99-unit], .fantasy-unit-sprite");
  const id = sprite?.dataset.pack99Unit ?? (index === 0 ? "kael" : "lyra");
  const copy = button.querySelector("div");
  const name = copy?.querySelector("strong")?.textContent?.trim() ?? (index === 0 ? "Kael" : "Lyra");
  const title = copy?.querySelector("small")?.textContent?.trim() ?? "Herói de Orun";
  const hpText = copy?.querySelector("span")?.textContent ?? "0/1";
  const hpNumbers = hpText.match(/\d+/g)?.map(Number) ?? [0, 1];
  return {
    id,
    name,
    title,
    role: index === 0 ? "guardian" : "archer",
    faction: "player",
    x: 0,
    y: 0,
    hp: hpNumbers[0] ?? 0,
    maxHp: hpNumbers[1] ?? 1,
    attack: 4,
    defense: 3,
    speed: index === 0 ? 2 : 5,
    element: index === 0 ? "Terra" : "Ar",
    level: numberFrom(button.querySelector(".fantasy-unit-level")?.textContent) || 1,
    deck: [],
    active: !button.classList.contains("locked"),
    defeated: button.disabled && !button.classList.contains("locked"),
  };
}

function readSnapshot(): HudSnapshot {
  const target = document.querySelector<HTMLElement>(".living-demo.go-dots-demo");
  if (!target) return EMPTY;
  const rosterButtons = [...target.querySelectorAll<HTMLButtonElement>(".unit-roster > button")];
  const resourceValues = [...target.querySelectorAll<HTMLElement>(".resource-strip > span")].map((node) => numberFrom(node.textContent));
  const phaseText = target.querySelector(".phase-banner strong")?.textContent?.toLowerCase() ?? "";
  const phase = target.querySelector(".living-battle-overlay") ? "battle"
    : target.querySelector(".ai-turn-curtain") ? "enemy"
      : phaseText.includes("inim") ? "enemy" : "player";
  const stars = [...target.querySelectorAll<HTMLElement>(".command-points i")];
  const selectedButton = rosterButtons.find((button) => button.classList.contains("selected"));

  return {
    target,
    units: rosterButtons.map(unitFromButton),
    selectedUnitId: selectedButton?.querySelector<HTMLElement>("[data-pack99-unit]")?.dataset.pack99Unit
      ?? (selectedButton ? (rosterButtons.indexOf(selectedButton) === 0 ? "kael" : "lyra") : null),
    resources: { wood: resourceValues[0] ?? 0, crystal: resourceValues[1] ?? 0, food: resourceValues[2] ?? 0 },
    territories: resourceValues[3] ?? 0,
    turn: numberFrom(target.querySelector(".phase-banner small")?.textContent) || 1,
    commandPoints: stars.filter((node) => node.classList.contains("active")).length,
    maxCommandPoints: stars.length,
    phase,
    objectiveTitle: target.querySelector(".current-objective-card small")?.textContent?.trim() ?? "Objetivo atual",
    objectiveLabel: target.querySelector(".current-objective-card strong")?.textContent?.trim() ?? "Avance pela rede",
    objectiveHelp: target.querySelector(".current-objective-card p")?.textContent?.trim() ?? "",
    notice: target.querySelector(".living-notice p")?.textContent?.trim() ?? "",
  };
}

export function Pack99PremiumHudRuntime() {
  const [snapshot, setSnapshot] = useState<HudSnapshot>(EMPTY);

  useEffect(() => {
    let frame = 0;
    const synchronize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setSnapshot(readSnapshot()));
    };
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true });
    synchronize();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!snapshot.target) return null;

  const selectUnit = (unitId: string) => {
    const buttons = [...snapshot.target!.querySelectorAll<HTMLButtonElement>(".unit-roster > button")];
    const index = snapshot.units.findIndex((unit) => unit.id === unitId);
    buttons[index]?.click();
  };

  const endTurn = () => snapshot.target?.querySelector<HTMLButtonElement>(".end-turn-button")?.click();

  return createPortal(
    <Pack99PremiumHud
      units={snapshot.units}
      selectedUnitId={snapshot.selectedUnitId}
      resources={snapshot.resources}
      territories={snapshot.territories}
      turn={snapshot.turn}
      commandPoints={snapshot.commandPoints}
      maxCommandPoints={snapshot.maxCommandPoints}
      phase={snapshot.phase}
      objectiveTitle={snapshot.objectiveTitle}
      objectiveLabel={snapshot.objectiveLabel}
      objectiveHelp={snapshot.objectiveHelp}
      notice={snapshot.notice}
      onSelectUnit={selectUnit}
      onEndTurn={endTurn}
    />,
    snapshot.target,
  );
}
