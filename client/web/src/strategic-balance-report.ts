import {
  simulateStrategicBalance,
  type StrategicBalanceAiAction,
  type StrategicBalanceSummary,
} from "./strategic-balance-simulator";

export interface StrategicBalanceReport {
  sampleSize: number;
  seedOffset: number;
  blueWinRate: number;
  redWinRate: number;
  unresolvedRate: number;
  averageRounds: number;
  averageTerritoryDelta: number;
  averageCasualtyDelta: number;
  dominantRedAction: StrategicBalanceAiAction | null;
  redActionShare: Record<StrategicBalanceAiAction, number>;
  health: "blue-favored" | "red-favored" | "balanced" | "inconclusive";
  notes: string[];
  summary: StrategicBalanceSummary;
}

const ACTIONS: StrategicBalanceAiAction[] = ["ATTACK", "CONFRONT", "BUILD", "STRUCTURE", "MOVE"];

export function generateStrategicBalanceReport(sampleSize = 500, seedOffset = 1): StrategicBalanceReport {
  const summary = simulateStrategicBalance(sampleSize, seedOffset);
  const safeMatches = Math.max(1, summary.matches);
  const resolved = summary.victories + summary.defeats;
  const totalRedActions = ACTIONS.reduce((total, kind) => total + summary.redActionCounts[kind], 0);
  const redActionShare = Object.fromEntries(ACTIONS.map((kind) => [
    kind,
    totalRedActions > 0 ? summary.redActionCounts[kind] / totalRedActions : 0,
  ])) as Record<StrategicBalanceAiAction, number>;
  const dominantRedAction = totalRedActions > 0
    ? [...ACTIONS].sort((a, b) => summary.redActionCounts[b] - summary.redActionCounts[a] || a.localeCompare(b))[0]
    : null;

  const blueWinRate = summary.victories / safeMatches;
  const redWinRate = summary.defeats / safeMatches;
  const unresolvedRate = summary.unresolved / safeMatches;
  const resolvedBlueRate = resolved > 0 ? summary.victories / resolved : 0.5;

  let health: StrategicBalanceReport["health"] = "balanced";
  if (unresolvedRate > 0.15) health = "inconclusive";
  else if (resolvedBlueRate > 0.6) health = "blue-favored";
  else if (resolvedBlueRate < 0.4) health = "red-favored";

  const notes: string[] = [];
  if (unresolvedRate > 0.15) notes.push("Mais de 15% das partidas não terminam em 24 rodadas; revisar condições de encerramento ou deadlocks.");
  if (health === "blue-favored") notes.push("A política Blue de QA vence mais de 60% das partidas resolvidas; a Legião Rubra pode estar subdimensionada.");
  if (health === "red-favored") notes.push("A Legião Rubra vence mais de 60% das partidas resolvidas; revisar pressão ofensiva e economia de ações.");
  if (dominantRedAction && redActionShare[dominantRedAction] > 0.55) notes.push(`${dominantRedAction} representa mais de 55% das decisões Rubras; avaliar excesso de peso dessa categoria no scorer.`);
  if (summary.averageRounds < 3) notes.push("As partidas terminam muito cedo em média; verificar burst de dano e rotas de confronto imediatas.");
  if (summary.averageRounds > 14) notes.push("As partidas estão longas em média; revisar progresso territorial e capacidade de fechamento.");
  if (notes.length === 0) notes.push("Nenhum alerta automático de balanceamento foi acionado para esta amostra.");

  return {
    sampleSize: summary.matches,
    seedOffset,
    blueWinRate,
    redWinRate,
    unresolvedRate,
    averageRounds: summary.averageRounds,
    averageTerritoryDelta: summary.averageBlueCells - summary.averageRedCells,
    averageCasualtyDelta: summary.averageRedCasualties - summary.averageBlueCasualties,
    dominantRedAction,
    redActionShare,
    health,
    notes,
    summary,
  };
}
