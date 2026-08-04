import {
  strategicActionBudget,
  strategicAttack,
  strategicBuildStructure,
  strategicClaimEdge,
  strategicMoveUnit,
  strategicOwnedCellCount,
  strategicResult,
  strategicUnit,
  type StrategicAiTurn,
  type StrategicBoard,
  type StrategicUnitId,
} from "./strategic-board-model";
import { strategicContestRoute, strategicContestTargets } from "./strategic-route-contest";
import {
  strategicGlobalActionCandidates,
  type StrategicAiActionCandidate,
  type StrategicAiActionKind,
  type StrategicAiActionKindCounts,
} from "./strategic-ai-global-action";

function decisionTrace(action: StrategicAiActionCandidate): string {
  return `[IA ${action.kind.toUpperCase()} · score ${action.score}] ${action.reason}`;
}

function emptyKindCounts(): Record<StrategicAiActionKind, number> {
  return { attack: 0, confront: 0, build: 0, structure: 0, move: 0 };
}

export function strategicRoleIdentityBonus(action: StrategicAiActionCandidate): number {
  if (action.unitId === "varg") {
    if (action.kind === "move") return 6;
    if (action.kind === "confront") return 4;
    return 0;
  }

  if (action.unitId === "brakk") {
    if (action.kind === "structure") return 6;
    if (action.kind === "attack") return 2;
    if (action.kind === "confront") return 2;
  }

  return 0;
}

function roleReason(action: StrategicAiActionCandidate): string | null {
  if (action.unitId === "varg" && action.kind === "move") return "Varg explora como batedor";
  if (action.unitId === "varg" && action.kind === "confront") return "Varg abre frente como batedor";
  if (action.unitId === "brakk" && action.kind === "structure") return "Brakk sustenta a linha como campeão";
  if (action.unitId === "brakk" && action.kind === "attack") return "Brakk pressiona como campeão";
  if (action.unitId === "brakk" && action.kind === "confront") return "Brakk força a linha de confronto";
  return null;
}

export function strategicBestRoleAwareAction(
  board: StrategicBoard,
  attackedUnits: ReadonlySet<StrategicUnitId> = new Set(),
  movedUnits: ReadonlySet<StrategicUnitId> = new Set(),
  actionKindCounts: StrategicAiActionKindCounts = {},
): StrategicAiActionCandidate | null {
  const candidates = strategicGlobalActionCandidates(board, attackedUnits, movedUnits, actionKindCounts);
  if (candidates.length === 0) return null;

  return candidates
    .map((candidate) => {
      const bonus = strategicRoleIdentityBonus(candidate);
      const identity = roleReason(candidate);
      return {
        ...candidate,
        score: candidate.score + bonus,
        reason: identity ? `${candidate.reason}; ${identity}` : candidate.reason,
      };
    })
    .sort((a, b) => b.score - a.score
      || a.kind.localeCompare(b.kind)
      || a.unitId.localeCompare(b.unitId)
      || a.targetId.localeCompare(b.targetId))[0] ?? null;
}

export function strategicEnemyTurnGlobal(board: StrategicBoard): StrategicAiTurn {
  let next = board;
  const messages: string[] = [];
  const movedUnits = new Set<StrategicUnitId>();
  const attackedUnits = new Set<StrategicUnitId>();
  const actionKindCounts = emptyKindCounts();
  const budget = strategicActionBudget(board, "red");

  for (let actionIndex = 0; actionIndex < budget && strategicResult(next) === "playing"; actionIndex += 1) {
    const selected = strategicBestRoleAwareAction(next, attackedUnits, movedUnits, actionKindCounts);
    if (!selected) break;

    actionKindCounts[selected.kind] += 1;
    const unit = strategicUnit(next, selected.unitId);
    const trace = decisionTrace(selected);

    if (selected.kind === "attack") {
      const target = strategicUnit(next, selected.targetId as StrategicUnitId);
      next = strategicAttack(next, selected.unitId, target.id);
      attackedUnits.add(selected.unitId);
      messages.push(`${trace}. ${unit.name} atacou ${target.name}.`);
      continue;
    }

    if (selected.kind === "confront") {
      next = strategicClaimEdge(next, selected.unitId, selected.targetId);
      messages.push(`${trace}. ${unit.name} abriu uma rota de confronto.`);
      continue;
    }

    if (selected.kind === "build") {
      const beforeOwned = strategicOwnedCellCount(next, "red");
      const contesting = strategicContestTargets(next, selected.unitId).includes(selected.targetId);
      next = contesting
        ? strategicContestRoute(next, selected.unitId, selected.targetId)
        : strategicClaimEdge(next, selected.unitId, selected.targetId);
      const closedTerritory = strategicOwnedCellCount(next, "red") > beforeOwned;
      messages.push(closedTerritory
        ? `${trace}. ${unit.name} fechou uma região para a Legião Rubra.`
        : contesting
          ? `${trace}. ${unit.name} retomou uma rota disputada.`
          : `${trace}. ${unit.name} expandiu a rede Rubra.`);
      continue;
    }

    if (selected.kind === "structure") {
      next = strategicBuildStructure(next, selected.unitId, selected.targetId, "watchtower");
      messages.push(`${trace}. ${unit.name} fortificou a fronteira Rubra.`);
      continue;
    }

    next = strategicMoveUnit(next, selected.unitId, selected.targetId);
    movedUnits.add(selected.unitId);
    messages.push(`${trace}. ${unit.name} reposicionou-se.`);
  }

  return {
    board: next,
    message: messages.length > 0 ? messages.join(" ") : "A Legião Rubra manteve posição.",
  };
}
