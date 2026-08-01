import { strategicEnemyTurnGlobal } from "./strategic-ai-global-executor";
import {
  createStrategicBoard,
  strategicActionBudget,
  strategicAttack,
  strategicAttackTargets,
  strategicBuildStructure,
  strategicClaimEdge,
  strategicConfrontationTargets,
  strategicMoveUnit,
  strategicOwnedCellCount,
  strategicPreferredBuild,
  strategicPreferredMove,
  strategicPreferredStructure,
  strategicResult,
  strategicStructureCount,
  strategicUnit,
  type StrategicBoard,
  type StrategicResult,
  type StrategicUnitId,
} from "./strategic-board-model";

export type StrategicBalanceAiAction = "ATTACK" | "CONFRONT" | "BUILD" | "STRUCTURE" | "MOVE";

export type StrategicBalanceAiActionCounts = Record<StrategicBalanceAiAction, number>;

function emptyActionCounts(): StrategicBalanceAiActionCounts {
  return { ATTACK: 0, CONFRONT: 0, BUILD: 0, STRUCTURE: 0, MOVE: 0 };
}

function addObservedAiActions(message: string, counts: StrategicBalanceAiActionCounts): void {
  const pattern = /\[IA (ATTACK|CONFRONT|BUILD|STRUCTURE|MOVE) · score \d+\]/g;
  for (const match of message.matchAll(pattern)) {
    counts[match[1] as StrategicBalanceAiAction] += 1;
  }
}

export interface StrategicBalanceMatch {
  seed: number;
  result: StrategicResult;
  rounds: number;
  blueCells: number;
  redCells: number;
  blueStructures: number;
  redStructures: number;
  blueCasualties: number;
  redCasualties: number;
  redActionCounts: StrategicBalanceAiActionCounts;
}

export interface StrategicBalanceSummary {
  matches: number;
  victories: number;
  defeats: number;
  unresolved: number;
  averageRounds: number;
  averageBlueCells: number;
  averageRedCells: number;
  averageBlueCasualties: number;
  averageRedCasualties: number;
  redActionCounts: StrategicBalanceAiActionCounts;
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function blueTurn(board: StrategicBoard, random: () => number): StrategicBoard {
  let next = board;
  const budget = strategicActionBudget(board, "blue");
  const attackedUnits = new Set<StrategicUnitId>();
  const movedUnits = new Set<StrategicUnitId>();

  for (let action = 0; action < budget && strategicResult(next) === "playing"; action += 1) {
    const units = shuffled(
      next.units.filter((unit) => unit.faction === "blue" && unit.hp > 0).map((unit) => unit.id),
      random,
    );
    let acted = false;

    for (const unitId of units) {
      if (attackedUnits.has(unitId)) continue;
      const attacks = shuffled(strategicAttackTargets(next, unitId), random)
        .map((targetId) => strategicUnit(next, targetId))
        .sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
      if (attacks.length > 0) {
        next = strategicAttack(next, unitId, attacks[0].id);
        attackedUnits.add(unitId);
        acted = true;
        break;
      }
    }
    if (acted) continue;

    for (const unitId of units) {
      const target = strategicPreferredStructure(next, unitId);
      if (target) {
        next = strategicBuildStructure(next, unitId, target, "bastion");
        acted = true;
        break;
      }
    }
    if (acted) continue;

    for (const unitId of units) {
      const confrontations = shuffled(strategicConfrontationTargets(next, unitId), random);
      if (confrontations.length > 0) {
        next = strategicClaimEdge(next, unitId, confrontations[0]);
        acted = true;
        break;
      }
    }
    if (acted) continue;

    for (const unitId of units) {
      const target = strategicPreferredBuild(next, unitId);
      if (target) {
        next = strategicClaimEdge(next, unitId, target);
        acted = true;
        break;
      }
    }
    if (acted) continue;

    for (const unitId of units) {
      if (movedUnits.has(unitId)) continue;
      const target = strategicPreferredMove(next, unitId);
      if (target) {
        next = strategicMoveUnit(next, unitId, target);
        movedUnits.add(unitId);
        acted = true;
        break;
      }
    }

    if (!acted) break;
  }

  return next;
}

export function simulateStrategicMatch(seed: number, maxRounds = 24): StrategicBalanceMatch {
  const random = seeded(seed);
  let board = createStrategicBoard();
  let rounds = 0;
  const redActionCounts = emptyActionCounts();

  while (rounds < maxRounds && strategicResult(board) === "playing") {
    rounds += 1;
    board = blueTurn(board, random);
    if (strategicResult(board) !== "playing") break;
    const redTurn = strategicEnemyTurnGlobal(board);
    addObservedAiActions(redTurn.message, redActionCounts);
    board = redTurn.board;
  }

  return {
    seed,
    result: strategicResult(board),
    rounds,
    blueCells: strategicOwnedCellCount(board, "blue"),
    redCells: strategicOwnedCellCount(board, "red"),
    blueStructures: strategicStructureCount(board, "blue"),
    redStructures: strategicStructureCount(board, "red"),
    blueCasualties: board.units.filter((unit) => unit.faction === "blue" && unit.hp <= 0).length,
    redCasualties: board.units.filter((unit) => unit.faction === "red" && unit.hp <= 0).length,
    redActionCounts,
  };
}

export function simulateStrategicBalance(matches = 100, seedOffset = 1): StrategicBalanceSummary {
  const results = Array.from({ length: matches }, (_, index) => simulateStrategicMatch(seedOffset + index));
  const sum = (selector: (match: StrategicBalanceMatch) => number) => results.reduce((total, match) => total + selector(match), 0);
  const redActionCounts = emptyActionCounts();
  for (const match of results) {
    for (const kind of Object.keys(redActionCounts) as StrategicBalanceAiAction[]) {
      redActionCounts[kind] += match.redActionCounts[kind];
    }
  }

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
