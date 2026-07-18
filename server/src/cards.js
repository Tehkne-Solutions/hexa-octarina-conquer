export const CARD_CATALOG = Object.freeze({
  expansion: Object.freeze({ id: "expansion", name: "Expansão Rúnica", kind: "macro", cost: 1, effect: "conquest" }),
  fortify: Object.freeze({ id: "fortify", name: "Fortaleza Octarina", kind: "macro", cost: 1, effect: "fortify", value: 3 }),
  duel: Object.freeze({ id: "duel", name: "Convocar Duelo", kind: "macro", cost: 1, effect: "duel" }),
  strike: Object.freeze({ id: "strike", name: "Golpe Rúnico", kind: "duel", cost: 1, effect: "attack", value: 2, element: "physical" }),
  shield: Object.freeze({ id: "shield", name: "Égide de Pedra", kind: "duel", cost: 1, effect: "shield", value: 2 }),
  wet: Object.freeze({ id: "wet", name: "Maré Rúnica", kind: "duel", cost: 1, effect: "status", status: "wet", duration: 2, element: "water" }),
  lightning: Object.freeze({ id: "lightning", name: "Raio Encadeado", kind: "duel", cost: 2, effect: "attack", value: 3, element: "electric" }),
  heal: Object.freeze({ id: "heal", name: "Cura Alquímica", kind: "duel", cost: 1, effect: "heal", value: 2 }),
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
  if (!card) throw new Error(`unknown card: ${cardId}`);
  return card;
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
    if (index < 0) throw new Error(`card is not in hand: ${cardId}`);
    next.splice(index, 1);
  }
  return next;
}
