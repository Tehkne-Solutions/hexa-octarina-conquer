import { type RefObject, useEffect, useMemo, useState } from "react";

interface MinimapUnit { id: string; faction: "player" | "enemy"; left: number; top: number; selected: boolean }
interface Territory { owner: "player" | "enemy"; left: number; top: number }
interface MinimapSnapshot { units: MinimapUnit[]; territories: Territory[]; objective: { left: number; top: number } | null; turn: string }

const EMPTY: MinimapSnapshot = { units: [], territories: [], objective: null, turn: "RODADA 1" };

function readPercent(value: string): number { const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : 0; }

function readSnapshot(root: HTMLElement): MinimapSnapshot {
  const world = root.querySelector<HTMLElement>(".go-dots-world");
  if (!world) return EMPTY;
  const units = [...world.querySelectorAll<HTMLElement>(".go-node.occupied")].map((node, index) => ({
    id: node.getAttribute("aria-label") ?? `unit-${index}`,
    faction: node.classList.contains("enemy-node") ? "enemy" as const : "player" as const,
    left: readPercent(node.style.left),
    top: readPercent(node.style.top),
    selected: node.classList.contains("selected"),
  }));
  const territories = [...world.querySelectorAll<HTMLElement>(".claimed-territory")].map((node) => ({
    owner: node.classList.contains("owner-enemy") ? "enemy" as const : "player" as const,
    left: readPercent(node.style.left),
    top: readPercent(node.style.top),
  }));
  const objectiveNode = world.querySelector<HTMLElement>(".go-node.objective-target");
  const objective = objectiveNode ? { left: readPercent(objectiveNode.style.left), top: readPercent(objectiveNode.style.top) } : null;
  const turn = root.querySelector(".phase-banner small")?.textContent?.trim() ?? "RODADA 1";
  return { units, territories, objective, turn };
}

export function Pack99TerritoryMinimap({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const [snapshot, setSnapshot] = useState<MinimapSnapshot>(EMPTY);
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    let frame = 0;
    const sync = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setSnapshot(readSnapshot(root))); };
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, childList: true, subtree: true }); sync();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [rootRef]);
  const counts = useMemo(() => ({ player: snapshot.territories.filter((item) => item.owner === "player").length, enemy: snapshot.territories.filter((item) => item.owner === "enemy").length }), [snapshot.territories]);
  return (
    <aside className="pack99-territory-minimap" aria-label="Minimapa tático">
      <header><span>MAPA TÁTICO</span><b>{snapshot.turn}</b></header>
      <div className="pack99-minimap-canvas">
        <div className="pack99-minimap-grid" />
        {snapshot.territories.map((item, index) => <i key={`territory-${index}`} className={`territory owner-${item.owner}`} style={{ left: `${item.left}%`, top: `${item.top}%` }} />)}
        {snapshot.units.map((unit) => <b key={unit.id} className={`unit faction-${unit.faction} ${unit.selected ? "selected" : ""}`} style={{ left: `${unit.left}%`, top: `${unit.top}%` }} />)}
        {snapshot.objective ? <span className="objective" style={{ left: `${snapshot.objective.left}%`, top: `${snapshot.objective.top}%` }} /> : null}
      </div>
      <footer><span><i className="blue" /> Orun {counts.player}</span><span><i className="red" /> Inimigo {counts.enemy}</span></footer>
    </aside>
  );
}
