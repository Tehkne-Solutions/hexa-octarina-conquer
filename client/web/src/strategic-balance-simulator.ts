import { strategicEnemyTurnGlobal } from "./strategic-ai-global-executor";
import {
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
  type StrategicResult,
  type StrategicUnitId,
} from "./strategic-board-model";
import { createBalancedStrategicBoard } from "./strategic-balanced-opening";
import { strategicContestRoute, strategicContestTargets } from "./strategic-route-contest";

export type StrategicBalanceAiAction = "ATTACK" | "CONFRONT" | "BUILD" | "STRUCTURE" | "MOVE";
export type StrategicFirstFaction = "blue" | "red";
export type StrategicBalanceInitiativeMode = StrategicFirstFaction | "alternating";
export type StrategicBalanceAiActionCounts = Record<StrategicBalanceAiAction, number>;

type BlueCandidateKind = "attack" | "confront" | "build" | "structure" | "move";
interface BlueCandidate { kind: BlueCandidateKind; unitId: StrategicUnitId; targetId: string; score: number; }

function emptyActionCounts(): StrategicBalanceAiActionCounts {
  return { ATTACK: 0, CONFRONT: 0, BUILD: 0, STRUCTURE: 0, MOVE: 0 };
}

function addObservedAiActions(debugTrace: string | undefined, counts: StrategicBalanceAiActionCounts): void {
  const pattern = /\[IA (ATTACK|CONFRONT|BUILD|STRUCTURE|MOVE) · score \d+\]/g;
  for (const match of (debugTrace ?? "").matchAll(pattern)) counts[match[1] as StrategicBalanceAiAction] += 1;
}

export interface StrategicBalanceMatch {
  seed: number; firstFaction: StrategicFirstFaction; result: StrategicResult; rounds: number;
  blueCells: number; redCells: number; blueStructures: number; redStructures: number;
  blueCasualties: number; redCasualties: number; redActionCounts: StrategicBalanceAiActionCounts;
}

export interface StrategicBalanceSummary {
  matches: number; victories: number; defeats: number; unresolved: number; averageRounds: number;
  averageBlueCells: number; averageRedCells: number; averageBlueCasualties: number; averageRedCasualties: number;
  redActionCounts: StrategicBalanceAiActionCounts;
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; };
}

function buildClosesBlueTerritory(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): boolean {
  const before = strategicOwnedCellCount(board, "blue");
  return strategicOwnedCellCount(strategicClaimEdge(board, unitId, targetNodeId), "blue") > before;
}

function buildBlueProgress(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): number {
  const unit = strategicUnit(board, unitId);
  const edgeId = strategicEdgeId(unit.nodeId, targetNodeId);
  const projected = strategicClaimEdge(board, unitId, targetNodeId);
  return projected.cells.filter((cell) => cell.edgeIds.includes(edgeId))
    .reduce((best, cell) => Math.max(best, strategicCellRoadProgress(projected, cell.id, "blue")), 0);
}

function contestClosesBlueTerritory(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): boolean {
  const before = strategicOwnedCellCount(board, "blue");
  return strategicOwnedCellCount(strategicContestRoute(board, unitId, targetNodeId), "blue") > before;
}

function contestBlueProgress(board: StrategicBoard, unitId: StrategicUnitId, targetNodeId: string): number {
  const unit = strategicUnit(board, unitId);
  const edgeId = strategicEdgeId(unit.nodeId, targetNodeId);
  const projected = strategicContestRoute(board, unitId, targetNodeId);
  return projected.cells.filter((cell) => cell.edgeIds.includes(edgeId))
    .reduce((best, cell) => Math.max(best, strategicCellRoadProgress(projected, cell.id, "blue")), 0);
}

function blueCandidates(board: StrategicBoard, attacked: ReadonlySet<StrategicUnitId>, moved: ReadonlySet<StrategicUnitId>): BlueCandidate[] {
  const candidates: BlueCandidate[] = [];
  for (const unit of board.units.filter((entry) => entry.faction === "blue" && entry.hp > 0)) {
    if (!attacked.has(unit.id)) {
      for (const targetId of strategicAttackTargets(board, unit.id)) {
        const target = strategicUnit(board, targetId);
        const missingHp = target.maxHp - target.hp;
        candidates.push({ kind: "attack", unitId: unit.id, targetId, score: 100 + missingHp + (target.hp <= 5 ? 40 : 0) });
      }
    }

    for (const nodeId of strategicConfrontationTargets(board, unit.id)) {
      const target = strategicUnitAt(board, nodeId);
      candidates.push({ kind: "confront", unitId: unit.id, targetId: nodeId, score: 78 + (target ? target.maxHp - target.hp : 0) });
    }

    for (const targetId of strategicContestTargets(board, unit.id)) {
      const closes = contestClosesBlueTerritory(board, unit.id, targetId);
      const progress = contestBlueProgress(board, unit.id, targetId);
      candidates.push({ kind: "build", unitId: unit.id, targetId, score: closes ? 99 : progress >= 3 ? 93 : progress >= 2 ? 80 : 66 });
    }

    const buildTarget = strategicPreferredBuild(board, unit.id);
    if (buildTarget) {
      const closes = buildClosesBlueTerritory(board, unit.id, buildTarget);
      const progress = buildBlueProgress(board, unit.id, buildTarget);
      candidates.push({ kind: "build", unitId: unit.id, targetId: buildTarget, score: closes ? 98 : progress >= 3 ? 94 : progress >= 2 ? 78 : 60 });
    }

    const structureTarget = strategicPreferredStructure(board, unit.id);
    if (structureTarget && strategicStructureTargets(board, unit.id).includes(structureTarget)) {
      candidates.push({ kind: "structure", unitId: unit.id, targetId: structureTarget, score: 84 });
    }

    if (!moved.has(unit.id)) {
      const critical = unit.hp / unit.maxHp <= 0.4;
      const retreatTarget = critical ? strategicPreferredMove(board, unit.id) : null;
      for (const moveTarget of strategicMoveTargets(board, unit.id)) {
        if (critical) {
          candidates.push({ kind: "move", unitId: unit.id, targetId: moveTarget, score: moveTarget === retreatTarget ? 72 : 30 });
          continue;
        }
        const projected = strategicMoveUnit(board, unit.id, moveTarget);
        const nextBuild = strategicPreferredBuild(projected, unit.id);
        const nextContest = strategicContestTargets(projected, unit.id)[0] ?? null;
        const enablesClosure = Boolean(
          (nextBuild && buildClosesBlueTerritory(projected, unit.id, nextBuild))
          || (nextContest && contestClosesBlueTerritory(projected, unit.id, nextContest)),
        );
        candidates.push({ kind: "move", unitId: unit.id, targetId: moveTarget, score: enablesClosure ? 86 : nextBuild || nextContest ? 62 : 28 });
      }
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind) || a.unitId.localeCompare(b.unitId) || a.targetId.localeCompare(b.targetId));
}

function blueTurn(board: StrategicBoard, _random: () => number): StrategicBoard {
  let next = board;
  const budget = strategicActionBudget(board, "blue");
  const attackedUnits = new Set<StrategicUnitId>();
  const movedUnits = new Set<StrategicUnitId>();
  for (let action = 0; action < budget && strategicResult(next) === "playing"; action += 1) {
    const selected = blueCandidates(next, attackedUnits, movedUnits)[0];
    if (!selected) break;
    if (selected.kind === "attack") { next = strategicAttack(next, selected.unitId, selected.targetId as StrategicUnitId); attackedUnits.add(selected.unitId); continue; }
    if (selected.kind === "confront") { next = strategicClaimEdge(next, selected.unitId, selected.targetId); continue; }
    if (selected.kind === "build") {
      next = strategicContestTargets(next, selected.unitId).includes(selected.targetId)
        ? strategicContestRoute(next, selected.unitId, selected.targetId)
        : strategicClaimEdge(next, selected.unitId, selected.targetId);
      continue;
    }
    if (selected.kind === "structure") { next = strategicBuildStructure(next, selected.unitId, selected.targetId, "bastion"); continue; }
    next = strategicMoveUnit(next, selected.unitId, selected.targetId); movedUnits.add(selected.unitId);
  }
  return next;
}

function redTurn(board: StrategicBoard, counts: StrategicBalanceAiActionCounts): StrategicBoard {
  const result = strategicEnemyTurnGlobal(board);
  addObservedAiActions(result.debugTrace, counts);
  return result.board;
}

export function simulateStrategicMatch(seed: number, maxRounds = 24, firstFaction: StrategicFirstFaction = "blue"): StrategicBalanceMatch {
  const random = seeded(seed);
  let board = createBalancedStrategicBoard();
  let rounds = 0;
  const redActionCounts = emptyActionCounts();
  while (rounds < maxRounds && strategicResult(board) === "playing") {
    rounds += 1;
    if (firstFaction === "red") {
      board = redTurn(board, redActionCounts);
      if (strategicResult(board) !== "playing") break;
      board = blueTurn(board, random);
      continue;
    }
    board = blueTurn(board, random);
    if (strategicResult(board) !== "playing") break;
    board = redTurn(board, redActionCounts);
  }
  return {
    seed, firstFaction, result: strategicResult(board), rounds,
    blueCells: strategicOwnedCellCount(board, "blue"), redCells: strategicOwnedCellCount(board, "red"),
    blueStructures: strategicStructureCount(board, "blue"), redStructures: strategicStructureCount(board, "red"),
    blueCasualties: board.units.filter((unit) => unit.faction === "blue" && unit.hp <= 0).length,
    redCasualties: board.units.filter((unit) => unit.faction === "red" && unit.hp <= 0).length,
    redActionCounts,
  };
}

export function simulateStrategicBalance(
  matches = 100,
  seedOffset = 1,
  initiative: StrategicBalanceInitiativeMode = "alternating",
): StrategicBalanceSummary {
  const results = Array.from({ length: matches }, (_, index) => {
    const firstFaction: StrategicFirstFaction = initiative === "alternating"
      ? (index % 2 === 0 ? "blue" : "red")
      : initiative;
    return simulateStrategicMatch(seedOffset + index, 24, firstFaction);
  });
  const sum = (selector: (match: StrategicBalanceMatch) => number) => results.reduce((total, match) => total + selector(match), 0);
  const redActionCounts = emptyActionCounts();
  for (const match of results) for (const kind of Object.keys(redActionCounts) as StrategicBalanceAiAction[]) redActionCounts[kind] += match.redActionCounts[kind];
  return {
    matches,
    victories: results.filter((match) => match.result === "victory").length,
    defeats: results.filter((match) => match.result === "defeat").length,
    unresolved: results.filter((match) => match.result === "playing").length,
    averageRounds: matches > 0 ? sum((match) => match.rounds) / matches : 0,
    averageBlueCells: matches > 0 ? sum((match) => match.blueCells) / matches : 0,
    averageRedCells: matches > 0 ? sum((match) => match.redCells) / matches : 0,
    averageBlueCasualties: matches > 0 ? sum((match) => match.blueCasualties) / matches : 0,
    averageRedCasualties: matches > 0 ? sum((match) => match.redCasualties) / matches : 0,
    redActionCounts,
  };
}
