import { ProtocolError } from "./protocol.js";

export const CARD_CATALOG = Object.freeze({
  expansion: Object.freeze({
    id: "expansion", name: "Expansão Rúnica", kind: "macro", cost: 1, effect: "conquest",
    description: "Ergue uma aresta sem consumir a ação normal do turno.", icon: "⌁",
  }),
  fortify: Object.freeze({
    id: "fortify", name: "Fortaleza Octarina", kind: "macro", cost: 1, effect: "fortify", value: 3,
    description: "Concede 3 HP a uma província aliada e pode transformá-la em fortaleza.", icon: "⬢",
  }),
  duel: Object.freeze({
    id: "duel", name: "Convocar Duelo", kind: "macro", cost: 1, effect: "duel",
    description: "Desafia uma província inimiga para um Duelo de Célula.", icon: "⚔",
  }),
  strike: Object.freeze({
    id: "strike", name: "Golpe Rúnico", kind: "duel", cost: 1, effect: "attack", value: 2, element: "physical",
    description: "Causa 2 de dano físico.", icon: "✦",
  }),
  shield: Object.freeze({
    id: "shield", name: "Égide de Pedra", kind: "duel", cost: 1, effect: "shield", value: 2,
    description: "Absorve os próximos 2 pontos de dano.", icon: "◆",
  }),
  wet: Object.freeze({
    id: "wet", name: "Maré Rúnica", kind: "duel", cost: 1, effect: "status", status: "wet", duration: 2, element: "water",
    description: "Aplica Molhado por 2 rodadas e prepara o combo elétrico.", icon: "≈",
  }),
  lightning: Object.freeze({
    id: "lightning", name: "Raio Encadeado", kind: "duel", cost: 2, effect: "attack", value: 3, element: "electric",
    description: "Causa 3 de dano; causa o dobro contra um alvo Molhado.", icon: "ϟ",
  }),
  heal: Object.freeze({
    id: "heal", name: "Cura Alquímica", kind: "duel", cost: 1, effect: "heal", value: 2,
    description: "Recupera até 2 HP do combatente.", icon: "+",
  }),
  "kael-golpe-runico": Object.freeze({
    id: "kael-golpe-runico", name: "Golpe Rúnico", kind: "duel", unitRole: "guardian", cost: 1,
    effect: "attack", value: 4, element: "physical", description: "Kael rompe a guarda frontal com uma lâmina rúnica.", icon: "⚔",
  }),
  "kael-guardiao-celeste": Object.freeze({
    id: "kael-guardiao-celeste", name: "Guardião Celeste", kind: "duel", unitRole: "guardian", cost: 1,
    effect: "shield", value: 5, element: "light", description: "Ergue um selo de proteção de alta resistência.", icon: "🛡",
  }),
  "kael-contra-selo": Object.freeze({
    id: "kael-contra-selo", name: "Contra-Selo", kind: "duel", unitRole: "guardian", cost: 2,
    effect: "attack", value: 4, element: "octarina", description: "Converte a defesa acumulada em um contra-ataque octarino.", icon: "✦",
  }),
  "kael-muralha-astral": Object.freeze({
    id: "kael-muralha-astral", name: "Muralha Astral", kind: "duel", unitRole: "guardian", cost: 2,
    effect: "shield", value: 8, element: "light", description: "Materializa uma muralha cabalística quase impenetrável.", icon: "⬡",
  }),
  "lyra-flecha-eter": Object.freeze({
    id: "lyra-flecha-eter", name: "Flecha do Éter", kind: "duel", unitRole: "archer", cost: 1,
    effect: "attack", value: 4, element: "air", description: "Disparo veloz que atravessa a primeira abertura da guarda.", icon: "➶",
  }),
  "lyra-passo-lunar": Object.freeze({
    id: "lyra-passo-lunar", name: "Passo Lunar", kind: "duel", unitRole: "archer", cost: 1,
    effect: "shield", value: 4, element: "moon", description: "Lyra evita o ataque previsível ao reposicionar-se entre sombras.", icon: "☾",
  }),
  "lyra-marca-cacada": Object.freeze({
    id: "lyra-marca-cacada", name: "Marca da Caçada", kind: "duel", unitRole: "archer", cost: 2,
    effect: "attack", value: 6, element: "ether", description: "Marca um ponto vital e concentra o disparo seguinte.", icon: "◎",
  }),
  "lyra-chuva-prismatica": Object.freeze({
    id: "lyra-chuva-prismatica", name: "Chuva Prismática", kind: "duel", unitRole: "archer", cost: 3,
    effect: "attack", value: 8, element: "octarina", description: "Fragmenta uma flecha em múltiplos projéteis elementais.", icon: "✧",
  }),
});

export const FIXED_TACTIC_IDS = Object.freeze(["expansion", "fortify", "duel"]);
export const PLAYER_LOADOUT_CARD_IDS = Object.freeze([
  "kael-golpe-runico", "kael-guardiao-celeste", "kael-contra-selo", "kael-muralha-astral",
  "lyra-flecha-eter", "lyra-passo-lunar", "lyra-marca-cacada", "lyra-chuva-prismatica",
]);
export const DEFAULT_PLAYER_LOADOUT = Object.freeze([
  "kael-golpe-runico", "kael-golpe-runico", "kael-guardiao-celeste", "lyra-flecha-eter", "lyra-flecha-eter",
]);

export const STARTER_HAND = Object.freeze([
  "expansion", "fortify", "duel", "strike", "shield", "wet", "lightning", "heal",
]);

export function getCard(cardId) {
  const card = CARD_CATALOG[cardId];
  if (!card) throw new ProtocolError("UNKNOWN_CARD", `unknown card: ${cardId}`);
  return card;
}

export function buildPlayerHand(loadout = undefined) {
  if (loadout === undefined || loadout === null) return [...STARTER_HAND];
  if (!Array.isArray(loadout) || loadout.length !== 5) {
    throw new ProtocolError("INVALID_LOADOUT", "loadout must contain exactly 5 combat cards");
  }
  const counts = new Map();
  let totalCost = 0;
  let guardians = 0;
  let archers = 0;
  for (const rawId of loadout) {
    const cardId = String(rawId);
    if (!PLAYER_LOADOUT_CARD_IDS.includes(cardId)) {
      throw new ProtocolError("INVALID_LOADOUT_CARD", `card is not available for player loadouts: ${cardId}`);
    }
    const amount = (counts.get(cardId) ?? 0) + 1;
    if (amount > 2) throw new ProtocolError("INVALID_LOADOUT_COPIES", `loadout contains too many copies of ${cardId}`);
    counts.set(cardId, amount);
    const card = getCard(cardId);
    totalCost += card.cost;
    if (card.unitRole === "guardian") guardians += 1;
    if (card.unitRole === "archer") archers += 1;
  }
  if (totalCost > 9) throw new ProtocolError("INVALID_LOADOUT_COST", "loadout energy cost must not exceed 9");
  if (guardians < 2 || archers < 2) {
    throw new ProtocolError("INVALID_LOADOUT_ROLES", "loadout requires at least 2 guardian and 2 archer cards");
  }
  return [...FIXED_TACTIC_IDS, ...loadout.map(String)];
}

export function cardSnapshot(cardId) {
  const card = getCard(cardId);
  return {
    ...card,
    effect: card.id === "expansion" ? "expansion" : card.effect,
  };
}

export function totalCardCost(cardIds) {
  return cardIds.reduce((total, cardId) => total + getCard(cardId).cost, 0);
}

export function countCards(cardIds) {
  const counts = new Map();
  for (const cardId of cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  return counts;
}

export function handContains(hand, cardIds) {
  const available = countCards(hand);
  for (const [cardId, amount] of countCards(cardIds)) {
    if ((available.get(cardId) ?? 0) < amount) return false;
  }
  return true;
}

export function removeCards(hand, cardIds) {
  const next = [...hand];
  for (const cardId of cardIds) {
    const index = next.indexOf(cardId);
    if (index < 0) throw new ProtocolError("CARD_NOT_IN_HAND", `card is not in hand: ${cardId}`);
    next.splice(index, 1);
  }
  return next;
}
