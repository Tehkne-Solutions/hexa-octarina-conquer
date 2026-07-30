import { useState } from "react";

import type { LivingUnit } from "./living-board-data";
import { RuntimeStaticAsset } from "./RuntimePackSprite";

export type UnitVisualState = "neutral" | "selected" | "wounded" | "defeated" | "captive";

interface FantasyUnitSpriteProps {
  unit: LivingUnit;
  selected?: boolean;
  compact?: boolean;
}

const UNIT_RUNTIME_ASSETS: Record<string, string> = {
  kael: "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
  lyra: "HERO_RANGER_01_IDLE_BASE_NE_01",
  "raider-bridge": "UNIT_RECRUIT_01_IDLE_BASE_NW_01",
  "raider-mill": "CHAMP_BERSERKER_01_IDLE_BASE_NW_01",
};

export function runtimeAssetForLivingUnit(unit: Pick<LivingUnit, "id" | "role" | "faction">): string | null {
  const direct = UNIT_RUNTIME_ASSETS[unit.id];
  if (direct) return direct;
  if (unit.faction === "player" && unit.role === "guardian") return "HERO_GUARDIAN_01_IDLE_BASE_SW_01";
  if (unit.faction === "player" && unit.role === "archer") return "HERO_RANGER_01_IDLE_BASE_NE_01";
  if (unit.faction === "enemy" && unit.role === "raider") return "UNIT_RECRUIT_01_IDLE_BASE_NW_01";
  return null;
}

export function classifyUnitVisualState(
  unit: Pick<LivingUnit, "hp" | "maxHp" | "defeated" | "active">,
  selected = false,
): UnitVisualState {
  if (unit.defeated || unit.hp <= 0) return "defeated";
  if (!unit.active) return "captive";
  if (unit.maxHp > 0 && unit.hp / unit.maxHp <= 0.45) return "wounded";
  if (selected) return "selected";
  return "neutral";
}

function GuardianArt({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-armor`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#eef8ff" /><stop offset="0.42" stopColor="#6689be" /><stop offset="1" stopColor="#152641" /></linearGradient>
        <linearGradient id={`${id}-cape`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#5ba0ff" /><stop offset="1" stopColor="#13285f" /></linearGradient>
        <radialGradient id={`${id}-core`}><stop stopColor="#ecffff" /><stop offset="0.45" stopColor="#79e8ff" /><stop offset="1" stopColor="#2c6aa8" /></radialGradient>
      </defs>
      <path className="sprite-cape" d="M43 49 C27 65 27 100 33 116 L59 111 C61 88 59 64 55 50 Z" fill={`url(#${id}-cape)`} />
      <path d="M42 36 L32 44 L35 65 L48 73 L60 64 L64 43 L55 35 Z" fill={`url(#${id}-armor)`} stroke="#e8f5ff" strokeWidth="2" />
      <path d="M40 31 L39 18 L47 9 L57 18 L57 31 Z" fill="#7899c6" stroke="#f0f8ff" strokeWidth="2" />
      <path d="M40 19 L47 14 L55 20 L55 29 L40 29 Z" fill="#172033" /><path d="M44 23 H53" stroke="#84f0ff" strokeWidth="2" strokeLinecap="round" />
      <path d="M34 49 L22 55 L20 79 L31 84 L40 66 Z" fill="#4b6d98" stroke="#dceeff" strokeWidth="2" /><path d="M61 48 L70 51 L76 72 L69 77 L57 62 Z" fill="#4b6d98" stroke="#dceeff" strokeWidth="2" />
      <path d="M37 70 L34 104 L43 107 L49 78 Z" fill="#263e65" stroke="#a5c4e7" strokeWidth="2" /><path d="M52 76 L54 106 L64 106 L61 70 Z" fill="#263e65" stroke="#a5c4e7" strokeWidth="2" />
      <path d="M16 49 C7 56 8 82 20 91 C33 83 35 59 25 49 Z" fill="#244b80" stroke="#f0d277" strokeWidth="3" /><path d="M20 56 L20 83 M12 69 L28 69" stroke="#f5da83" strokeWidth="3" />
      <path d="M71 38 L78 34 L84 91 L76 93 Z" fill="#d5e7ff" stroke="#fff4c4" strokeWidth="2" /><path d="M77 31 L83 27 L88 35 L80 40 Z" fill="#f3ce68" />
      <circle cx="49" cy="54" r="6" fill={`url(#${id}-core)`} className="sprite-core" /><path d="M49 49 V59 M44 54 H54" stroke="#efffff" strokeWidth="1.5" />
    </>
  );
}

function ArcherArt({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-leather`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#e4c680" /><stop offset="1" stopColor="#4c3425" /></linearGradient>
        <linearGradient id={`${id}-hood`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#7cf1dc" /><stop offset="1" stopColor="#154b57" /></linearGradient>
        <radialGradient id={`${id}-core`}><stop stopColor="#efffff" /><stop offset="0.5" stopColor="#89fff0" /><stop offset="1" stopColor="#2c8f83" /></radialGradient>
      </defs>
      <path className="sprite-cape" d="M37 46 C24 67 27 99 35 115 L61 110 C63 88 61 62 55 44 Z" fill={`url(#${id}-hood)`} />
      <path d="M40 17 C49 7 61 14 62 28 L56 41 L39 38 L34 28 Z" fill={`url(#${id}-hood)`} stroke="#c8fff4" strokeWidth="2" /><ellipse cx="48" cy="29" rx="9" ry="11" fill="#dcb48d" />
      <path d="M39 27 C43 18 54 17 59 25 L56 18 L46 13 L38 19 Z" fill="#173a42" /><path d="M43 29 Q48 32 54 29" fill="none" stroke="#17303a" strokeWidth="1.5" />
      <path d="M39 43 L31 60 L36 84 L52 88 L64 64 L57 43 Z" fill={`url(#${id}-leather)`} stroke="#f4dfab" strokeWidth="2" />
      <path d="M32 54 L20 65 L23 72 L39 65 Z" fill="#bd9368" stroke="#f0d4b0" strokeWidth="2" /><path d="M59 52 L70 62 L68 70 L52 65 Z" fill="#bd9368" stroke="#f0d4b0" strokeWidth="2" />
      <path d="M38 83 L34 108 L43 111 L49 88 Z" fill="#2a4e52" stroke="#78c4b8" strokeWidth="2" /><path d="M51 86 L54 110 L63 109 L59 82 Z" fill="#2a4e52" stroke="#78c4b8" strokeWidth="2" />
      <path d="M74 32 C91 48 88 81 73 96" fill="none" stroke="#e4c46f" strokeWidth="4" /><path d="M74 32 L73 96" stroke="#e8f3ff" strokeWidth="1.5" /><path d="M68 63 L84 54" stroke="#d8ecff" strokeWidth="2" /><path d="M84 54 L79 53 L82 58 Z" fill="#f5d472" />
      <path d="M29 39 L25 18 L31 16 L36 41" fill="#6e4e2d" /><path d="M25 18 L20 7 M28 18 L27 5 M31 18 L35 8" stroke="#e8d091" strokeWidth="2" />
      <circle cx="49" cy="58" r="6" fill={`url(#${id}-core)`} className="sprite-core" /><path d="M49 53 L53 58 L49 63 L45 58 Z" fill="#efffff" opacity=".9" />
    </>
  );
}

function RaiderArt({ id, elite }: { id: string; elite: boolean }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-iron`} x1="0" x2="1" y1="0" y2="1"><stop stopColor={elite ? "#d1c29e" : "#a9b0bb"} /><stop offset="0.5" stopColor={elite ? "#665541" : "#4f5866"} /><stop offset="1" stopColor="#202630" /></linearGradient>
        <linearGradient id={`${id}-cloth`} x1="0" x2="0" y1="0" y2="1"><stop stopColor={elite ? "#f27a46" : "#d74f45"} /><stop offset="1" stopColor="#601d1a" /></linearGradient>
      </defs>
      <path className="sprite-cape" d="M39 46 C26 62 27 97 34 113 L65 109 C65 86 62 60 57 45 Z" fill={`url(#${id}-cloth)`} />
      <path d="M38 35 L30 48 L35 72 L50 80 L66 70 L68 47 L58 34 Z" fill={`url(#${id}-iron)`} stroke={elite ? "#f0d998" : "#d1d5db"} strokeWidth="2" />
      <path d="M38 31 L35 17 L42 11 L57 12 L64 20 L60 34 Z" fill="#353b45" stroke={elite ? "#efcf78" : "#b8bec8"} strokeWidth="2" />
      <path d="M38 18 L28 9 L32 25 Z M61 19 L73 9 L66 27 Z" fill="#d2b47a" stroke="#5a412a" strokeWidth="2" />{elite ? <path d="M37 13 L42 3 L49 12 L56 3 L62 15" fill="#c59242" stroke="#ffe5a0" strokeWidth="2" /> : null}
      <path d="M40 25 L58 25 L55 36 L43 36 Z" fill="#181a1f" /><path d="M43 29 H55" stroke="#ff725f" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 49 L20 58 L20 77 L31 82 L41 64 Z" fill="#5a392a" stroke="#d8b28b" strokeWidth="2" /><path d="M64 49 L74 56 L77 75 L68 81 L57 64 Z" fill="#5a392a" stroke="#d8b28b" strokeWidth="2" />
      <path d="M38 75 L33 106 L43 109 L51 82 Z" fill="#332929" stroke="#7e6969" strokeWidth="2" /><path d="M52 81 L55 109 L66 107 L61 74 Z" fill="#332929" stroke="#7e6969" strokeWidth="2" />
      <path d="M75 38 L82 34 L87 90 L78 92 Z" fill="#5f412e" /><path d="M75 33 C70 22 85 17 92 25 C85 35 80 39 75 33 Z" fill={elite ? "#d0b26b" : "#afb4bb"} stroke="#eceff3" strokeWidth="2" />
      <path d="M77 25 L91 32" stroke="#5d646e" strokeWidth="3" /><circle cx="50" cy="57" r="6" fill={elite ? "#ffb34c" : "#ff6b4c"} opacity="0.82" className="sprite-core" /><path d="M45 57 H55 M50 52 V62" stroke="#fff0d5" strokeWidth="1.5" />
    </>
  );
}

export function FantasyUnitSprite({ unit, selected = false, compact = false }: FantasyUnitSpriteProps) {
  const safeId = unit.id.replace(/[^a-z0-9_-]/gi, "-");
  const visualState = classifyUnitVisualState(unit, selected);
  const elite = unit.id.includes("mill") || unit.title.toLowerCase().includes("capitão");
  const runtimeAssetId = runtimeAssetForLivingUnit(unit);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const stateLabel = visualState === "wounded" ? "ferido" : visualState === "defeated" ? "derrotado" : visualState === "captive" ? "selado" : visualState === "selected" ? "selecionado" : "pronto";

  return (
    <div className={`fantasy-unit-sprite faction-${unit.faction} role-${unit.role} state-${visualState} ${compact ? "compact" : ""} ${elite ? "elite" : ""} ${runtimeReady ? "runtime-bound" : "runtime-fallback"}`} data-unit-state={visualState} data-runtime-binding={runtimeAssetId ?? "none"}>
      <span className="fantasy-unit-shadow" aria-hidden="true" /><span className="fantasy-unit-ring" aria-hidden="true" /><span className="fantasy-unit-aura" aria-hidden="true" />
      {runtimeAssetId ? <RuntimeStaticAsset assetId={runtimeAssetId} className="fantasy-unit-runtime-art" alt={`${unit.name}, ${unit.title}, ${stateLabel}`} onReady={setRuntimeReady} /> : null}
      <svg className="fantasy-unit-fallback-art" viewBox="0 0 100 125" role="img" aria-label={`${unit.name}, ${unit.title}, ${stateLabel}`} aria-hidden={runtimeReady}>
        {unit.role === "guardian" ? <GuardianArt id={safeId} /> : unit.role === "archer" ? <ArcherArt id={safeId} /> : <RaiderArt id={safeId} elite={elite} />}
        <g className="sprite-wound-marks" aria-hidden="true"><path d="M30 48 L42 56 L35 64 L49 73" /><path d="M65 42 L57 53 L69 60" /></g>
      </svg>
      <span className="fantasy-unit-level">Nv.{unit.level}</span><span className="fantasy-unit-health"><i style={{ width: `${Math.max(0, unit.hp / unit.maxHp) * 100}%` }} /></span>
      {visualState === "wounded" ? <span className="fantasy-unit-status">FERIDO</span> : null}{visualState === "defeated" ? <span className="fantasy-unit-status">DERROTADO</span> : null}{visualState === "captive" ? <span className="fantasy-unit-lock">SELADA</span> : null}
    </div>
  );
}
