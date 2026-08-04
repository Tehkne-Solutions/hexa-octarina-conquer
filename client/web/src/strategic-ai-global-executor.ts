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

export type StrategicAiTurnWithTrace = StrategicAiTurn & { debugTrace?: string };

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

function playerIntent(action: StrategicAiActionCandidate, unitName: string): string {
  if (action.unitId === "varg") {
    if (action.kind === "move") return `${unitName} procura uma nova linha de avanço.`;
    if (action.kind === "confront") return `${unitName} abre uma frente contra Orun.`;
  }

  if (action.unitId === "brakk") {
    if (action.kind === "structure") return `${unitName} fortalece a posição Rubra.`;
    if (action.kind === "confront") return `${unitName} força uma linha de confronto.`;
  }

  return "";
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

export function strategicEnemyTurnGlobal(board: StrategicBoard): StrategicAiTurnWithTrace {
  let next = board;
  const messages: string[] = [];
  const debugTraces: string[] = [];
  const movedUnits = new Set<StrategicUnitId>();
  const attackedUnits = new Set<StrategicUnitId>();
  const actionKindCounts = emptyKindCounts();
  const budget = strategicActionBudget(board, "red");

  for (let actionIndex = 0; actionIndex < budget && strategicResult(next) === "playing"; actionIndex += 1) {
    const selected = strategicBestRoleAwareAction(next, attackedUnits, movedUnits, actionKindCounts);
    if (!selected) break;

    actionKindCounts[selected.kind] += 1;
    const unit = strategicUnit(next, selected.unitId);
    debugTraces.push(decisionTrace(selected));

    if (selected.kind === "attack") {
      const target = strategicUnit(next, selected.targetId as StrategicUnitId);
      next = strategicAttack(next, selected.unitId, target.id);
      attackedUnits.add(selected.unitId);
      messages.push(`${unit.name} ataca ${target.name}.`);
      continue;
    }

    if (selected.kind === "confront") {
      next = strategicClaimEdge(next, selected.unitId, selected.targetId);
      messages.push(playerIntent(selected, unit.name) || `${unit.name} abre uma rota de confronto.`);
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
        ? `${unit.name} fecha uma região para a Legião Rubra.`
        : contesting
          ? `${unit.name} retoma uma rota disputada.`
          : `${unit.name} expande a rede Rubra.`);
      continue;
    }

    if (selected.kind === "structure") {
      next = strategicBuildStructure(next, selected.unitId, selected.targetId, "watchtower");
      messages.push(playerIntent(selected, unit.name) || `${unit.name} fortifica a fronteira Rubra.`);
      continue;
    }

    next = strategicMoveUnit(next, selected.unitId, selected.targetId);
    movedUnits.add(selected.unitId);
    messages.push(playerIntent(selected, unit.name) || `${unit.name} se reposiciona.`);
  }

  return {
    board: next,
    message: messages.length > 0 ? messages.join(" ") : "A Legião Rubra manteve posição.",
    debugTrace: debugTraces.length > 0 ? debugTraces.join(" | ") : undefined,
  };
}
