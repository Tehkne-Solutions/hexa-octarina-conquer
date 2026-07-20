const mission = (definition) => Object.freeze({
  rewardXp: 100 + definition.order * 20,
  ...definition,
  primary: Object.freeze(definition.primary),
  bonus: Object.freeze(definition.bonus ?? []),
  failure: Object.freeze(definition.failure ?? {}),
});

export const CAMPAIGN_CHAPTERS = Object.freeze([
  Object.freeze({ id: "chapter-1", order: 1, title: "Fundamentos Rúnicos", subtitle: "Aprenda a fechar territórios e erguer suas primeiras fortalezas." }),
  Object.freeze({ id: "chapter-2", order: 2, title: "A Convergência Alquímica", subtitle: "Combine províncias, cartas e duelos para controlar o fluxo da batalha." }),
  Object.freeze({ id: "chapter-3", order: 3, title: "Ascensão Magitech", subtitle: "Enfrente comandantes agressivos e conquiste a Octarina absoluta." }),
]);

export const CAMPAIGN_MISSIONS = Object.freeze([
  mission({
    id: "c1-m1", chapterId: "chapter-1", order: 1, title: "A Primeira Linha",
    briefing: "O Cartógrafo Cinzento bloqueia a passagem. Feche seu primeiro território antes que ele domine o vale.",
    boardSize: 4, difficulty: "novice", aiName: "Cartógrafo Cinzento",
    primary: { type: "cells", target: 1, label: "Conquiste 1 célula" },
    bonus: [
      { type: "turns_max", target: 6, label: "Conclua em até 6 rodadas" },
      { type: "hp_min", target: 18, label: "Termine com 18 HP ou mais" },
    ],
    failure: { turnLimit: 14, botCells: 4 },
  }),
  mission({
    id: "c1-m2", chapterId: "chapter-1", order: 2, title: "O Quadrado Rúnico",
    briefing: "A Sentinela de Basalto força você a pensar em expansão e defesa ao mesmo tempo.",
    boardSize: 4, difficulty: "novice", aiName: "Sentinela de Basalto",
    primary: { type: "cells", target: 2, label: "Controle 2 células" },
    bonus: [
      { type: "fortifications", target: 1, label: "Fortifique uma província" },
      { type: "turns_max", target: 10, label: "Conclua em até 10 rodadas" },
    ],
    failure: { turnLimit: 18, botCells: 5 },
  }),
  mission({
    id: "c1-m3", chapterId: "chapter-1", order: 3, title: "Cerco Inicial",
    briefing: "A Caçadora de Ecos protege uma província isolada. Cerque-a e vença seu primeiro Duelo de Célula.",
    boardSize: 5, difficulty: "novice", aiName: "Caçadora de Ecos",
    primary: { type: "duels_won", target: 1, label: "Vença 1 Duelo de Célula" },
    bonus: [
      { type: "cells", target: 2, label: "Controle 2 células" },
      { type: "hp_min", target: 14, label: "Termine com 14 HP ou mais" },
    ],
    failure: { turnLimit: 24, botCells: 7 },
  }),
  mission({
    id: "c1-m4", chapterId: "chapter-1", order: 4, title: "Guardião do Limiar",
    briefing: "O Guardião domina a fronteira. Construa uma vantagem territorial clara para romper o primeiro selo.",
    boardSize: 5, difficulty: "adept", aiName: "Guardião do Limiar",
    primary: { type: "cell_lead", target: 2, label: "Abra vantagem de 2 células" },
    bonus: [
      { type: "largest_province", target: 2, label: "Forme uma província com 2 células" },
      { type: "turns_max", target: 18, label: "Conclua em até 18 rodadas" },
    ],
    failure: { turnLimit: 28, botCells: 8 },
  }),
  mission({
    id: "c2-m1", chapterId: "chapter-2", order: 5, title: "Maré e Trovão",
    briefing: "A Alquimista Abissal exige domínio das cartas de duelo. Ataque com precisão e mantenha terreno suficiente.",
    boardSize: 5, difficulty: "adept", aiName: "Alquimista Abissal",
    primary: { type: "duels_won", target: 1, label: "Vença 1 duelo" },
    bonus: [
      { type: "cells", target: 3, label: "Controle 3 células" },
      { type: "duel_cards", target: 2, label: "Use ao menos 2 cartas em uma rodada de duelo" },
    ],
    failure: { turnLimit: 26, botCells: 8 },
  }),
  mission({
    id: "c2-m2", chapterId: "chapter-2", order: 6, title: "Fortalezas Vivas",
    briefing: "O Arquiteto de Espinhos avança lentamente, mas suas estruturas são resistentes. Supere-o construindo uma rede fortificada.",
    boardSize: 5, difficulty: "adept", aiName: "Arquiteto de Espinhos",
    primary: { type: "fortifications", target: 2, label: "Realize 2 fortificações" },
    bonus: [
      { type: "cells", target: 4, label: "Controle 4 células" },
      { type: "hp_min", target: 14, label: "Termine com 14 HP ou mais" },
    ],
    failure: { turnLimit: 30, botCells: 9 },
  }),
  mission({
    id: "c2-m3", chapterId: "chapter-2", order: 7, title: "Rede de Províncias",
    briefing: "A Tecelã Prismática fragmenta o mapa. Una territórios vizinhos em uma única província poderosa.",
    boardSize: 6, difficulty: "adept", aiName: "Tecelã Prismática",
    primary: { type: "largest_province", target: 3, label: "Forme uma província com 3 células" },
    bonus: [
      { type: "cells", target: 5, label: "Controle 5 células" },
      { type: "turns_max", target: 22, label: "Conclua em até 22 rodadas" },
    ],
    failure: { turnLimit: 34, botCells: 11 },
  }),
  mission({
    id: "c2-m4", chapterId: "chapter-2", order: 8, title: "Mestre Alquimista",
    briefing: "O Mestre Rubro combina agressão territorial e duelos. Prove que sua estratégia funciona sob pressão.",
    boardSize: 6, difficulty: "master", aiName: "Mestre Rubro",
    primary: { type: "cells", target: 6, label: "Controle 6 células" },
    bonus: [
      { type: "duels_won", target: 2, label: "Vença 2 duelos" },
      { type: "turns_max", target: 26, label: "Conclua em até 26 rodadas" },
    ],
    failure: { turnLimit: 38, botCells: 12 },
  }),
  mission({
    id: "c3-m1", chapterId: "chapter-3", order: 9, title: "Pressão Mecânica",
    briefing: "A Máquina de Cerco transforma cada erro em território perdido. Controle o centro antes que o mapa se feche.",
    boardSize: 6, difficulty: "master", aiName: "Máquina de Cerco",
    primary: { type: "cell_lead", target: 3, label: "Abra vantagem de 3 células" },
    bonus: [
      { type: "cells", target: 6, label: "Controle 6 células" },
      { type: "hp_min", target: 12, label: "Termine com 12 HP ou mais" },
    ],
    failure: { turnLimit: 36, botCells: 13 },
  }),
  mission({
    id: "c3-m2", chapterId: "chapter-3", order: 10, title: "Trono Fragmentado",
    briefing: "O Regente Quebrado mantém várias províncias pequenas. Capture seus núcleos em duelos consecutivos.",
    boardSize: 6, difficulty: "master", aiName: "Regente Quebrado",
    primary: { type: "captures", target: 2, label: "Capture 2 províncias" },
    bonus: [
      { type: "duels_won", target: 2, label: "Vença 2 duelos" },
      { type: "largest_province", target: 4, label: "Forme uma província com 4 células" },
    ],
    failure: { turnLimit: 40, botCells: 14 },
  }),
  mission({
    id: "c3-m3", chapterId: "chapter-3", order: 11, title: "Última Convergência",
    briefing: "A Legião Vetorial tenta dividir o campo. Una uma grande província e preserve o domínio ao redor dela.",
    boardSize: 7, difficulty: "master", aiName: "Legião Vetorial",
    primary: { type: "largest_province", target: 5, label: "Forme uma província com 5 células" },
    bonus: [
      { type: "cells", target: 8, label: "Controle 8 células" },
      { type: "fortifications", target: 2, label: "Realize 2 fortificações" },
    ],
    failure: { turnLimit: 46, botCells: 17 },
  }),
  mission({
    id: "c3-m4", chapterId: "chapter-3", order: 12, title: "Octarina Absoluta",
    briefing: "O Arconte Octarino domina todas as escolas de guerra. Conquiste o núcleo final e encerre a campanha.",
    boardSize: 7, difficulty: "master", aiName: "Arconte Octarino",
    rewardXp: 500,
    primary: { type: "cells", target: 10, label: "Controle 10 células" },
    bonus: [
      { type: "duels_won", target: 2, label: "Vença 2 duelos" },
      { type: "cell_lead", target: 5, label: "Abra vantagem de 5 células" },
    ],
    failure: { turnLimit: 52, botCells: 20 },
  }),
]);

export const CAMPAIGN_ACHIEVEMENTS = Object.freeze([
  Object.freeze({ id: "first-sigil", title: "Primeiro Selo", description: "Conclua a primeira missão.", icon: "✦" }),
  Object.freeze({ id: "six-stars", title: "Constelação Rúnica", description: "Obtenha 6 estrelas na campanha.", icon: "★" }),
  Object.freeze({ id: "twelve-stars", title: "Céu Alquímico", description: "Obtenha 12 estrelas na campanha.", icon: "✷" }),
  Object.freeze({ id: "cartographer", title: "Cartógrafo", description: "Conquiste 25 células em missões.", icon: "⌁" }),
  Object.freeze({ id: "duelist", title: "Duelista Octarino", description: "Vença 5 Duelos de Célula.", icon: "⚔" }),
  Object.freeze({ id: "architect", title: "Arquiteto de Fortalezas", description: "Realize 6 fortificações.", icon: "⬢" }),
  Object.freeze({ id: "flawless", title: "Vitória Imaculada", description: "Conclua uma missão com 18 HP ou mais.", icon: "◆" }),
  Object.freeze({ id: "chapter-one", title: "Runa Completa", description: "Conclua o capítulo Fundamentos Rúnicos.", icon: "Ⅰ" }),
  Object.freeze({ id: "chapter-two", title: "Convergência Completa", description: "Conclua o capítulo A Convergência Alquímica.", icon: "Ⅱ" }),
  Object.freeze({ id: "legend", title: "Lenda da Octarina", description: "Conclua todas as missões.", icon: "⬡" }),
]);

const MISSION_BY_ID = new Map(CAMPAIGN_MISSIONS.map((item) => [item.id, item]));

export function getCampaignMission(missionId) {
  const item = MISSION_BY_ID.get(missionId);
  if (!item) throw Object.assign(new Error(`unknown campaign mission: ${missionId}`), { code: "MISSION_NOT_FOUND" });
  return item;
}

export function objectiveValue(stats, type) {
  switch (type) {
    case "cells": return stats.cells;
    case "cell_lead": return stats.cells - stats.botCells;
    case "fortifications": return stats.fortifications;
    case "duels_won": return stats.duelsWon;
    case "captures": return stats.captures;
    case "largest_province": return stats.largestProvince;
    case "duel_cards": return stats.maxDuelCards;
    case "turns_max": return stats.turns;
    case "hp_min": return stats.hp;
    default: return 0;
  }
}

export function objectiveComplete(objective, stats) {
  const value = objectiveValue(stats, objective.type);
  if (objective.type === "turns_max") return value <= objective.target;
  return value >= objective.target;
}

export function emptyCampaignProgress() {
  return {
    schemaVersion: 1,
    missions: {},
    achievements: {},
    totals: { stars: 0, cells: 0, duelsWon: 0, fortifications: 0, attempts: 0, completed: 0 },
    recordedRooms: [],
    updatedAt: 0,
  };
}

export function unlockedMissionIds(progress = emptyCampaignProgress()) {
  const unlocked = new Set([CAMPAIGN_MISSIONS[0].id]);
  for (let index = 1; index < CAMPAIGN_MISSIONS.length; index += 1) {
    const previous = CAMPAIGN_MISSIONS[index - 1];
    if ((progress.missions?.[previous.id]?.stars ?? 0) > 0) unlocked.add(CAMPAIGN_MISSIONS[index].id);
  }
  return [...unlocked];
}

export function publicCampaignCatalog(progress = emptyCampaignProgress()) {
  const unlocked = new Set(unlockedMissionIds(progress));
  return {
    chapters: CAMPAIGN_CHAPTERS,
    missions: CAMPAIGN_MISSIONS.map((item) => ({
      ...item,
      unlocked: unlocked.has(item.id),
      progress: progress.missions?.[item.id] ?? null,
    })),
    achievements: CAMPAIGN_ACHIEVEMENTS.map((item) => ({
      ...item,
      unlockedAt: progress.achievements?.[item.id]?.unlockedAt ?? null,
    })),
    totals: progress.totals ?? emptyCampaignProgress().totals,
  };
}

function completedCount(progress, chapterId = null) {
  return CAMPAIGN_MISSIONS.filter((item) => (!chapterId || item.chapterId === chapterId) && (progress.missions?.[item.id]?.stars ?? 0) > 0).length;
}

export function mergeCampaignResult(current, result, now = Date.now()) {
  const progress = structuredClone(current ?? emptyCampaignProgress());
  progress.schemaVersion = 1;
  progress.missions ??= {};
  progress.achievements ??= {};
  progress.recordedRooms ??= [];
  progress.totals ??= emptyCampaignProgress().totals;
  if (progress.recordedRooms.includes(result.roomId)) return { progress, recorded: false, unlockedAchievements: [] };

  progress.recordedRooms = [...progress.recordedRooms, result.roomId].slice(-200);
  const previous = progress.missions[result.missionId] ?? { stars: 0, attempts: 0, bestTurns: null, bestHp: 0 };
  const completed = result.success === true;
  progress.missions[result.missionId] = {
    stars: Math.max(previous.stars ?? 0, result.stars ?? 0),
    attempts: (previous.attempts ?? 0) + 1,
    bestTurns: completed ? Math.min(previous.bestTurns ?? Number.MAX_SAFE_INTEGER, result.stats.turns) : previous.bestTurns,
    bestHp: completed ? Math.max(previous.bestHp ?? 0, result.stats.hp) : previous.bestHp,
    completedAt: completed ? (previous.completedAt ?? now) : previous.completedAt ?? null,
    lastResult: completed ? "victory" : "defeat",
  };
  progress.totals.attempts += 1;
  progress.totals.cells += result.stats.cells;
  progress.totals.duelsWon += result.stats.duelsWon;
  progress.totals.fortifications += result.stats.fortifications;
  progress.totals.stars = Object.values(progress.missions).reduce((sum, entry) => sum + (entry.stars ?? 0), 0);
  progress.totals.completed = Object.values(progress.missions).filter((entry) => (entry.stars ?? 0) > 0).length;
  progress.updatedAt = now;

  const unlock = (id, condition) => {
    if (condition && !progress.achievements[id]) progress.achievements[id] = { unlockedAt: now };
  };
  unlock("first-sigil", progress.totals.completed >= 1);
  unlock("six-stars", progress.totals.stars >= 6);
  unlock("twelve-stars", progress.totals.stars >= 12);
  unlock("cartographer", progress.totals.cells >= 25);
  unlock("duelist", progress.totals.duelsWon >= 5);
  unlock("architect", progress.totals.fortifications >= 6);
  unlock("flawless", completed && result.stats.hp >= 18);
  unlock("chapter-one", completedCount(progress, "chapter-1") === 4);
  unlock("chapter-two", completedCount(progress, "chapter-2") === 4);
  unlock("legend", completedCount(progress) === CAMPAIGN_MISSIONS.length);

  const previousAchievements = new Set(Object.keys(current?.achievements ?? {}));
  const unlockedAchievements = Object.keys(progress.achievements).filter((id) => !previousAchievements.has(id));
  return { progress, recorded: true, unlockedAchievements };
}
