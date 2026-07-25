import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { RuntimeAnimatedSprite, RuntimeStaticAsset, type RuntimeSpriteState } from "./RuntimePackSprite";

interface UnitTarget { id: string; node: HTMLElement; entityId: string; state: RuntimeSpriteState; label: string; }
interface NodeTarget { id: string; node: HTMLElement; pillarId: string; effectId: string | null; }
interface EdgeTarget { id: string; left: number; top: number; width: number; angle: number; owner: string; assetId: string; }
interface CombatTarget { stage: HTMLElement; beat: string; playerName: string; enemyName: string; playerDefeated: boolean; enemyDefeated: boolean; }
interface RuntimeSnapshot { world: HTMLElement | null; units: UnitTarget[]; nodes: NodeTarget[]; edges: EdgeTarget[]; combat: CombatTarget | null; signature: string; }

const EMPTY_SNAPSHOT: RuntimeSnapshot = { world: null, units: [], nodes: [], edges: [], combat: null, signature: "empty" };
let nextTargetId = 1;

function targetId(node: HTMLElement, prefix: string): string {
  if (!node.dataset.runtimeTargetId) node.dataset.runtimeTargetId = `${prefix}-${nextTargetId++}`;
  return node.dataset.runtimeTargetId;
}
function normalizedText(node: Element | null): string { return node?.textContent?.replace(/\s+/g, " ").trim() ?? ""; }

export function runtimeEntityForUnit(node: HTMLElement): string {
  if (node.classList.contains("elite")) return "CHAMP_BERSERKER_01";
  if (node.classList.contains("role-archer")) return "HERO_RANGER_01";
  if (node.classList.contains("role-guardian")) return "HERO_GUARDIAN_01";
  return node.classList.contains("faction-enemy") ? "UNIT_RECRUIT_01" : "HERO_GUARDIAN_01";
}

export function runtimeEntityForCombatant(name: string, side: "player" | "enemy"): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("lyra")) return "HERO_RANGER_01";
  if (normalized.includes("brakk") || normalized.includes("capitão")) return "CHAMP_BERSERKER_01";
  if (normalized.includes("varg") || normalized.includes("saqueador") || normalized.includes("cinzas")) return "UNIT_RECRUIT_01";
  return side === "player" ? "HERO_GUARDIAN_01" : "UNIT_RECRUIT_01";
}

export function runtimeCombatState(side: "player" | "enemy", beat: string, defeated: boolean): RuntimeSpriteState {
  if (defeated && (beat === "aftermath" || beat === "summary")) return "defeat";
  if (side === "player" && beat === "player-strike") return "attack";
  if (side === "enemy" && beat === "enemy-strike") return "attack";
  if (side === "enemy" && beat === "player-strike") return "hit";
  if (side === "player" && beat === "enemy-strike") return "hit";
  return "idle";
}

function scanEdges(world: HTMLElement): EdgeTarget[] {
  return Array.from(world.querySelectorAll<SVGGElement>(".influence-edge")).flatMap((group, index) => {
    const line = group.querySelector<SVGLineElement>("line");
    if (!line) return [];
    const x1 = Number(line.getAttribute("x1") ?? 0) / 10;
    const y1 = Number(line.getAttribute("y1") ?? 0) / 10;
    const x2 = Number(line.getAttribute("x2") ?? 0) / 10;
    const y2 = Number(line.getAttribute("y2") ?? 0) / 10;
    const dx = x2 - x1;
    const dy = y2 - y1;
    return [{
      id: `edge-${index}-${x1}-${y1}-${x2}-${y2}`,
      left: (x1 + x2) / 2,
      top: (y1 + y2) / 2,
      width: Math.hypot(dx, dy),
      angle: Math.atan2(dy, dx) * 180 / Math.PI,
      owner: group.classList.contains("owner-enemy") ? "enemy" : "player",
      assetId: Math.abs(dx) >= Math.abs(dy) ? "EDGE_ARCANE_BUILT_NE_SW_01" : "EDGE_ARCANE_BUILT_NW_SE_01",
    }];
  });
}

function readCombatTarget(): CombatTarget | null {
  const stage = document.querySelector<HTMLElement>(".living-battle-stage");
  if (!stage) return null;
  const [playerName = "Kael", enemyName = "Varg"] = normalizedText(stage.querySelector("header h2")).split("×").map((value) => value.trim());
  return {
    stage,
    beat: stage.dataset.cinematicBeat ?? "selection",
    playerName,
    enemyName,
    playerDefeated: normalizedText(stage.querySelector(".player-fighter > span")).startsWith("0/"),
    enemyDefeated: normalizedText(stage.querySelector(".enemy-fighter > span")).startsWith("0/"),
  };
}

function useRuntimeSnapshot(): RuntimeSnapshot {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(EMPTY_SNAPSHOT);
  const positions = useRef(new Map<string, string>());
  const health = useRef(new Map<string, string>());
  const transientUntil = useRef(new Map<string, { state: RuntimeSpriteState; until: number }>());

  useEffect(() => {
    let frame = 0;
    let timer = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(scan); };
    const scan = () => {
      const now = performance.now();
      const world = document.querySelector<HTMLElement>(".go-dots-world");
      let needsExpiryScan = false;
      const units = Array.from(document.querySelectorAll<HTMLElement>(".fantasy-unit-sprite")).map((node) => {
        const id = targetId(node, "unit");
        const position = node.closest<HTMLElement>(".go-node")?.getAttribute("style") ?? "";
        if (positions.current.has(id) && positions.current.get(id) !== position) transientUntil.current.set(id, { state: "walk", until: now + 650 });
        positions.current.set(id, position);
        const healthWidth = node.querySelector<HTMLElement>(".fantasy-unit-health i")?.style.width ?? "";
        if (health.current.has(id) && health.current.get(id) !== healthWidth) transientUntil.current.set(id, { state: "hit", until: now + 420 });
        health.current.set(id, healthWidth);
        const transient = transientUntil.current.get(id);
        if (transient && transient.until <= now) transientUntil.current.delete(id);
        if (transient && transient.until > now) needsExpiryScan = true;
        const state: RuntimeSpriteState = node.classList.contains("state-defeated") ? "defeat" : transient && transient.until > now ? transient.state : "idle";
        return { id, node, entityId: runtimeEntityForUnit(node), state, label: node.getAttribute("aria-label") ?? "Unidade" };
      });
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(".go-node")).map((node) => ({
        id: targetId(node, "node"), node,
        pillarId: node.classList.contains("selected") || node.classList.contains("objective-target") ? "PILLAR_SELECTED_01" : "PILLAR_NEUTRAL_01",
        effectId: node.classList.contains("objective-target") ? "VFX_CELL_OBJECTIVE_01" : node.classList.contains("selected") ? "VFX_CELL_SELECTED_01" : node.classList.contains("valid") || node.classList.contains("recommended") ? "VFX_CELL_VALID_01" : null,
      }));
      const edges = world ? scanEdges(world) : [];
      const combat = readCombatTarget();
      const signature = JSON.stringify({
        world: Boolean(world), units: units.map(({ id, entityId, state }) => [id, entityId, state]),
        nodes: nodes.map(({ id, pillarId, effectId }) => [id, pillarId, effectId]), edges: edges.map(({ id, owner }) => [id, owner]),
        combat: combat ? [combat.beat, combat.playerName, combat.enemyName, combat.playerDefeated, combat.enemyDefeated] : null,
      });
      setSnapshot((current) => current.signature === signature ? current : { world, units, nodes, edges, combat, signature });
      if (needsExpiryScan) timer = window.setTimeout(schedule, 700);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true });
    schedule();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, []);
  return snapshot;
}

function RuntimeUnitPortal({ target }: { target: UnitTarget }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { target.node.classList.toggle("runtime-pack-ready", ready); return () => target.node.classList.remove("runtime-pack-ready"); }, [ready, target.node]);
  return <span className="runtime-unit-overlay" aria-hidden="true"><RuntimeAnimatedSprite entityId={target.entityId} state={target.state} className="runtime-map-unit" label={target.label} onReady={setReady} /></span>;
}

function RuntimeNodePortal({ target }: { target: NodeTarget }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { target.node.classList.toggle("runtime-node-ready", ready); return () => target.node.classList.remove("runtime-node-ready"); }, [ready, target.node]);
  return <span className="runtime-node-overlay" aria-hidden="true">{target.effectId ? <RuntimeStaticAsset assetId={target.effectId} className="runtime-node-vfx" /> : null}<RuntimeStaticAsset assetId={target.pillarId} className="runtime-node-pillar" onReady={setReady} /></span>;
}

function RuntimeWorldOverlay({ edges }: { edges: EdgeTarget[] }) {
  const [grassUrl, setGrassUrl] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; import("./runtime-assets").then(({ runtimeAssetUrl }) => runtimeAssetUrl("TILE_GRASS_FLAT_CENTER_A_01")).then((url) => { if (!cancelled) setGrassUrl(url); }); return () => { cancelled = true; }; }, []);
  const style = grassUrl ? { "--runtime-grass-tile": `url("${grassUrl}")` } as CSSProperties : undefined;
  return <div className="runtime-world-overlay" style={style} aria-hidden="true"><div className="runtime-terrain-mosaic" /><RuntimeStaticAsset assetId="TILE_FOREST_FLAT_CENTER_A_01" className="runtime-land-tile runtime-forest-tile" /><RuntimeStaticAsset assetId="TILE_WATER_FLAT_CENTER_A_01" className="runtime-land-tile runtime-water-tile" />{edges.map((edge) => <RuntimeStaticAsset key={edge.id} assetId={edge.assetId} className={`runtime-board-edge owner-${edge.owner}`} style={{ left: `${edge.left}%`, top: `${edge.top}%`, width: `${edge.width}%`, transform: `translate(-50%, -50%) rotate(${edge.angle}deg)` }} />)}</div>;
}

function RuntimeCombatPortal({ target }: { target: CombatTarget }) {
  const playerEntity = useMemo(() => runtimeEntityForCombatant(target.playerName, "player"), [target.playerName]);
  const enemyEntity = useMemo(() => runtimeEntityForCombatant(target.enemyName, "enemy"), [target.enemyName]);
  const playerState = runtimeCombatState("player", target.beat, target.playerDefeated);
  const enemyState = runtimeCombatState("enemy", target.beat, target.enemyDefeated);
  const effectId = target.beat === "player-strike" ? "VFX_COMBAT_SLASH_01" : target.beat === "enemy-strike" ? "VFX_COMBAT_HEAVY_STRIKE_01" : target.beat === "player-speech" ? "VFX_COMBAT_SHIELD_01" : null;
  return <div className={`runtime-combatants beat-${target.beat}`} aria-hidden="true"><div className="runtime-combatant runtime-player-combatant"><RuntimeAnimatedSprite entityId={playerEntity} state={playerState} className="runtime-combat-sprite" /></div><div className="runtime-combatant runtime-enemy-combatant"><RuntimeAnimatedSprite entityId={enemyEntity} state={enemyState} className="runtime-combat-sprite" /></div>{effectId ? <RuntimeStaticAsset assetId={effectId} className={`runtime-combat-vfx vfx-${target.beat}`} /> : null}</div>;
}

export function RuntimeAssetOverlay() {
  const snapshot = useRuntimeSnapshot();
  return <>{snapshot.world ? createPortal(<RuntimeWorldOverlay edges={snapshot.edges} />, snapshot.world) : null}{snapshot.units.map((target) => createPortal(<RuntimeUnitPortal key={target.id} target={target} />, target.node))}{snapshot.nodes.map((target) => createPortal(<RuntimeNodePortal key={target.id} target={target} />, target.node))}{snapshot.combat ? createPortal(<RuntimeCombatPortal target={snapshot.combat} />, snapshot.combat.stage) : null}</>;
}
