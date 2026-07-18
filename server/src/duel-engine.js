import { getCard, handContains, removeCards, totalCardCost } from "./cards.js";
import { ProtocolError } from "./protocol.js";

function applyDamage(target, amount) {
  const absorbed = Math.min(target.shield, amount);
  target.shield -= absorbed;
  const actual = Math.max(0, amount - absorbed);
  target.hp = Math.max(0, target.hp - actual);
  return { absorbed, actual };
}

function applyCards(actor, target, cardIds) {
  const log = [];
  for (const cardId of cardIds) {
    const card = getCard(cardId);
    if (card.kind !== "duel") {
      throw new ProtocolError("INVALID_DUEL_CARD", `${cardId} is not a duel card`);
    }

    if (card.effect === "shield") {
      actor.shield += card.value;
      log.push({ actorId: actor.playerId, cardId, effect: "shield", value: card.value });
      continue;
    }

    if (card.effect === "heal") {
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, actor.hp + card.value);
      log.push({ actorId: actor.playerId, cardId, effect: "heal", value: actor.hp - before });
      continue;
    }

    if (card.effect === "status") {
      target.statuses[card.status] = Math.max(target.statuses[card.status] ?? 0, card.duration ?? 1);
      log.push({ actorId: actor.playerId, cardId, effect: "status", status: card.status });
      continue;
    }

    if (card.effect === "attack") {
      let damage = card.value;
      if (card.element === "electric" && (target.statuses.wet ?? 0) > 0) damage *= 2;
      const result = applyDamage(target, damage);
      log.push({ actorId: actor.playerId, cardId, effect: "attack", damage: result.actual, absorbed: result.absorbed });
      continue;
    }
  }
  return log;
}

function tickStatuses(combatant) {
  for (const [status, duration] of Object.entries(combatant.statuses)) {
    if (duration <= 1) delete combatant.statuses[status];
    else combatant.statuses[status] = duration - 1;
  }
}

export function createDuel({ id, attackerId, defenderId, provinceId }) {
  return {
    id,
    attackerId,
    defenderId,
    provinceId,
    status: "pending",
    round: 1,
    winnerId: null,
    submissions: {},
    combatants: {
      [attackerId]: { playerId: attackerId, hp: 8, maxHp: 8, shield: 0, energy: 3, statuses: {} },
      [defenderId]: { playerId: defenderId, hp: 5, maxHp: 5, shield: 0, energy: 3, statuses: {} },
    },
    log: [],
  };
}

export function submitDuelCards({ duel, player, cardIds }) {
  if (duel.status === "resolved") throw new ProtocolError("DUEL_RESOLVED", "duel is already resolved");
  if (![duel.attackerId, duel.defenderId].includes(player.id)) {
    throw new ProtocolError("NOT_DUEL_PARTICIPANT", "player does not participate in this duel");
  }
  if (duel.submissions[player.id]) {
    throw new ProtocolError("DUPLICATE_SUBMISSION", "player already submitted this round");
  }
  if (!handContains(player.hand, cardIds)) {
    throw new ProtocolError("CARD_NOT_IN_HAND", "one or more duel cards are unavailable");
  }
  for (const cardId of cardIds) {
    if (getCard(cardId).kind !== "duel") {
      throw new ProtocolError("INVALID_DUEL_CARD", `${cardId} cannot be used in a duel`);
    }
  }

  const combatant = duel.combatants[player.id];
  const cost = totalCardCost(cardIds);
  if (cost > combatant.energy) {
    throw new ProtocolError("NOT_ENOUGH_DUEL_ENERGY", "duel card sequence exceeds available energy", {
      available: combatant.energy,
      required: cost,
    });
  }

  player.hand = removeCards(player.hand, cardIds);
  combatant.energy -= cost;
  duel.submissions[player.id] = [...cardIds];
  duel.status = "active";
  return Object.keys(duel.submissions).length === 2;
}

export function resolveDuelRound(duel) {
  const attacker = duel.combatants[duel.attackerId];
  const defender = duel.combatants[duel.defenderId];
  const attackerCards = duel.submissions[duel.attackerId] ?? [];
  const defenderCards = duel.submissions[duel.defenderId] ?? [];

  duel.log.push(...applyCards(attacker, defender, attackerCards));
  if (defender.hp > 0) duel.log.push(...applyCards(defender, attacker, defenderCards));

  tickStatuses(attacker);
  tickStatuses(defender);
  duel.submissions = {};

  if (attacker.hp <= 0 || defender.hp <= 0) {
    duel.status = "resolved";
    duel.winnerId = defender.hp <= 0 ? duel.attackerId : duel.defenderId;
    if (attacker.hp <= 0 && defender.hp <= 0) duel.winnerId = duel.defenderId;
    return { resolved: true, winnerId: duel.winnerId };
  }

  duel.round += 1;
  attacker.energy = Math.min(7, attacker.energy + 1);
  defender.energy = Math.min(7, defender.energy + 1);
  return { resolved: false, winnerId: null };
}

export function duelSnapshot(duel) {
  return {
    id: duel.id,
    attackerId: duel.attackerId,
    defenderId: duel.defenderId,
    provinceId: duel.provinceId,
    status: duel.status,
    round: duel.round,
    winnerId: duel.winnerId,
    submittedPlayerIds: Object.keys(duel.submissions),
    combatants: Object.fromEntries(Object.entries(duel.combatants).map(([id, state]) => [id, {
      hp: state.hp,
      maxHp: state.maxHp,
      shield: state.shield,
      energy: state.energy,
      statuses: { ...state.statuses },
    }])),
    log: duel.log.slice(-20),
  };
}
