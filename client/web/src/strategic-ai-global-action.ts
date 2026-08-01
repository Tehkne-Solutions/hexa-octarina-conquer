import {
  strategicAttackTargets,
  strategicCellRoadProgress,
  strategicClaimEdge,
  strategicConfrontationTargets,
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

    const buildTarget = strategicPreferredBuild(board, enemy.id);
    if (buildTarget) {
      const closes = buildClosesTerritory(board, enemy.id, buildTarget);
      const projected = strategicClaimEdge(board, enemy.id, buildTarget);
      const progress = projected.cells.reduce(
        (best, cell) => Math.max(best, strategicCellRoadProgress(projected, cell.id, "red")),
        0,
      );
      candidates.push({
        kind: "build",
        unitId: enemy.id,
        targetId: buildTarget,
        score: closes ? 92 : 48 + progress * 4,
        reason: closes ? "fecha território rubro" : "aproxima uma conquista territorial",
      });
    }

    const structureTarget = strategicPreferredStructure(board, enemy.id);
    if (structureTarget && strategicStructureTargets(board, enemy.id).includes(structureTarget)) {
      candidates.push({
        kind: "structure",
        unitId: enemy.id,
        targetId: structureTarget,
        score: 64,
        reason: "fortifica fronteira e amplia orçamento futuro",
      });
    }

    if (!movedUnits.has(enemy.id)) {
      const moveTarget = strategicPreferredMove(board, enemy.id);
      if (moveTarget) {
        const critical = enemy.hp / enemy.maxHp <= 0.4;
        candidates.push({
          kind: "move",
          unitId: enemy.id,
          targetId: moveTarget,
          score: critical ? 72 : 38,
          reason: critical ? "preserva unidade crítica" : "melhora posicionamento tático",
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
