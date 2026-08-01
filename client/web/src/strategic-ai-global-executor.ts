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
import { strategicBestGlobalAction, type StrategicAiActionCandidate } from "./strategic-ai-global-action";

function decisionTrace(action: StrategicAiActionCandidate): string {
  return `[IA ${action.kind.toUpperCase()} · score ${action.score}] ${action.reason}`;
}

export function strategicEnemyTurnGlobal(board: StrategicBoard): StrategicAiTurn {
  let next = board;
  const messages: string[] = [];
  const movedUnits = new Set<StrategicUnitId>();
  const attackedUnits = new Set<StrategicUnitId>();
  const budget = strategicActionBudget(board, "red");

  for (let actionIndex = 0; actionIndex < budget && strategicResult(next) === "playing"; actionIndex += 1) {
    const selected = strategicBestGlobalAction(next, attackedUnits, movedUnits);
    if (!selected) break;

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
      next = strategicClaimEdge(next, selected.unitId, selected.targetId);
      const closedTerritory = strategicOwnedCellCount(next, "red") > beforeOwned;
      messages.push(closedTerritory
        ? `${trace}. ${unit.name} fechou uma região para a Legião Rubra.`
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
