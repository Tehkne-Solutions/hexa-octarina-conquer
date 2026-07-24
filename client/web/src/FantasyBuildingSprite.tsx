export type FantasyBuildingType = "mill" | "farm" | "tower";
export type FantasyBuildingState = "neutral" | "preview" | "built" | "damaged";

interface FantasyBuildingSpriteProps {
  type: FantasyBuildingType;
  state?: FantasyBuildingState;
  compact?: boolean;
  label?: string;
}

function MillArt({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-stone`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#d6c69a" />
          <stop offset="0.52" stopColor="#75684e" />
          <stop offset="1" stopColor="#2d302b" />
        </linearGradient>
        <linearGradient id={`${id}-roof`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#b46246" />
          <stop offset="1" stopColor="#49251f" />
        </linearGradient>
      </defs>
      <path d="M36 94 L42 42 L93 42 L101 94 Z" fill={`url(#${id}-stone)`} stroke="#e9d9aa" strokeWidth="3" />
      <path d="M34 44 L68 19 L102 44 Z" fill={`url(#${id}-roof)`} stroke="#e5b47e" strokeWidth="3" />
      <rect x="58" y="68" width="20" height="26" rx="3" fill="#211d1a" stroke="#d8b879" strokeWidth="2" />
      <circle cx="69" cy="52" r="8" fill="#15262c" stroke="#7de4e4" strokeWidth="2" />
      <circle cx="69" cy="52" r="3" fill="#aafcff" className="building-core" />
      <g className="building-rotor" transform="translate(94 38)">
        <circle r="6" fill="#d5be83" stroke="#fff0b2" strokeWidth="2" />
        <path d="M0 -5 L-8 -35 L4 -37 L5 -7 Z M5 0 L34 -10 L37 2 L8 6 Z M0 5 L8 35 L-4 37 L-5 7 Z M-5 0 L-34 10 L-37 -2 L-8 -6 Z" fill="#c9b47d" stroke="#f6e4ad" strokeWidth="2" />
      </g>
      <path d="M25 96 H112" stroke="#65cbbd" strokeWidth="3" strokeLinecap="round" className="building-rune-line" />
    </>
  );
}

function FarmArt({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#d7b16d" />
          <stop offset="1" stopColor="#573c27" />
        </linearGradient>
        <linearGradient id={`${id}-field`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#a7da72" />
          <stop offset="1" stopColor="#41693c" />
        </linearGradient>
      </defs>
      <path d="M28 92 L34 51 L94 51 L101 92 Z" fill={`url(#${id}-wood)`} stroke="#f0d69b" strokeWidth="3" />
      <path d="M28 53 L63 27 L101 53 Z" fill="#6f3d2f" stroke="#e7a77c" strokeWidth="3" />
      <rect x="55" y="66" width="18" height="26" rx="3" fill="#2b2118" stroke="#eacb8a" strokeWidth="2" />
      <path d="M18 100 C32 82 45 83 58 100 C72 82 88 82 115 100 Z" fill={`url(#${id}-field)`} stroke="#bfe98b" strokeWidth="2" />
      <g className="building-crops" stroke="#e8d16f" strokeWidth="3" strokeLinecap="round">
        <path d="M31 96 V76 M31 82 L24 76 M31 87 L39 80" />
        <path d="M48 98 V74 M48 81 L41 76 M48 87 L55 80" />
        <path d="M86 98 V73 M86 80 L79 75 M86 87 L94 79" />
        <path d="M103 98 V78 M103 85 L97 80 M103 90 L109 84" />
      </g>
      <circle cx="87" cy="49" r="7" fill="#1f3430" stroke="#79f3c9" strokeWidth="2" />
      <path d="M87 43 V55 M81 49 H93" stroke="#aaffdf" strokeWidth="2" className="building-core" />
    </>
  );
}

function TowerArt({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-tower`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#d7e4ef" />
          <stop offset="0.48" stopColor="#64788d" />
          <stop offset="1" stopColor="#26313d" />
        </linearGradient>
        <linearGradient id={`${id}-crystal`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#c9ffff" />
          <stop offset="0.55" stopColor="#5ed9ec" />
          <stop offset="1" stopColor="#4074be" />
        </linearGradient>
      </defs>
      <path d="M40 99 L46 40 H92 L99 99 Z" fill={`url(#${id}-tower)`} stroke="#dcecff" strokeWidth="3" />
      <path d="M40 44 L38 29 H51 V39 H63 V27 H76 V39 H89 V29 H101 L96 44 Z" fill="#46586c" stroke="#dcecff" strokeWidth="3" />
      <path d="M59 99 V74 Q69 61 80 74 V99" fill="#202933" stroke="#9bb5c9" strokeWidth="2" />
      <path d="M70 10 L82 30 L70 46 L58 30 Z" fill={`url(#${id}-crystal)`} stroke="#e5ffff" strokeWidth="3" className="building-crystal" />
      <circle cx="70" cy="63" r="10" fill="#182833" stroke="#75e8ee" strokeWidth="2" />
      <path d="M70 56 V70 M63 63 H77 M65 58 L75 68 M75 58 L65 68" stroke="#aaffff" strokeWidth="2" className="building-core" />
      <path d="M27 100 H112" stroke="#68d8e5" strokeWidth="3" strokeLinecap="round" className="building-rune-line" />
    </>
  );
}

export function FantasyBuildingSprite({
  type,
  state = "neutral",
  compact = false,
  label,
}: FantasyBuildingSpriteProps) {
  const safeId = `building-${type}`;
  const accessibleLabel = label ?? (type === "mill" ? "Moinho do Norte" : type === "farm" ? "Fazenda Arcana" : "Torre Rúnica");

  return (
    <span className={`fantasy-building-sprite building-${type} state-${state} ${compact ? "compact" : ""}`}>
      <span className="fantasy-building-shadow" aria-hidden="true" />
      <span className="fantasy-building-aura" aria-hidden="true" />
      <svg viewBox="0 0 140 120" role="img" aria-label={accessibleLabel}>
        {type === "mill" ? <MillArt id={safeId} /> : type === "farm" ? <FarmArt id={safeId} /> : <TowerArt id={safeId} />}
      </svg>
      <span className="fantasy-building-state" aria-hidden="true" />
    </span>
  );
}
