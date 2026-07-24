export type Faction = "player" | "enemy";
export type Terrain = "grass" | "forest" | "river" | "bridge" | "ruins" | "mill" | "village" | "mountain";
export type UnitRole = "guardian" | "archer" | "raider";
export type CardRarity = "common" | "rare" | "epic" | "legendary";

export interface LivingTile {
  id: string;
  x: number;
  y: number;
  terrain: Terrain;
  resource?: "wood" | "food" | "crystal";
  resourceAmount?: number;
  landmark?: string;
}

export interface LivingUnit {
  id: string;
  name: string;
  title: string;
  role: UnitRole;
  faction: Faction;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  element: string;
  level: number;
  deck: string[];
  active: boolean;
  defeated?: boolean;
}

export interface TcgCard {
  id: string;
  name: string;
  unitRole: UnitRole;
  rarity: CardRarity;
  element: string;
  cost: number;
  attack: number;
  defense: number;
  speed: number;
  art: string;
  arcana: string;
  description: string;
  flavor: string;
  keywords: string[];
}

export interface CombatRoundResult {
  playerDamage: number;
  enemyDamage: number;
  playerShield: number;
  enemyShield: number;
  playerTotal: number;
  enemyTotal: number;
  log: string[];
}

export const LIVING_BOARD_SIZE = 7;

export const TCG_CARDS: Record<string, TcgCard> = {
  "kael-golpe-runico": {
    id: "kael-golpe-runico",
    name: "Golpe Rúnico",
    unitRole: "guardian",
    rarity: "common",
    element: "Terra",
    cost: 1,
    attack: 4,
    defense: 1,
    speed: 1,
    art: "⚔",
    arcana: "IV",
    description: "Kael concentra a runa da lâmina e rompe a guarda frontal.",
    flavor: "A pedra recorda cada juramento.",
    keywords: ["Corpo a corpo", "Ruptura"],
  },
  "kael-guardiao-celeste": {
    id: "kael-guardiao-celeste",
    name: "Guardião Celeste",
    unitRole: "guardian",
    rarity: "rare",
    element: "Luz",
    cost: 1,
    attack: 1,
    defense: 5,
    speed: 1,
    art: "🛡",
    arcana: "VII",
    description: "Ergue um selo de proteção. Ganha defesa elevada nesta rodada.",
    flavor: "Nenhuma ponte cai enquanto Kael permanecer de pé.",
    keywords: ["Bloqueio", "Sentinela"],
  },
  "kael-contra-selo": {
    id: "kael-contra-selo",
    name: "Contra-Selo",
    unitRole: "guardian",
    rarity: "epic",
    element: "Octarina",
    cost: 2,
    attack: 4,
    defense: 4,
    speed: 2,
    art: "✦",
    arcana: "XII",
    description: "Converte parte do impacto bloqueado em um contra-ataque octarino.",
    flavor: "A defesa perfeita já contém o golpe seguinte.",
    keywords: ["Contra-ataque", "Octarina"],
  },
  "kael-muralha-astral": {
    id: "kael-muralha-astral",
    name: "Muralha Astral",
    unitRole: "guardian",
    rarity: "legendary",
    element: "Luz",
    cost: 2,
    attack: 0,
    defense: 8,
    speed: 0,
    art: "⬡",
    arcana: "XXI",
    description: "Materializa uma muralha cabalística que anula quase todo o dano recebido.",
    flavor: "Sete círculos. Sete nomes. Uma única passagem.",
    keywords: ["Barreira", "Círculo cabalístico"],
  },
  "lyra-flecha-eter": {
    id: "lyra-flecha-eter",
    name: "Flecha do Éter",
    unitRole: "archer",
    rarity: "common",
    element: "Ar",
    cost: 1,
    attack: 4,
    defense: 1,
    speed: 4,
    art: "➶",
    arcana: "III",
    description: "Disparo veloz que recebe prioridade na ordem de iniciativa.",
    flavor: "O vento aponta antes que os olhos encontrem o alvo.",
    keywords: ["Distância", "Rápida"],
  },
  "lyra-passo-lunar": {
    id: "lyra-passo-lunar",
    name: "Passo Lunar",
    unitRole: "archer",
    rarity: "rare",
    element: "Lua",
    cost: 1,
    attack: 2,
    defense: 4,
    speed: 5,
    art: "☾",
    arcana: "IX",
    description: "Lyra reposiciona-se entre sombras, evitando o ataque mais previsível.",
    flavor: "Nem toda retirada abandona o campo.",
    keywords: ["Evasão", "Reposicionamento"],
  },
  "lyra-marca-cacada": {
    id: "lyra-marca-cacada",
    name: "Marca da Caçada",
    unitRole: "archer",
    rarity: "epic",
    element: "Éter",
    cost: 2,
    attack: 6,
    defense: 2,
    speed: 3,
    art: "◎",
    arcana: "XV",
    description: "Marca o ponto vital do inimigo e aumenta a força do disparo.",
    flavor: "Quando a marca surge, o destino já escolheu um lado.",
    keywords: ["Precisão", "Marca"],
  },
  "lyra-chuva-prismatica": {
    id: "lyra-chuva-prismatica",
    name: "Chuva Prismática",
    unitRole: "archer",
    rarity: "legendary",
    element: "Octarina",
    cost: 3,
    attack: 8,
    defense: 1,
    speed: 3,
    art: "✧",
    arcana: "XIX",
    description: "Fragmenta uma flecha octarina em múltiplos projéteis elementais.",
    flavor: "Uma cor para cada futuro que o inimigo perdeu.",
    keywords: ["Rajada", "Octarina"],
  },
  "raider-machado": {
    id: "raider-machado",
    name: "Machado das Cinzas",
    unitRole: "raider",
    rarity: "common",
    element: "Fogo",
    cost: 1,
    attack: 4,
    defense: 1,
    speed: 2,
    art: "🪓",
    arcana: "II",
    description: "Golpe pesado dos saqueadores que ocupam a ponte.",
    flavor: "O ferro veio antes da pergunta.",
    keywords: ["Pesado"],
  },
  "raider-couro": {
    id: "raider-couro",
    name: "Couro Remendado",
    unitRole: "raider",
    rarity: "common",
    element: "Terra",
    cost: 1,
    attack: 1,
    defense: 4,
    speed: 1,
    art: "◈",
    arcana: "V",
    description: "Proteção improvisada com placas roubadas das ruínas.",
    flavor: "Feio, pesado e ainda assim suficiente.",
    keywords: ["Armadura"],
  },
  "raider-salto": {
    id: "raider-salto",
    name: "Salto Saqueador",
    unitRole: "raider",
    rarity: "rare",
    element: "Ar",
    cost: 2,
    attack: 5,
    defense: 2,
    speed: 4,
    art: "↯",
    arcana: "VIII",
    description: "Ataque impulsivo que atravessa a primeira linha de defesa.",
    flavor: "A ponte pertence a quem ousa pisar primeiro.",
    keywords: ["Investida", "Rápida"],
  },
};

export const INITIAL_LIVING_UNITS: LivingUnit[] = [
  {
    id: "kael",
    name: "Kael",
    title: "Guardião Rúnico",
    role: "guardian",
    faction: "player",
    x: 1,
    y: 5,
    hp: 18,
    maxHp: 18,
    attack: 4,
    defense: 4,
    speed: 2,
    element: "Terra",
    level: 1,
    deck: ["kael-golpe-runico", "kael-guardiao-celeste", "kael-contra-selo", "kael-muralha-astral"],
    active: true,
  },
  {
    id: "lyra",
    name: "Lyra",
    title: "Arqueira do Éter",
    role: "archer",
    faction: "player",
    x: 2,
    y: 3,
    hp: 14,
    maxHp: 14,
    attack: 5,
    defense: 2,
    speed: 5,
    element: "Ar",
    level: 1,
    deck: ["lyra-flecha-eter", "lyra-passo-lunar", "lyra-marca-cacada", "lyra-chuva-prismatica"],
    active: false,
  },
  {
    id: "raider-bridge",
    name: "Varg",
    title: "Saqueador da Ponte",
    role: "raider",
    faction: "enemy",
    x: 4,
    y: 3,
    hp: 12,
    maxHp: 12,
    attack: 4,
    defense: 2,
    speed: 3,
    element: "Fogo",
    level: 1,
    deck: ["raider-machado", "raider-couro", "raider-salto"],
    active: true,
  },
  {
    id: "raider-mill",
    name: "Brakk",
    title: "Capitão do Moinho",
    role: "raider",
    faction: "enemy",
    x: 5,
    y: 1,
    hp: 16,
    maxHp: 16,
    attack: 5,
    defense: 3,
    speed: 2,
    element: "Fogo",
    level: 2,
    deck: ["raider-machado", "raider-couro", "raider-salto"],
    active: true,
  },
];

export function tileId(x: number, y: number): string {
  return `${x},${y}`;
}

export function createLivingTiles(): LivingTile[] {
  const overrides = new Map<string, Partial<LivingTile>>();
  for (let y = 0; y < LIVING_BOARD_SIZE; y += 1) {
    overrides.set(tileId(3, y), { terrain: "river", landmark: "Rio das Cinzas" });
  }
  overrides.set(tileId(3, 3), { terrain: "bridge", landmark: "Ponte das Cinzas" });
  overrides.set(tileId(2, 3), { terrain: "ruins", resource: "crystal", resourceAmount: 1, landmark: "Ruínas do Observatório" });
  overrides.set(tileId(5, 1), { terrain: "mill", resource: "food", resourceAmount: 2, landmark: "Moinho do Norte" });
  overrides.set(tileId(0, 6), { terrain: "village", landmark: "Vila de Orun" });
  [[0, 4], [1, 4], [2, 4], [0, 5], [2, 5], [1, 6]].forEach(([x, y]) => {
    overrides.set(tileId(x, y), { terrain: "forest", resource: "wood", resourceAmount: 1, landmark: "Bosque Cinzento" });
  });
  [[5, 5], [6, 5], [5, 6], [6, 6], [6, 0]].forEach(([x, y]) => {
    overrides.set(tileId(x, y), { terrain: "mountain", landmark: "Escarpas de Ferro" });
  });

  return Array.from({ length: LIVING_BOARD_SIZE * LIVING_BOARD_SIZE }, (_, index) => {
    const x = index % LIVING_BOARD_SIZE;
    const y = Math.floor(index / LIVING_BOARD_SIZE);
    return {
      id: tileId(x, y),
      x,
      y,
      terrain: "grass" as Terrain,
      ...overrides.get(tileId(x, y)),
    };
  });
}

export function orthogonalDistance(left: Pick<LivingUnit, "x" | "y">, right: Pick<LivingUnit, "x" | "y">): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

export function adjacentPositions(x: number, y: number): Array<{ x: number; y: number }> {
  return [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ].filter((point) => point.x >= 0 && point.y >= 0 && point.x < LIVING_BOARD_SIZE && point.y < LIVING_BOARD_SIZE);
}

export function isPassableTerrain(terrain: Terrain): boolean {
  return terrain !== "river" && terrain !== "mountain";
}

export function selectedEnergy(cardIds: string[]): number {
  return cardIds.reduce((total, cardId) => total + (TCG_CARDS[cardId]?.cost ?? 0), 0);
}

export function resolveCombatRound(
  player: LivingUnit,
  enemy: LivingUnit,
  playerCardIds: string[],
  enemyCardIds: string[],
): CombatRoundResult {
  const playerCards = playerCardIds.map((id) => TCG_CARDS[id]).filter(Boolean);
  const enemyCards = enemyCardIds.map((id) => TCG_CARDS[id]).filter(Boolean);
  const playerAttack = player.attack + playerCards.reduce((sum, card) => sum + card.attack, 0);
  const playerShield = player.defense + playerCards.reduce((sum, card) => sum + card.defense, 0);
  const enemyAttack = enemy.attack + enemyCards.reduce((sum, card) => sum + card.attack, 0);
  const enemyShield = enemy.defense + enemyCards.reduce((sum, card) => sum + card.defense, 0);
  const playerSpeed = player.speed + playerCards.reduce((sum, card) => sum + card.speed, 0);
  const enemySpeed = enemy.speed + enemyCards.reduce((sum, card) => sum + card.speed, 0);
  const playerDamage = Math.max(1, playerAttack - Math.floor(enemyShield * 0.55));
  const enemyDamage = Math.max(1, enemyAttack - Math.floor(playerShield * 0.55));

  return {
    playerDamage,
    enemyDamage,
    playerShield,
    enemyShield,
    playerTotal: playerAttack + playerShield + playerSpeed,
    enemyTotal: enemyAttack + enemyShield + enemySpeed,
    log: [
      `${player.name} combina ${playerCards.map((card) => card.name).join(" + ") || "ataque básico"}.`,
      `${enemy.name} responde com ${enemyCards.map((card) => card.name).join(" + ") || "ataque básico"}.`,
      playerSpeed >= enemySpeed ? `${player.name} conquista a iniciativa.` : `${enemy.name} conquista a iniciativa.`,
    ],
  };
}

export function chooseEnemyCards(unit: LivingUnit, round: number): string[] {
  const affordable = unit.deck.filter((id) => (TCG_CARDS[id]?.cost ?? 99) <= 2);
  if (affordable.length === 0) return [];
  return [affordable[round % affordable.length]];
}
