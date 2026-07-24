import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { FantasyBuildingSprite, type FantasyBuildingType } from "./FantasyBuildingSprite";
import { trackExperience } from "./experience-telemetry";

const HAPTICS_KEY = "hexa.settings.combat-haptics";
const IMPACT_SOUND_KEY = "hexa.settings.combat-sound";

export interface BattlePresentationSnapshot {
  battleOpen: boolean;
  resolutionKey: string | null;
  playerDamage: number;
  enemyDamage: number;
  result: "victory" | "defeat" | null;
  building: FantasyBuildingType | null;
  round: number;
  territories: number;
  highlights: string[];
}

interface PortalTargets {
  stage: HTMLElement | null;
  farmOption: HTMLElement | null;
  towerOption: HTMLElement | null;
  outcome: HTMLElement | null;
}

const EMPTY_TARGETS: PortalTargets = {
  stage: null,
  farmOption: null,
  towerOption: null,
  outcome: null,
};

const EMPTY_SNAPSHOT: BattlePresentationSnapshot = {
  battleOpen: false,
  resolutionKey: null,
  playerDamage: 0,
  enemyDamage: 0,
  result: null,
  building: null,
  round: 1,
  territories: 0,
  highlights: [],
};

function parseNumber(text: string | null | undefined): number {
  const match = text?.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function classifyImpact(damage: number): "light" | "medium" | "heavy" {
  if (damage >= 6) return "heavy";
  if (damage >= 3) return "medium";
  return "light";
}

export function buildTacticalHighlights(entries: string[], result: "victory" | "defeat" | null): string[] {
  const cleaned = entries
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, all) => all.indexOf(entry) === index)
    .slice(0, 3);

  if (cleaned.length > 0) return cleaned;
  return result === "victory"
    ? ["As trilhas foram convertidas em território.", "O nó do moinho voltou ao domínio de Orun."]
    : ["As liberdades da formação foram pressionadas.", "Uma nova rota pode preservar as unidades."];
}

function sameSnapshot(left: BattlePresentationSnapshot, right: BattlePresentationSnapshot): boolean {
  return left.battleOpen === right.battleOpen
    && left.resolutionKey === right.resolutionKey
    && left.playerDamage === right.playerDamage
    && left.enemyDamage === right.enemyDamage
    && left.result === right.result
    && left.building === right.building
    && left.round === right.round
    && left.territories === right.territories
    && left.highlights.join("|") === right.highlights.join("|");
}

export function readBattlePresentation(root: HTMLElement): BattlePresentationSnapshot {
  const resolution = root.querySelector<HTMLElement>(".battle-resolution-panel");
  const damageDealt = parseNumber(resolution?.querySelector(".damage-dealt")?.textContent);
  const damageTaken = parseNumber(resolution?.querySelector(".damage-taken")?.textContent);
  const outcome = root.querySelector<HTMLElement>(".outcome-screen");
  const outcomeText = outcome?.textContent ?? "";
  const result = outcome?.classList.contains("victory")
    ? "victory"
    : outcome?.classList.contains("defeat")
      ? "defeat"
      : null;
  const building = outcomeText.includes("Fazenda Arcana")
    ? "farm"
    : outcomeText.includes("Torre Rúnica")
      ? "tower"
      : null;
  const eventEntries = [...root.querySelectorAll<HTMLElement>(".event-timeline p")].map((entry) => entry.textContent ?? "");
  const territoriesMatch = outcomeText.match(/(\d+)\s+territórios?/i);
  const round = Math.max(1, parseNumber(root.querySelector(".phase-banner small")?.textContent));
  const resolutionKey = resolution
    ? `${round}:${damageDealt}:${damageTaken}:${resolution.textContent?.slice(0, 80) ?? ""}`
    : null;

  return {
    battleOpen: Boolean(root.querySelector(".living-battle-overlay")),
    resolutionKey,
    playerDamage: damageDealt,
    enemyDamage: damageTaken,
    result,
    building,
    round,
    territories: territoriesMatch ? Number(territoriesMatch[1]) : 0,
    highlights: buildTacticalHighlights(eventEntries, result),
  };
}

function readPreference(key: string): boolean {
  return window.localStorage.getItem(key) !== "false";
}

function writePreference(key: string, value: boolean): void {
  window.localStorage.setItem(key, String(value));
}

function effectsReduced(): boolean {
  return document.documentElement.classList.contains("hexa-reduced-motion")
    || document.documentElement.classList.contains("hexa-low-effects")
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function vibrateImpact(playerDamage: number, enemyDamage: number): void {
  if (!("vibrate" in navigator) || effectsReduced()) return;
  const strongest = Math.max(playerDamage, enemyDamage);
  const pattern = classifyImpact(strongest) === "heavy" ? [35, 28, 65] : classifyImpact(strongest) === "medium" ? [24, 24, 38] : [18];
  navigator.vibrate(pattern);
}

function playImpactSound(playerDamage: number, enemyDamage: number): void {
  if (effectsReduced()) return;
  const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return;
  const context = new AudioContextConstructor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const strongest = Math.max(playerDamage, enemyDamage);
  const impact = classifyImpact(strongest);
  oscillator.type = impact === "heavy" ? "sawtooth" : impact === "medium" ? "triangle" : "sine";
  oscillator.frequency.setValueAtTime(impact === "heavy" ? 118 : impact === "medium" ? 168 : 230, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(72, context.currentTime + 0.16);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.21);
  oscillator.addEventListener("ended", () => void context.close(), { once: true });
}

function PrismaticBowMark() {
  return (
    <svg className="prismatic-bow-mark" viewBox="0 0 120 100" role="img" aria-label="Arco Prismático">
      <defs>
        <linearGradient id="prismatic-bow" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#70e7ff" />
          <stop offset="0.48" stopColor="#d08cff" />
          <stop offset="1" stopColor="#ffd36b" />
        </linearGradient>
      </defs>
      <path d="M28 16 C78 24 96 55 70 88" fill="none" stroke="url(#prismatic-bow)" strokeWidth="9" strokeLinecap="round" />
      <path d="M28 16 L70 88" stroke="#edfaff" strokeWidth="2" />
      <path d="M42 49 L91 36" stroke="#eaffff" strokeWidth="4" strokeLinecap="round" />
      <path d="M91 36 L80 31 L84 43 Z" fill="#ffd96f" />
      <circle cx="42" cy="49" r="8" fill="#19263a" stroke="#79f6ff" strokeWidth="3" />
      <path d="M42 43 V55 M36 49 H48" stroke="#e7ffff" strokeWidth="2" />
    </svg>
  );
}

function clickOutcomeAction(target: HTMLElement | null, selector: string): void {
  target?.querySelector<HTMLButtonElement>(selector)?.click();
}

export function BattlePresentationLayer({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const [snapshot, setSnapshot] = useState<BattlePresentationSnapshot>(EMPTY_SNAPSHOT);
  const [targets, setTargets] = useState<PortalTargets>(EMPTY_TARGETS);
  const [impactToken, setImpactToken] = useState(0);
  const [hapticsEnabled, setHapticsEnabled] = useState(() => readPreference(HAPTICS_KEY));
  const [soundEnabled, setSoundEnabled] = useState(() => readPreference(IMPACT_SOUND_KEY));
  const lastResolutionRef = useRef<string | null>(null);
  const lastResultRef = useRef<BattlePresentationSnapshot["result"]>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frame = 0;
    const synchronize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = readBattlePresentation(root);
        setSnapshot((current) => sameSnapshot(current, next) ? current : next);
        const outcome = root.querySelector<HTMLElement>(".outcome-screen");
        root.querySelectorAll<HTMLElement>(".outcome-screen.cinematic-enhanced").forEach((node) => {
          if (node !== outcome) node.classList.remove("cinematic-enhanced");
        });
        if (outcome) outcome.classList.add("cinematic-enhanced");
        setTargets((current) => {
          const nextTargets = {
            stage: root.querySelector<HTMLElement>(".living-battle-stage"),
            farmOption: root.querySelector<HTMLElement>(".construction-options button:first-child"),
            towerOption: root.querySelector<HTMLElement>(".construction-options button:nth-child(2)"),
            outcome,
          };
          return current.stage === nextTargets.stage
            && current.farmOption === nextTargets.farmOption
            && current.towerOption === nextTargets.towerOption
            && current.outcome === nextTargets.outcome
            ? current
            : nextTargets;
        });
      });
    };

    const observer = new MutationObserver(synchronize);
    observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true });
    synchronize();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      root.querySelectorAll<HTMLElement>(".outcome-screen.cinematic-enhanced").forEach((node) => node.classList.remove("cinematic-enhanced"));
    };
  }, [rootRef]);

  useEffect(() => {
    if (!snapshot.resolutionKey || lastResolutionRef.current === snapshot.resolutionKey) return;
    lastResolutionRef.current = snapshot.resolutionKey;
    setImpactToken((value) => value + 1);
    if (hapticsEnabled) vibrateImpact(snapshot.playerDamage, snapshot.enemyDamage);
    if (soundEnabled) playImpactSound(snapshot.playerDamage, snapshot.enemyDamage);
    trackExperience("battle_session", {
      screen: "campaign-living",
      value: `combat-${classifyImpact(Math.max(snapshot.playerDamage, snapshot.enemyDamage))}`,
    });
  }, [snapshot.resolutionKey, snapshot.playerDamage, snapshot.enemyDamage, hapticsEnabled, soundEnabled]);

  useEffect(() => {
    if (!snapshot.result || lastResultRef.current === snapshot.result) return;
    lastResultRef.current = snapshot.result;
    trackExperience("battle_session", {
      screen: "campaign-living",
      value: snapshot.result,
      durationMs: undefined,
    });
  }, [snapshot.result]);

  const strongestImpact = useMemo(() => classifyImpact(Math.max(snapshot.playerDamage, snapshot.enemyDamage)), [snapshot.playerDamage, snapshot.enemyDamage]);
  const buildingLabel = snapshot.building === "farm" ? "Fazenda Arcana" : snapshot.building === "tower" ? "Torre Rúnica" : null;
  const hapticsSupported = "vibrate" in navigator;

  const toggleHaptics = () => {
    const next = !hapticsEnabled;
    setHapticsEnabled(next);
    writePreference(HAPTICS_KEY, next);
    if (next && hapticsSupported) navigator.vibrate(18);
  };
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    writePreference(IMPACT_SOUND_KEY, next);
    if (next) playImpactSound(2, 0);
  };

  return (
    <>
      {targets.stage ? createPortal(
        <div className="combat-presentation-tools">
          <div className="combat-feedback-toggles" aria-label="Preferências de feedback de combate">
            <button type="button" onClick={toggleSound} aria-pressed={soundEnabled}>Som {soundEnabled ? "ativo" : "desativado"}</button>
            <button type="button" onClick={toggleHaptics} aria-pressed={hapticsEnabled} disabled={!hapticsSupported}>Vibração {hapticsSupported ? hapticsEnabled ? "ativa" : "desativada" : "indisponível"}</button>
          </div>
          {snapshot.resolutionKey ? (
            <div key={impactToken} className={`combat-impact-layer impact-${strongestImpact}`} aria-hidden="true">
              <span className="impact-flash" />
              <span className="impact-slash slash-one" />
              <span className="impact-slash slash-two" />
              <b className="impact-number dealt">-{snapshot.playerDamage}</b>
              <b className="impact-number taken">-{snapshot.enemyDamage}</b>
            </div>
          ) : null}
        </div>,
        targets.stage,
      ) : null}

      {targets.farmOption ? createPortal(<FantasyBuildingSprite type="farm" state="preview" label="Prévia da Fazenda Arcana" />, targets.farmOption) : null}
      {targets.towerOption ? createPortal(<FantasyBuildingSprite type="tower" state="preview" label="Prévia da Torre Rúnica" />, targets.towerOption) : null}

      {targets.outcome && snapshot.result ? createPortal(
        <section className={`post-battle-cinematic result-${snapshot.result}`} aria-labelledby="post-battle-title">
          <div className="cinematic-atmosphere" aria-hidden="true"><i /><i /><i /><b /></div>
          <header>
            <p>{snapshot.result === "victory" ? "MISSÃO CONCLUÍDA" : "A REDE FOI ROMPIDA"}</p>
            <h1 id="post-battle-title">{snapshot.result === "victory" ? "Orun voltou a respirar" : "A formação será reconstruída"}</h1>
            <span>{snapshot.result === "victory" ? "A Ponte das Cinzas foi retomada" : "O mapa permanece disponível para uma nova tentativa"}</span>
          </header>

          <div className="cinematic-score-grid">
            <article><small>Rodadas</small><strong>{snapshot.round}</strong></article>
            <article><small>Territórios</small><strong>{snapshot.territories}</strong></article>
            <article><small>Resultado</small><strong>{snapshot.result === "victory" ? "Vitória" : "Derrota"}</strong></article>
          </div>

          <div className="cinematic-content-grid">
            <article className="tactical-highlights">
              <small>DESTAQUES TÁTICOS</small>
              <ul>{snapshot.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
            </article>
            <article className="cinematic-rewards">
              <small>{snapshot.result === "victory" ? "RECOMPENSAS" : "PREPARAÇÃO"}</small>
              {snapshot.result === "victory" ? (
                <>
                  <div className="cinematic-reward"><PrismaticBowMark /><span><strong>Arco Prismático</strong><small>Nova arma desbloqueada</small></span></div>
                  {snapshot.building && buildingLabel ? <div className="cinematic-reward"><FantasyBuildingSprite type={snapshot.building} compact state="built" /><span><strong>{buildingLabel}</strong><small>Construção adicionada à coleção</small></span></div> : null}
                </>
              ) : (
                <p>Reorganize as liberdades, preserve unidades feridas e use cartas defensivas antes de contestar o moinho.</p>
              )}
            </article>
          </div>

          <footer>
            <button type="button" className="living-secondary" onClick={() => clickOutcomeAction(targets.outcome, ".outcome-actions .living-secondary")}>{snapshot.result === "victory" ? "Avançar no mapa" : "Voltar ao mapa"}</button>
            <button type="button" className="living-primary" onClick={() => clickOutcomeAction(targets.outcome, ".outcome-actions .living-primary")}>{snapshot.result === "victory" ? "Repetir missão" : "Tentar novamente"}</button>
          </footer>
        </section>,
        targets.outcome,
      ) : null}
    </>
  );
}
