const MAX_SELECTED_CARDS = 3;
const HAND_SIZE = 5;
const BASE_STARTING_ENERGY = 6;
const MAX_ENERGY = 8;

export const HOC2_CARDS = Object.freeze({
  "precise-strike": { id: "precise-strike", name: "Precise Strike", owner: "kael", type: "attack", cost: 2, priority: 5, damage: 6, tags: ["attack"], requires: ["opening"] },
  "shield-wall": { id: "shield-wall", name: "Shield Wall", owner: "kael", type: "defense", cost: 2, priority: 8, shield: 5, tags: ["guard"] },
  feint: { id: "feint", name: "Feint", owner: "kael", type: "tactic", cost: 1, priority: 9, applyStatus: "exposed", tags: ["opening"] },
  counterattack: { id: "counterattack", name: "Counterattack", owner: "kael", type: "attack", cost: 2, priority: 6, damage: 4, tags: ["counter"], bonusIfOwnStatus: "guarded", bonusDamage: 4 },
  "arrow-volley": { id: "arrow-volley", name: "Arrow Volley", owner: "kael", type: "formation", cost: 3, priority: 4, damage: 5, armyDamage: 4, requiresUnit: "archers", tags: ["ranged"] },
  "cavalry-charge": { id: "cavalry-charge", name: "Cavalry Charge", owner: "kael", type: "formation", cost: 4, priority: 2, damage: 7, armyDamage: 5, requiresUnit: "cavalry", tags: ["charge"] },
  rally: { id: "rally", name: "Rally", owner: "kael", type: "hero", cost: 2, priority: 7, heal: 3, armyHeal: 4, applyOwnStatus: "inspired", tags: ["control"] },
  "octarina-guard": { id: "octarina-guard", name: "Octarina Guard", owner: "kael", type: "octarina", cost: 3, priority: 10, shield: 7, applyOwnStatus: "guarded", tags: ["octarina", "guard"] },
  "heavy-blow": { id: "heavy-blow", name: "Heavy Blow", owner: "brakk", type: "attack", cost: 2, priority: 4, damage: 7, tags: ["attack"] },
  "brutal-charge": { id: "brutal-charge", name: "Brutal Charge", owner: "brakk", type: "attack", cost: 4, priority: 2, damage: 8, armyDamage: 4, tags: ["charge"] },
  "iron-guard": { id: "iron-guard", name: "Iron Guard", owner: "brakk", type: "defense", cost: 2, priority: 8, shield: 6, applyOwnStatus: "guarded", tags: ["guard"] },
  roar: { id: "roar", name: "Roar", owner: "brakk", type: "tactic", cost: 1, priority: 9, applyOwnStatus: "inspired", applyStatus: "staggered", tags: ["control", "opening"] },
  "break-formation": { id: "break-formation", name: "Break Formation", owner: "brakk", type: "tactic", cost: 2, priority: 7, applyStatus: "exposed", armyDamage: 3, tags: ["control"] },
  "savage-counter": { id: "savage-counter", name: "Savage Counter", owner: "brakk", type: "attack", cost: 2, priority: 6, damage: 4, tags: ["counter"], bonusIfOwnStatus: "guarded", bonusDamage: 4 },
  "blood-rush": { id: "blood-rush", name: "Blood Rush", owner: "brakk", type: "hero", cost: 3, priority: 5, damage: 5, heal: 2, tags: ["attack"] },
  "octarina-rupture": { id: "octarina-rupture", name: "Octarina Rupture", owner: "brakk", type: "octarina", cost: 3, priority: 10, damage: 4, applyStatus: "staggered", tags: ["octarina", "control"] },
});

export const KAEL_DECK = Object.freeze(["feint", "precise-strike", "shield-wall", "counterattack", "arrow-volley", "cavalry-charge", "rally", "octarina-guard", "precise-strike", "shield-wall", "arrow-volley", "rally"]);
export const BRAKK_DECK = Object.freeze(["roar", "heavy-blow", "iron-guard", "brutal-charge", "break-formation", "savage-counter", "blood-rush", "octarina-rupture", "heavy-blow", "iron-guard", "break-formation", "brutal-charge"]);

function cloneCombatant(input) {
  return {
    id: input.id,
    commander: input.commander,
    hp: input.hp ?? 24,
    maxHp: input.maxHp ?? input.hp ?? 24,
    armyStrength: input.armyStrength ?? 30,
    maxArmyStrength: input.maxArmyStrength ?? input.armyStrength ?? 30,
    shield: input.shield ?? 0,
    energy: input.energy ?? BASE_STARTING_ENERGY,
    maxEnergy: input.maxEnergy ?? MAX_ENERGY,
    statuses: { ...(input.statuses ?? {}) },
    units: [...(input.units ?? [])],
  };
}

function draw(deck, count = HAND_SIZE) {
  return deck.slice(0, count);
}

export function createCardCombat({ id, attacker, defender, terrain = "plain", attackerRetreatHexes = [], defenderRetreatHexes = [], octarinaResonance = {} }) {
  const attackerState = cloneCombatant({ ...attacker, energy: (attacker.energy ?? BASE_STARTING_ENERGY) + (octarinaResonance[attacker.id] ? 1 : 0) });
  const defenderState = cloneCombatant({ ...defender, energy: (defender.energy ?? BASE_STARTING_ENERGY) + (octarinaResonance[defender.id] ? 1 : 0) });
  attackerState.energy = Math.min(attackerState.maxEnergy, attackerState.energy);
  defenderState.energy = Math.min(defenderState.maxEnergy, defenderState.energy);
  const attackerDeck = attacker.deck ?? KAEL_DECK;
  const defenderDeck = defender.deck ?? BRAKK_DECK;
  return {
    id,
    status: "select",
    round: 1,
    terrain,
    attackerId: attacker.id,
    defenderId: defender.id,
    combatants: { [attacker.id]: attackerState, [defender.id]: defenderState },
    decks: { [attacker.id]: [...attackerDeck], [defender.id]: [...defenderDeck] },
    hands: { [attacker.id]: draw(attackerDeck), [defender.id]: draw(defenderDeck) },
    discard: { [attacker.id]: [], [defender.id]: [] },
    submissions: {},
    intents: { [attacker.id]: "TACTICAL", [defender.id]: "AGGRESSIVE" },
    retreatHexes: { [attacker.id]: [...attackerRetreatHexes], [defender.id]: [...defenderRetreatHexes] },
    winnerId: null,
    loserId: null,
    resultReason: null,
    log: [],
  };
}

function cardFor(id) {
  const card = HOC2_CARDS[id];
  if (!card) throw new Error(`unknown HOC2 card: ${id}`);
  return card;
}

function validateSequence(combat, playerId, cardIds) {
  if (!Array.isArray(cardIds) || cardIds.length < 1 || cardIds.length > MAX_SELECTED_CARDS) throw new Error("select between 1 and 3 cards");
  if (combat.submissions[playerId]) throw new Error("player already committed this round");
  const hand = combat.hands[playerId] ?? [];
  const available = [...hand];
  let total = 0;
  for (const id of cardIds) {
    const index = available.indexOf(id);
    if (index === -1) throw new Error(`card ${id} is not available in hand`);
    available.splice(index, 1);
    const card = cardFor(id);
    const state = combat.combatants[playerId];
    if (card.requiresUnit && !state.units.includes(card.requiresUnit)) throw new Error(`card ${id} requires unit ${card.requiresUnit}`);
    total += card.cost;
  }
  if (total > combat.combatants[playerId].energy) throw new Error("not enough combat energy");
  return total;
}

export function submitCardSequence(combat, playerId, cardIds) {
  if (combat.status === "resolved") throw new Error("combat already resolved");
  if (!combat.combatants[playerId]) throw new Error("player is not part of this combat");
  const cost = validateSequence(combat, playerId, cardIds);
  combat.submissions[playerId] = [...cardIds];
  combat.combatants[playerId].energy -= cost;
  combat.hands[playerId] = combat.hands[playerId].filter((id, index, hand) => {
    const usedBefore = cardIds.slice(0, cardIds.indexOf(id) + 1).filter((item) => item === id).length;
    const seen = hand.slice(0, index + 1).filter((item) => item === id).length;
    return seen > usedBefore || !cardIds.includes(id);
  });
  combat.status = Object.keys(combat.submissions).length === 2 ? "commit" : "select";
  return combat.status === "commit";
}

function applyDamage(target, amount) {
  const blocked = Math.min(target.shield, amount);
  target.shield -= blocked;
  const actual = Math.max(0, amount - blocked);
  target.hp = Math.max(0, target.hp - actual);
  return { blocked, actual };
}

function hasEarlierTag(sequence, index, tag) {
  return sequence.slice(0, index).some((id) => cardFor(id).tags?.includes(tag));
}

function actionEntries(combat) {
  const entries = [];
  for (const playerId of [combat.attackerId, combat.defenderId]) {
    const opponentId = playerId === combat.attackerId ? combat.defenderId : combat.attackerId;
    const sequence = combat.submissions[playerId] ?? [];
    sequence.forEach((cardId, index) => {
      const card = cardFor(cardId);
      entries.push({ playerId, opponentId, cardId, card, sequenceIndex: index, comboOpening: hasEarlierTag(sequence, index, "opening") });
    });
  }
  return entries.sort((a, b) => b.card.priority - a.card.priority || a.sequenceIndex - b.sequenceIndex || a.playerId.localeCompare(b.playerId));
}

function applyAction(combat, entry) {
  const actor = combat.combatants[entry.playerId];
  const target = combat.combatants[entry.opponentId];
  if (actor.hp <= 0 || actor.armyStrength <= 0) return;
  const card = entry.card;
  if (card.shield) actor.shield += card.shield;
  if (card.heal) actor.hp = Math.min(actor.maxHp, actor.hp + card.heal);
  if (card.armyHeal) actor.armyStrength = Math.min(actor.maxArmyStrength, actor.armyStrength + card.armyHeal);
  if (card.applyOwnStatus) actor.statuses[card.applyOwnStatus] = 1;
  if (card.applyStatus) target.statuses[card.applyStatus] = 1;
  let damage = card.damage ?? 0;
  if (entry.comboOpening && card.requires?.includes("opening")) damage += 4;
  if (card.bonusIfOwnStatus && actor.statuses[card.bonusIfOwnStatus]) damage += card.bonusDamage ?? 0;
  const hit = damage ? applyDamage(target, damage) : { blocked: 0, actual: 0 };
  if (card.armyDamage) target.armyStrength = Math.max(0, target.armyStrength - card.armyDamage);
  combat.log.push({ round: combat.round, actorId: entry.playerId, cardId: entry.cardId, priority: card.priority, damage: hit.actual, blocked: hit.blocked, armyDamage: card.armyDamage ?? 0, combo: Boolean(entry.comboOpening && card.requires?.includes("opening")) });
}

function decideOutcome(combat) {
  const attacker = combat.combatants[combat.attackerId];
  const defender = combat.combatants[combat.defenderId];
  const attackerDown = attacker.hp <= 0 || attacker.armyStrength <= 0;
  const defenderDown = defender.hp <= 0 || defender.armyStrength <= 0;
  if (!attackerDown && !defenderDown) return false;
  combat.status = "resolved";
  if (attackerDown && defenderDown) {
    combat.winnerId = combat.defenderId;
    combat.loserId = combat.attackerId;
  } else {
    combat.winnerId = attackerDown ? combat.defenderId : combat.attackerId;
    combat.loserId = attackerDown ? combat.attackerId : combat.defenderId;
  }
  combat.resultReason = combat.combatants[combat.loserId].hp <= 0 ? "commander-defeated" : "army-broken";
  return true;
}

function refillHand(combat, playerId) {
  while (combat.hands[playerId].length < HAND_SIZE && combat.decks[playerId].length > 0) {
    combat.hands[playerId].push(combat.decks[playerId].shift());
  }
}

export function resolveCardCombatRound(combat) {
  if (combat.status !== "commit") throw new Error("both players must commit before resolution");
  combat.status = "resolve";
  for (const entry of actionEntries(combat)) applyAction(combat, entry);
  for (const playerId of [combat.attackerId, combat.defenderId]) {
    combat.discard[playerId].push(...(combat.submissions[playerId] ?? []));
  }
  combat.submissions = {};
  if (decideOutcome(combat)) return combatResult(combat);
  combat.round += 1;
  combat.status = "select";
  for (const playerId of [combat.attackerId, combat.defenderId]) {
    const actor = combat.combatants[playerId];
    actor.energy = Math.min(actor.maxEnergy, actor.energy + 2);
    actor.shield = 0;
    actor.statuses = Object.fromEntries(Object.entries(actor.statuses).filter(([, duration]) => duration > 1).map(([key, duration]) => [key, duration - 1]));
    refillHand(combat, playerId);
  }
  return combatResult(combat);
}

export function requestRetreat(combat, playerId) {
  if (combat.status === "resolved") throw new Error("combat already resolved");
  const retreatHexes = combat.retreatHexes[playerId] ?? [];
  if (!retreatHexes.length) return { accepted: false, reason: "surrounded" };
  const opponentId = playerId === combat.attackerId ? combat.defenderId : combat.attackerId;
  combat.status = "resolved";
  combat.winnerId = opponentId;
  combat.loserId = playerId;
  combat.resultReason = "retreat";
  return { accepted: true, retreatHex: retreatHexes[0], ...combatResult(combat) };
}

export function combatResult(combat) {
  return {
    id: combat.id,
    status: combat.status,
    round: combat.round,
    winnerId: combat.winnerId,
    loserId: combat.loserId,
    resultReason: combat.resultReason,
    terrain: combat.terrain,
    intents: { ...combat.intents },
    combatants: Object.fromEntries(Object.entries(combat.combatants).map(([id, value]) => [id, { ...value, statuses: { ...value.statuses }, units: [...value.units] }])),
    hands: Object.fromEntries(Object.entries(combat.hands).map(([id, hand]) => [id, [...hand]])),
    retreatAvailable: Object.fromEntries(Object.keys(combat.combatants).map((id) => [id, (combat.retreatHexes[id]?.length ?? 0) > 0])),
    log: combat.log.slice(-24),
  };
}
