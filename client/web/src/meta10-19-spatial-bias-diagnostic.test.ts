import { describe, expect, it } from "vitest";

import { strategicEnemyTurnGlobal } from "./strategic-ai-global-executor";
import {
  createStrategicBoard,
  strategicActionBudget,
  strategicAttack,
  strategicAttackTargets,
  strategicBuildStructure,
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
  strategicResult,
  strategicStructureCount,
  strategicStructureTargets,
  strategicUnit,
  strategicUnitAt,
  type StrategicBoard,
  type StrategicUnitId,
} from "./strategic-board-model";
import { strategicContestRoute, strategicContestTargets } from "./strategic-route-contest";

type CandidateKind = "attack" | "confront" | "build" | "structure" | "move";
interface Candidate { kind: CandidateKind; unitId: StrategicUnitId; targetId: string; score: number; }

function buildCloses(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): boolean {
  const before = strategicOwnedCellCount(board, "blue");
  return strategicOwnedCellCount(strategicClaimEdge(board, unitId, targetNodeId), "blue") > before;
}

function buildProgress(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): number {
  const unit = strategicUnit(board, unitId);
  const edgeId = strategicEdgeId(unit.nodeId, targetNodeId);
  const projected = strategicClaimEdge(board, unitId, targetNodeId);
  return projected.cells.filter((cell) => cell.edgeIds.includes(edgeId))
    .reduce((best, cell) => Math.max(best, strategicCellRoadProgress(projected, cell.id, "blue")), 0);
}

function contestCloses(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): boolean {
  const before = strategicOwnedCellCount(board, "blue");
  return strategicOwnedCellCount(strategicContestRoute(board, unitId, targetNodeId), "blue") > before;
}

function contestProgress(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): number {
  const unit = strategicUnit(board, unitId);
  const edgeId = strategicEdgeId(unit.nodeId, targetNodeId);
  const projected = strategicContestRoute(board, unitId, targetNodeId);
  return projected.cells.filter((cell) => cell.edgeIds.includes(edgeId))
    .reduce((best, cell) => Math.max(best, strategicCellRoadProgress(projected, cell.id, "blue")), 0);
}

function candidates(board: StrategicBoard, attacked: ReadonlySet<StrategicUnitId>, moved: ReadonlySet<StrategicUnitId>): Candidate[] {
  const result: Candidate[] = [];
  for (const unit of board.units.filter((entry) => entry.faction === "blue" && entry.hp > 0)) {
    if (!attacked.has(unit.id)) {
      for (const targetId of strategicAttackTargets(board, unit.id)) {
        const target = strategicUnit(board, targetId);
        result.push({ kind: "attack", unitId: unit.id, targetId, score: 100 + (target.maxHp - target.hp) + (target.hp <= 5 ? 40 : 0) });
      }
    }
    for (const nodeId of strategicConfrontationTargets(board, unit.id)) {
      const target = strategicUnitAt(board, nodeId);
      result.push({ kind: "confront", unitId: unit.id, targetId: nodeId, score: 78 + (target ? target.maxHp - target.hp : 0) });
    }
    for (const targetId of strategicContestTargets(board, unit.id)) {
      const closes = contestCloses(board, unit.id, targetId);
      const progress = contestProgress(board, unit.id, targetId);
      result.push({ kind: "build", unitId: unit.id, targetId, score: closes ? 99 : progress >= 3 ? 93 : progress >= 2 ? 80 : 66 });
    }
    const buildTarget = strategicPreferredBuild(board, unit.id);
    if (buildTarget) {
      const closes = buildCloses(board, unit.id, buildTarget);
      const progress = buildProgress(board, unit.id, buildTarget);
      result.push({ kind: "build", unitId: unit.id, targetId: buildTarget, score: closes ? 98 : progress >= 3 ? 94 : progress >= 2 ? 78 : 60 });
    }
    const structureTarget = strategicPreferredStructure(board, unit.id);
    if (structureTarget && strategicStructureTargets(board, unit.id).includes(structureTarget)) {
      result.push({ kind: "structure", unitId: unit.id, targetId: structureTarget, score: 84 });
    }
    if (!moved.has(unit.id)) {
      const critical = unit.hp / unit.maxHp <= 0.4;
      const retreat = critical ? strategicPreferredMove(board, unit.id) : null;
      for (const targetId of strategicMoveTargets(board, unit.id)) {
        if (critical) {
          result.push({ kind: "move", unitId: unit.id, targetId, score: targetId === retreat ? 72 : 30 });
          continue;
        }
        const projected = strategicMoveUnit(board, unit.id, targetId);
        const nextBuild = strategicPreferredBuild(projected, unit.id);
        const nextContest = strategicContestTargets(projected, unit.id)[0] ?? null;
        const closes = Boolean((nextBuild && buildCloses(projected, unit.id, nextBuild)) || (nextContest && contestCloses(projected, unit.id, nextContest)));
        result.push({ kind: "move", unitId: unit.id, targetId, score: closes ? 86 : nextBuild || nextContest ? 62 : 28 });
      }
    }
  }
  return result.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind) || a.unitId.localeCompare(b.unitId) || a.targetId.localeCompare(b.targetId));
}

function blueTurn(board: StrategicBoard): StrategicBoard {
  let next = board;
  const attacked = new Set<StrategicUnitId>();
  const moved = new Set<StrategicUnitId>();
  const budget = strategicActionBudget(board, "blue");
  for (let index = 0; index < budget && strategicResult(next) === "playing"; index += 1) {
    const selected = candidates(next, attacked, moved)[0];
    if (!selected) break;
    if (selected.kind === "attack") { next = strategicAttack(next, selected.unitId, selected.targetId as StrategicUnitId); attacked.add(selected.unitId); continue; }
    if (selected.kind === "confront") { next = strategicClaimEdge(next, selected.unitId, selected.targetId); continue; }
    if (selected.kind === "build") { next = strategicContestTargets(next, selected.unitId).includes(selected.targetId) ? strategicContestRoute(next, selected.unitId, selected.targetId) : strategicClaimEdge(next, selected.unitId, selected.targetId); continue; }
    if (selected.kind === "structure") { next = strategicBuildStructure(next, selected.unitId, selected.targetId, "bastion"); continue; }
    next = strategicMoveUnit(next, selected.unitId, selected.targetId); moved.add(selected.unitId);
  }
  return next;
}

function swapSetup(board: StrategicBoard): StrategicBoard {
  const nodeByUnit = new Map(board.units.map((unit) => [unit.id, unit.nodeId]));
  const pairs: Record<StrategicUnitId, StrategicUnitId> = { kael: "brakk", brakk: "kael", lyra: "varg", varg: "lyra" };
  return {
    ...board,
    edges: board.edges.map((edge) => ({ ...edge, owner: edge.owner === "blue" ? "red" : edge.owner === "red" ? "blue" : null })),
    units: board.units.map((unit) => ({ ...unit, nodeId: nodeByUnit.get(pairs[unit.id])! })),
  };
}

function play(initial: StrategicBoard, first: "blue" | "red" = "blue", maxRounds = 24) {
  let board = initial;
  let rounds = 0;
  while (rounds < maxRounds && strategicResult(board) === "playing") {
    rounds += 1;
    if (first === "red") {
      board = strategicEnemyTurnGlobal(board).board;
      if (strategicResult(board) !== "playing") break;
      board = blueTurn(board);
    } else {
      board = blueTurn(board);
      if (strategicResult(board) !== "playing") break;
      board = strategicEnemyTurnGlobal(board).board;
    }
  }
  return {
    result: strategicResult(board),
    rounds,
    blueCells: strategicOwnedCellCount(board, "blue"),
    redCells: strategicOwnedCellCount(board, "red"),
    blueStructures: strategicStructureCount(board, "blue"),
    redStructures: strategicStructureCount(board, "red"),
  };
}

describe("META 10.19 spatial setup A/B", () => {
  it("compares current and swapped spatial setups with identical rules", () => {
    const current = play(createStrategicBoard());
    const swapped = play(swapSetup(createStrategicBoard()));
    const swappedRedFirst = play(swapSetup(createStrategicBoard()), "red");

    console.log(`HOC_STRATEGIC_SPATIAL_AB=${JSON.stringify({ current, swapped, swappedRedFirst })}`);

    expect(current.rounds).toBeGreaterThan(0);
    expect(swapped.rounds).toBeGreaterThan(0);
    expect(swappedRedFirst.rounds).toBeGreaterThan(0);
  });
});
