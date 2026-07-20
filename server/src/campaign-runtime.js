import { getCampaignMission, objectiveComplete, objectiveValue } from "./campaign-catalog.js";

function playerById(room, playerId) {
  return room.players.find((item) => item.id === playerId) ?? null;
}

export function initializeCampaign(room, { missionId, humanPlayerId, botPlayerId }) {
  const mission = getCampaignMission(missionId);
  room.mode = "campaign";
  room.campaign = {
    missionId,
    humanPlayerId,
    botPlayerId,
    difficulty: mission.difficulty,
    startedAt: room.clock(),
    completedAt: null,
    status: "active",
    stats: {
      edgesPlayed: 0,
      fortifications: 0,
      duelsWon: 0,
      captures: 0,
      maxDuelCards: 0,
      cells: 0,
      botCells: 0,
      largestProvince: 0,
      turns: 1,
      hp: 20,
    },
    result: null,
  };
  return room.campaign;
}

export function derivedCampaignStats(room) {
  if (!room.campaign) return null;
  const humanId = room.campaign.humanPlayerId;
  const botId = room.campaign.botPlayerId;
  const human = playerById(room, humanId);
  const cells = [...room.board.cells.values()];
  const provinces = [...room.board.provinces.values()].filter((item) => item.ownerId === humanId);
  return {
    ...room.campaign.stats,
    cells: cells.filter((item) => item.ownerId === humanId).length,
    botCells: cells.filter((item) => item.ownerId === botId).length,
    largestProvince: provinces.reduce((largest, item) => Math.max(largest, item.cellIds.length), 0),
    turns: room.board.turnNumber,
    hp: human?.hp ?? 0,
  };
}

function publicObjective(objective, stats) {
  return {
    ...objective,
    current: objectiveValue(stats, objective.type),
    completed: objectiveComplete(objective, stats),
  };
}

export function publicCampaignState(room) {
  if (!room.campaign) return null;
  const mission = getCampaignMission(room.campaign.missionId);
  const stats = derivedCampaignStats(room);
  return {
    mission: {
      id: mission.id,
      chapterId: mission.chapterId,
      order: mission.order,
      title: mission.title,
      briefing: mission.briefing,
      difficulty: mission.difficulty,
      aiName: mission.aiName,
      rewardXp: mission.rewardXp,
    },
    status: room.campaign.status,
    humanPlayerId: room.campaign.humanPlayerId,
    botPlayerId: room.campaign.botPlayerId,
    primary: publicObjective(mission.primary, stats),
    bonus: mission.bonus.map((objective) => publicObjective(objective, stats)),
    failure: mission.failure,
    stats,
    result: room.campaign.result,
  };
}

function finalizeCampaign(room, { success, reason }) {
  if (!room.campaign || room.campaign.result) return room.campaign?.result ?? null;
  const mission = getCampaignMission(room.campaign.missionId);
  const stats = derivedCampaignStats(room);
  const human = playerById(room, room.campaign.humanPlayerId);
  const bot = playerById(room, room.campaign.botPlayerId);
  const bonusCompleted = mission.bonus.map((objective) => objectiveComplete(objective, stats));
  const stars = success ? 1 + bonusCompleted.filter(Boolean).length : 0;
  const finishedAt = room.clock();
  room.campaign.status = success ? "completed" : "failed";
  room.campaign.completedAt = finishedAt;
  room.campaign.stats = stats;
  room.campaign.result = {
    roomId: room.id,
    missionId: mission.id,
    success,
    stars,
    rewardXp: success ? mission.rewardXp + stars * 25 : 0,
    reason,
    stats,
    bonusCompleted,
    finishedAt,
  };
  room.status = "finished";
  room.matchResult = {
    roomId: room.id,
    winnerPlayerId: success ? human.id : bot.id,
    loserPlayerId: success ? bot.id : human.id,
    winnerAccountId: success ? human.accountId ?? null : null,
    loserAccountId: success ? null : human.accountId ?? null,
    reason: success ? "campaign_complete" : "campaign_failed",
    finishedAt,
  };
  return room.campaign.result;
}

export function beforeCampaignCommit(room, eventType, payload) {
  if (!room.campaign || room.campaign.result) return;
  const humanId = room.campaign.humanPlayerId;
  const botId = room.campaign.botPlayerId;
  const stats = room.campaign.stats;

  if (eventType === "edge.played" && payload.playerId === humanId) {
    stats.edgesPlayed += 1;
  }
  if (eventType === "card.played" && payload.playerId === humanId && payload.cardId === "fortify") {
    stats.fortifications += 1;
  }
  if (["duel.cards_submitted", "duel.round_resolved"].includes(eventType) && payload.playerId === humanId) {
    stats.maxDuelCards = Math.max(stats.maxDuelCards, Number(payload.submittedCardCount ?? 0));
  }
  if (eventType === "duel.round_resolved" && payload.resolution?.resolved && payload.resolution?.winnerId === humanId) {
    stats.duelsWon += 1;
    if (payload.mergedProvinceId) stats.captures += 1;
  }

  room.campaign.stats = derivedCampaignStats(room);

  if (eventType === "match.finished") {
    finalizeCampaign(room, { success: payload.winnerPlayerId === humanId, reason: payload.reason ?? "forfeit" });
    return;
  }
  if (room.status !== "active") return;

  const mission = getCampaignMission(room.campaign.missionId);
  const current = room.campaign.stats;
  if (objectiveComplete(mission.primary, current)) {
    finalizeCampaign(room, { success: true, reason: "primary_objective" });
    return;
  }
  if (current.botCells >= Number(mission.failure.botCells ?? Number.MAX_SAFE_INTEGER)) {
    finalizeCampaign(room, { success: false, reason: "enemy_domination" });
    return;
  }
  if (current.turns > Number(mission.failure.turnLimit ?? Number.MAX_SAFE_INTEGER)) {
    finalizeCampaign(room, { success: false, reason: "turn_limit" });
    return;
  }

  const totalCells = (room.board.size - 1) ** 2;
  if (room.board.cells.size >= totalCells) {
    finalizeCampaign(room, { success: current.cells > current.botCells, reason: "board_complete" });
  }
}

export function campaignResultForPersistence(room) {
  if (!room.campaign?.result) return null;
  const human = playerById(room, room.campaign.humanPlayerId);
  return { ...room.campaign.result, accountId: human?.accountId ?? null };
}
