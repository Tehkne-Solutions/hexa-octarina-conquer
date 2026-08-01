import {
  strategicAttackTargets,
  strategicCellRoadProgress,
  strategicClaimEdge,
  strategicConfrontationTargets,
  strategicEdgeId,
  strategicMoveTargets,
  strategicMoveUnit,
  strategicOwnedCellCount,
  strategicPreferredBuild,
  strategicPreferredMove,
  strategicPreferredStructure,
  strategicStructureTargets,
  strategicUnit,
  strategicUnitAt,
  type StrategicBoard,
  type StrategicUnitId,
} from "./strategic-board-model";
import { strategicContestRoute, strategicContestTargets } from "./strategic-route-contest";

export type StrategicAiActionKind = "attack" | "confront" | "build" | "structure" | "move";

export interface StrategicAiActionCandidate {
  kind: StrategicAiActionKind;
  unitId: StrategicUnitId;
  targetId: string;
  score: number;
  reason: string;
}

function buildClosesTerritory(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): boolean {
  const before = strategicOwnedCellCount(board, "red");
  const after = strategicClaimEdge(board, unitId, targetNodeId);
  return strategicOwnedCellCount(after, "red") > before;
}

function buildProgressOnAffectedCells(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): number {
  const unit = strategicUnit(board, unitId);
  const edgeId = strategicEdgeId(unit.nodeId, targetNodeId);
  const projected = strategicClaimEdge(board, unitId, targetNodeId);
  return projected.cells
    .filter((cell) => cell.edgeIds.includes(edgeId))
    .reduce((best, cell) => Math.max(best, strategicCellRoadProgress(projected, cell.id, "red")), 0);
}

function contestClosesTerritory(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): boolean {
  const before = strategicOwnedCellCount(board, "red");
  const after = strategicContestRoute(board, unitId, targetNodeId);
  return strategicOwnedCellCount(after, "red") > before;
}

function contestProgressOnAffectedCells(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): number {
  const unit = strategicUnit(board, unitId);
  const edgeId = strategicEdgeId(unit.nodeId, targetNodeId);
  const projected = strategicContestRoute(board, unitId, targetNodeId);
  return projected.cells
    .filter((cell) => cell.edgeIds.includes(edgeId))
    .reduce((best, cell) => Math.max(best, strategicCellRoadProgress(projected, cell.id, "red")), 0);
}

export function strategicGlobalActionCandidates(
  board: StrategicBoard,
  attackedUnits: ReadonlySet<StrategicUnitId> = new Set(),
  movedUnits: ReadonlySet<StrategicUnitId> = new Set(),
): StrategicAiActionCandidate[] {
  const candidates: StrategicAiActionCandidate[] = [];
  const enemies = board.units.filter((unit) => unit.faction === "red" && unit.hp > 0);

  for (const enemy of enemies) {
    if (!attackedUnits.has(enemy.id)) {
      for (const targetId of strategicAttackTargets(board, enemy.id)) {
        const target = strategicUnit(board, targetId);
        const missingHp = target.maxHp - target.hp;
        const lethalBonus = target.hp <= 5 ? 40 : 0;
        candidates.push({
          kind: "attack",
          unitId: enemy.id,
          targetId,
          score: 100 + missingHp + lethalBonus,
          reason: lethalBonus > 0 ? "finalização de alvo vulnerável" : "pressão ofensiva imediata",
        });
      }
    }

    for (const nodeId of strategicConfrontationTargets(board, enemy.id)) {
      const target = strategicUnitAt(board, nodeId);
      candidates.push({
        kind: "confront",
        unitId: enemy.id,
        targetId: nodeId,
        score: 78 + (target ? target.maxHp - target.hp : 0),
        reason: "abre uma frente de combate",
      });
    }

    for (const targetId of strategicContestTargets(board, enemy.id)) {
      const closes = contestClosesTerritory(board, enemy.id, targetId);
      const progress = contestProgressOnAffectedCells(board, enemy.id, targetId);
      candidates.push({
        kind: "build",
        unitId: enemy.id,
        targetId,
        score: closes ? 99 : progress >= 3 ? 93 : progress >= 2 ? 80 : 66,
        reason: closes
          ? "reconquista rota e fecha território rubro"
          : progress >= 3
            ? "reconquista rota crítica do perímetro"
            : "disputa uma rota inimiga que bloqueia a expansão",
      });
    }

    const buildTarget = strategicPreferredBuild(board, enemy.id);
    if (buildTarget) {
      const closes = buildClosesTerritory(board, enemy.id, buildTarget);
      const progress = buildProgressOnAffectedCells(board, enemy.id, buildTarget);
      const buildScore = closes ? 98 : progress >= 3 ? 94 : progress >= 2 ? 78 : 60;
      candidates.push({
        kind: "build",
        unitId: enemy.id,
        targetId: buildTarget,
        score: buildScore,
        reason: closes
          ? "fecha território rubro"
          : progress >= 3
            ? "leva o perímetro rubro a três lados"
            : progress >= 2
              ? "consolida uma frente territorial"
              : "aproxima uma conquista territorial",
      });
    }

    const structureTarget = strategicPreferredStructure(board, enemy.id);
    if (structureTarget && strategicStructureTargets(board, enemy.id).includes(structureTarget)) {
      candidates.push({
        kind: "structure",
        unitId: enemy.id,
        targetId: structureTarget,
        score: 84,
        reason: "fortifica fronteira e amplia orçamento futuro",
      });
    }

    if (!movedUnits.has(enemy.id)) {
      const critical = enemy.hp / enemy.maxHp <= 0.4;
      const retreatTarget = critical ? strategicPreferredMove(board, enemy.id) : null;

      for (const moveTarget of strategicMoveTargets(board, enemy.id)) {
        if (critical) {
          candidates.push({
            kind: "move",
            unitId: enemy.id,
            targetId: moveTarget,
            score: moveTarget === retreatTarget ? 72 : 30,
            reason: moveTarget === retreatTarget ? "preserva unidade crítica" : "reposicionamento defensivo alternativo",
          });
          continue;
        }

        const projected = strategicMoveUnit(board, enemy.id, moveTarget);
        const nextBuild = strategicPreferredBuild(projected, enemy.id);
        const nextContest = strategicContestTargets(projected, enemy.id)[0] ?? null;
        const enablesClosure = Boolean(
          (nextBuild && buildClosesTerritory(projected, enemy.id, nextBuild))
          || (nextContest && contestClosesTerritory(projected, enemy.id, nextContest)),
        );
        candidates.push({
          kind: "move",
          unitId: enemy.id,
          targetId: moveTarget,
          score: enablesClosure ? 86 : nextBuild || nextContest ? 62 : 28,
          reason: enablesClosure
            ? "reposiciona para fechar território no próximo passo"
            : nextBuild || nextContest
              ? "reposiciona para continuar expansão territorial"
              : "melhora posicionamento tático",
        });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score
    || a.kind.localeCompare(b.kind)
    || a.unitId.localeCompare(b.unitId)
    || a.targetId.localeCompare(b.targetId));
}

export function strategicBestGlobalAction(
  board: StrategicBoard,
  attackedUnits: ReadonlySet<StrategicUnitId> = new Set(),
  movedUnits: ReadonlySet<StrategicUnitId> = new Set(),
): StrategicAiActionCandidate | null {
  return strategicGlobalActionCandidates(board, attackedUnits, movedUnits)[0] ?? null;
}
