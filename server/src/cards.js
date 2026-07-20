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
});

export const STARTER_HAND = Object.freeze([
  "expansion",
  "fortify",
  "duel",
  "strike",
  "shield",
  "wet",
  "lightning",
  "heal",
]);

export function getCard(cardId) {
  const card = CARD_CATALOG[cardId];
  if (!card) throw new ProtocolError("UNKNOWN_CARD", `unknown card: ${cardId}`);
  return card;
}

export function cardSnapshot(cardId) {
  const card = getCard(cardId);
  return {
    ...card,
    // The rules engine keeps the canonical "conquest" effect; clients use the
    // product-facing "expansion" action to arm point selection.
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
