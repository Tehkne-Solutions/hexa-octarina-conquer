import type { LivingUnit } from "./living-board-data";

interface FantasyUnitSpriteProps {
  unit: LivingUnit;
  selected?: boolean;
  compact?: boolean;
}

function GuardianArt({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-armor`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#d9ecff" />
          <stop offset="0.45" stopColor="#5476a8" />
          <stop offset="1" stopColor="#172846" />
        </linearGradient>
        <linearGradient id={`${id}-cape`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#4f91ff" />
          <stop offset="1" stopColor="#152c64" />
        </linearGradient>
      </defs>
      <path className="sprite-cape" d="M43 49 C27 65 27 100 33 116 L59 111 C61 88 59 64 55 50 Z" fill={`url(#${id}-cape)`} />
      <path d="M42 36 L32 44 L35 65 L48 73 L60 64 L64 43 L55 35 Z" fill={`url(#${id}-armor)`} stroke="#d8ecff" strokeWidth="2" />
      <path d="M40 31 L39 18 L47 9 L57 18 L57 31 Z" fill="#6e8fbe" stroke="#e6f3ff" strokeWidth="2" />
      <path d="M40 19 L47 14 L55 20 L55 29 L40 29 Z" fill="#172033" />
      <circle cx="46" cy="23" r="1.5" fill="#7eeaff" />
      <circle cx="51" cy="23" r="1.5" fill="#7eeaff" />
      <path d="M34 49 L22 55 L20 79 L31 84 L40 66 Z" fill="#46658f" stroke="#cde4ff" strokeWidth="2" />
      <path d="M61 48 L70 51 L76 72 L69 77 L57 62 Z" fill="#46658f" stroke="#cde4ff" strokeWidth="2" />
      <path d="M37 70 L34 104 L43 107 L49 78 Z" fill="#263e65" stroke="#8fb1dd" strokeWidth="2" />
      <path d="M52 76 L54 106 L64 106 L61 70 Z" fill="#263e65" stroke="#8fb1dd" strokeWidth="2" />
      <path d="M16 49 C7 56 8 82 20 91 C33 83 35 59 25 49 Z" fill="#244b80" stroke="#f0d277" strokeWidth="3" />
      <path d="M20 56 L20 83 M12 69 L28 69" stroke="#f5da83" strokeWidth="3" />
      <path d="M71 38 L78 34 L84 91 L76 93 Z" fill="#d5e7ff" stroke="#fff4c4" strokeWidth="2" />
      <path d="M77 31 L83 27 L88 35 L80 40 Z" fill="#f3ce68" />
      <circle cx="49" cy="54" r="5" fill="#79e8ff" opacity="0.8" className="sprite-core" />
    </>
  );
}

function ArcherArt({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-leather`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#d5b777" />
          <stop offset="1" stopColor="#4c3425" />
        </linearGradient>
        <linearGradient id={`${id}-hood`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#6ee2d0" />
          <stop offset="1" stopColor="#174f58" />
        </linearGradient>
      </defs>
      <path className="sprite-cape" d="M37 46 C24 67 27 99 35 115 L61 110 C63 88 61 62 55 44 Z" fill={`url(#${id}-hood)`} />
      <path d="M40 17 C49 7 61 14 62 28 L56 41 L39 38 L34 28 Z" fill={`url(#${id}-hood)`} stroke="#b7fff0" strokeWidth="2" />
      <ellipse cx="48" cy="29" rx="9" ry="11" fill="#dcb48d" />
      <path d="M39 27 C43 18 54 17 59 25 L56 18 L46 13 L38 19 Z" fill="#173a42" />
      <circle cx="45" cy="29" r="1.3" fill="#14303a" />
      <circle cx="52" cy="29" r="1.3" fill="#14303a" />
      <path d="M39 43 L31 60 L36 84 L52 88 L64 64 L57 43 Z" fill={`url(#${id}-leather)`} stroke="#f4dfab" strokeWidth="2" />
      <path d="M32 54 L20 65 L23 72 L39 65 Z" fill="#bd9368" stroke="#f0d4b0" strokeWidth="2" />
      <path d="M59 52 L70 62 L68 70 L52 65 Z" fill="#bd9368" stroke="#f0d4b0" strokeWidth="2" />
      <path d="M38 83 L34 108 L43 111 L49 88 Z" fill="#2a4e52" stroke="#78c4b8" strokeWidth="2" />
      <path d="M51 86 L54 110 L63 109 L59 82 Z" fill="#2a4e52" stroke="#78c4b8" strokeWidth="2" />
      <path d="M74 32 C91 48 88 81 73 96" fill="none" stroke="#e4c46f" strokeWidth="4" />
      <path d="M74 32 L73 96" stroke="#e8f3ff" strokeWidth="1.5" />
      <path d="M68 63 L84 54" stroke="#d8ecff" strokeWidth="2" />
      <path d="M84 54 L79 53 L82 58 Z" fill="#f5d472" />
      <path d="M29 39 L25 18 L31 16 L36 41" fill="#6e4e2d" />
      <path d="M25 18 L20 7 M28 18 L27 5 M31 18 L35 8" stroke="#e8d091" strokeWidth="2" />
      <circle cx="49" cy="58" r="5" fill="#89fff0" opacity="0.85" className="sprite-core" />
    </>
  );
}

function RaiderArt({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-iron`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#a9b0bb" />
          <stop offset="0.5" stopColor="#4f5866" />
          <stop offset="1" stopColor="#202630" />
        </linearGradient>
        <linearGradient id={`${id}-cloth`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#d74f45" />
          <stop offset="1" stopColor="#601d1a" />
        </linearGradient>
      </defs>
      <path className="sprite-cape" d="M39 46 C26 62 27 97 34 113 L65 109 C65 86 62 60 57 45 Z" fill={`url(#${id}-cloth)`} />
      <path d="M38 35 L30 48 L35 72 L50 80 L66 70 L68 47 L58 34 Z" fill={`url(#${id}-iron)`} stroke="#d1d5db" strokeWidth="2" />
      <path d="M38 31 L35 17 L42 11 L57 12 L64 20 L60 34 Z" fill="#353b45" stroke="#b8bec8" strokeWidth="2" />
      <path d="M38 18 L28 9 L32 25 Z M61 19 L73 9 L66 27 Z" fill="#d2b47a" stroke="#5a412a" strokeWidth="2" />
      <path d="M40 25 L58 25 L55 36 L43 36 Z" fill="#181a1f" />
      <circle cx="45" cy="29" r="1.6" fill="#ff725f" />
      <circle cx="53" cy="29" r="1.6" fill="#ff725f" />
      <path d="M32 49 L20 58 L20 77 L31 82 L41 64 Z" fill="#5a392a" stroke="#d8b28b" strokeWidth="2" />
      <path d="M64 49 L74 56 L77 75 L68 81 L57 64 Z" fill="#5a392a" stroke="#d8b28b" strokeWidth="2" />
      <path d="M38 75 L33 106 L43 109 L51 82 Z" fill="#332929" stroke="#7e6969" strokeWidth="2" />
      <path d="M52 81 L55 109 L66 107 L61 74 Z" fill="#332929" stroke="#7e6969" strokeWidth="2" />
      <path d="M75 38 L82 34 L87 90 L78 92 Z" fill="#5f412e" />
      <path d="M75 33 C70 22 85 17 92 25 C85 35 80 39 75 33 Z" fill="#afb4bb" stroke="#eceff3" strokeWidth="2" />
      <path d="M77 25 L91 32" stroke="#5d646e" strokeWidth="3" />
      <circle cx="50" cy="57" r="5" fill="#ff6b4c" opacity="0.75" className="sprite-core" />
    </>
  );
}

export function FantasyUnitSprite({ unit, selected = false, compact = false }: FantasyUnitSpriteProps) {
  const safeId = unit.id.replace(/[^a-z0-9_-]/gi, "-");
  return (
    <div className={`fantasy-unit-sprite faction-${unit.faction} role-${unit.role} ${selected ? "selected" : ""} ${compact ? "compact" : ""} ${unit.active ? "" : "captive"}`}>
      <span className="fantasy-unit-shadow" />
      <span className="fantasy-unit-ring" />
      <svg viewBox="0 0 100 125" role="img" aria-label={`${unit.name}, ${unit.title}`}>
        {unit.role === "guardian" ? <GuardianArt id={safeId} /> : unit.role === "archer" ? <ArcherArt id={safeId} /> : <RaiderArt id={safeId} />}
      </svg>
      <span className="fantasy-unit-level">Nv.{unit.level}</span>
      <span className="fantasy-unit-health"><i style={{ width: `${Math.max(0, unit.hp / unit.maxHp) * 100}%` }} /></span>
      {!unit.active && <span className="fantasy-unit-lock">SELADA</span>}
    </div>
  );
}
