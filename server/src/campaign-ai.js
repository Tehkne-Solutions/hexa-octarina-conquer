import { getCard } from "./cards.js";

function canonicalEdge(start, end) {
  return [start, end]
    .sort((left, right) => left[0] - right[0] || left[1] - right[1])
    .map(([x, y]) => `${x},${y}`)
    .join("|");
}

function requiredEdges([x, y]) {
  return [
    canonicalEdge([x, y], [x + 1, y]),
    canonicalEdge([x + 1, y], [x + 1, y + 1]),
    canonicalEdge([x, y + 1], [x + 1, y + 1]),
    canonicalEdge([x, y], [x, y + 1]),
  ];
}

function allEdges(board) {
  const edges = [];
  for (let y = 0; y < board.size; y += 1) {
    for (let x = 0; x < board.size - 1; x += 1) edges.push([[x, y], [x + 1, y]]);
  }
  for (let x = 0; x < board.size; x += 1) {
    for (let y = 0; y < board.size - 1; y += 1) edges.push([[x, y], [x, y + 1]]);
  }
  return edges.filter(([start, end]) => !board.edges.has(canonicalEdge(start, end)));
}

function cellsClosedByCandidate(board, start, end) {
  const candidateKey = canonicalEdge(start, end);
  let amount = 0;
  for (const cell of board.cellsTouchingEdge(start, end)) {
    const cellKey = `${cell[0]},${cell[1]}`;
    if (board.cells.has(cellKey)) continue;
    if (requiredEdges(cell).every((key) => key === candidateKey || board.edges.has(key))) amount += 1;
  }
  return amount;
}

function tacticalEdgeScore(room, bot, start, end) {
  const board = room.board;
  const closes = cellsClosedByCandidate(board, start, end);
  let ownAdjacency = 0;
  let enemyAdjacency = 0;
  let danger = 0;
  for (const cell of board.cellsTouchingEdge(start, end)) {
    for (const neighbor of board.adjacentCells(cell)) {
      const owned = board.cells.get(`${neighbor[0]},${neighbor[1]}`);
      if (owned?.ownerId === bot.id) ownAdjacency += 1;
      else if (owned) enemyAdjacency += 1;
    }
    const currentEdges = requiredEdges(cell).filter((key) => board.edges.has(key)).length;
    if (currentEdges === 2 && closes === 0) danger += 1;
  }
  const difficulty = room.campaign?.difficulty ?? "novice";
  if (difficulty === "novice") return closes * 100 + ownAdjacency * 2 - danger * 8;
  if (difficulty === "adept") return closes * 140 + ownAdjacency * 10 + enemyAdjacency * 4 - danger * 14;
  return closes * 180 + ownAdjacency * 14 + enemyAdjacency * 10 - danger * 20;
}

export function chooseCampaignEdge(room, bot) {
  const candidates = allEdges(room.board).map(([start, end], index) => ({
    start,
    end,
    index,
    closes: cellsClosedByCandidate(room.board, start, end),
    score: tacticalEdgeScore(room, bot, start, end),
  }));
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.score - left.score || right.closes - left.closes || left.index - right.index);
  if (room.campaign?.difficulty === "novice" && candidates.length > 2 && room.board.turnNumber % 3 === 0) {
    return candidates[Math.min(2, candidates.length - 1)];
  }
  return candidates[0];
}

function availableDuelCards(bot, energy) {
  return bot.hand
    .map((cardId) => getCard(cardId))
    .filter((card) => card.kind === "duel" && card.cost <= energy);
}

export function chooseCampaignDuelCards(room, bot, duel) {
  const combatant = duel.combatants[bot.id];
  if (!combatant) return [];
  const available = availableDuelCards(bot, combatant.energy);
  const has = (id) => available.some((card) => card.id === id);
  const difficulty = room.campaign?.difficulty ?? "novice";

  if (difficulty === "master" && has("wet") && has("lightning") && combatant.energy >= 3) return ["wet", "lightning"];
  if (combatant.hp <= Math.ceil(combatant.maxHp / 2) && has("heal")) {
    const sequence = ["heal"];
    if (has("shield") && combatant.energy >= 2) sequence.push("shield");
    return sequence;
  }
  if (difficulty !== "novice" && has("strike") && has("shield") && combatant.energy >= 2) return ["strike", "shield"];
  if (has("lightning")) return ["lightning"];
  if (has("strike")) return ["strike"];
  if (has("shield")) return ["shield"];
  return available.length > 0 ? [available[0].id] : [];
}

function chooseWeakestEnemyProvince(room, botId) {
  return [...room.board.provinces.values()]
    .filter((province) => province.ownerId !== botId)
    .sort((left, right) => {
      const leftStrength = left.unit.hp + left.unit.level * 2 + left.cellIds.length;
      const rightStrength = right.unit.hp + right.unit.level * 2 + right.cellIds.length;
      return leftStrength - rightStrength || left.id.localeCompare(right.id);
    })[0] ?? null;
}

function chooseOwnProvinceToFortify(room, botId) {
  return [...room.board.provinces.values()]
    .filter((province) => province.ownerId === botId)
    .sort((left, right) => left.unit.hp - right.unit.hp || right.cellIds.length - left.cellIds.length)[0] ?? null;
}

function canUseMacro(room, bot, cardId) {
  const card = getCard(cardId);
  return bot.hand.includes(cardId)
    && bot.mana >= card.cost
    && !room.usedMacroTurns.has(`${room.board.turnNumber}:${bot.id}`);
}

function tryCampaignMacro(room, bot) {
  const difficulty = room.campaign?.difficulty ?? "novice";
  if (difficulty !== "novice" && canUseMacro(room, bot, "duel")) {
    const target = chooseWeakestEnemyProvince(room, bot.id);
    if (target) return room.playCard(bot, { cardId: "duel", provinceId: target.id });
  }
  const own = chooseOwnProvinceToFortify(room, bot.id);
  if (own && own.unit.hp <= (difficulty === "master" ? 6 : 4) && canUseMacro(room, bot, "fortify")) {
    return room.playCard(bot, { cardId: "fortify", provinceId: own.id });
  }
  if (canUseMacro(room, bot, "expansion")) {
    const edge = chooseCampaignEdge(room, bot);
    if (edge && (edge.closes > 0 || difficulty === "master")) {
      return room.playCard(bot, { cardId: "expansion", start: edge.start, end: edge.end });
    }
  }
  return null;
}

function pendingBotDuel(room, botId) {
  return [...room.duels.values()].find((duel) => (
    duel.status !== "resolved"
    && [duel.attackerId, duel.defenderId].includes(botId)
    && !duel.submissions?.[botId]
  )) ?? null;
}

export function runCampaignAI(room, { maxPatches = 40 } = {}) {
  if (room.mode !== "campaign" || room.status !== "active") return [];
  const bot = room.players.find((item) => item.isBot);
  if (!bot) return [];
  const patches = [];

  for (let guard = 0; guard < maxPatches && room.status === "active"; guard += 1) {
    const duel = pendingBotDuel(room, bot.id);
    if (duel) {
      const cards = chooseCampaignDuelCards(room, bot, duel);
      patches.push(room.submitDuelRound(bot, duel.id, cards));
      continue;
    }

    if (room.board.currentPlayerId !== bot.id) break;

    try {
      const macroPatch = tryCampaignMacro(room, bot);
      if (macroPatch) {
        patches.push(macroPatch);
        continue;
      }
    } catch (error) {
      if (!["DUEL_EXISTS", "CARD_ACTION_USED", "PROVINCE_NOT_FOUND"].includes(error.code)) throw error;
    }

    const edge = chooseCampaignEdge(room, bot);
    if (!edge) break;
    patches.push(room.playEdge(bot, edge.start, edge.end));
  }

  return patches;
}
