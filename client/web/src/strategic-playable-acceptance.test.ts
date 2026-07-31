import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicActionBudget,
  strategicAttack,
  strategicAttackTargets,
  strategicBuildStructure,
  strategicBuildTargets,
  strategicClaimEdge,
  strategicEnemyTurn,
  strategicMoveTargets,
  strategicMoveUnit,
  strategicOwnedCellCount,
  strategicResult,
  strategicRoadCount,
  strategicStructureCount,
  strategicStructureTargets,
  type StrategicBoard,
  type StrategicUnitId,
} from "./strategic-board-model";

type AcceptanceAction = "road" | "move" | "structure" | "attack" | "end-turn";

interface AcceptanceState {
  board: StrategicBoard;
  round: number;
  actions: number;
  mask: number;
  path: string[];
}

interface Candidate {
  state: AcceptanceState;
  score: number;
}

const ACTION_BITS: Record<AcceptanceAction, number> = {
  road: 1,
  move: 2,
  structure: 4,
  attack: 8,
  "end-turn": 16,
};
const REQUIRED_MASK = Object.values(ACTION_BITS).reduce((mask, bit) => mask | bit, 0);
const FRIENDLY_UNITS: StrategicUnitId[] = ["kael", "lyra"];

function boardKey(state: AcceptanceState): string {
  const edges = state.board.edges
    .map((edge) => `${edge.id}:${edge.state}:${edge.owner ?? "-"}`)
    .join("|");
  const cells = state.board.cells
    .map((cell) => `${cell.id}:${cell.owner ?? "-"}:${cell.structure?.type ?? "-"}:${cell.structure?.owner ?? "-"}`)
    .join("|");
  const units = state.board.units
    .map((unit) => `${unit.id}:${unit.nodeId}:${unit.hp}`)
    .join("|");
  return `${state.round}/${state.actions}/${state.mask}/${edges}/${cells}/${units}`;
}

function progressScore(state: AcceptanceState): number {
  const defeatedEnemies = state.board.units.filter((unit) => unit.faction === "red" && unit.hp <= 0).length;
  const damagedEnemies = state.board.units
    .filter((unit) => unit.faction === "red")
    .reduce((damage, unit) => damage + (unit.maxHp - unit.hp), 0);
  const seenMechanics = state.mask.toString(2).split("1").length - 1;
  return (strategicResult(state.board) === "victory" ? 100_000 : 0)
    + strategicOwnedCellCount(state.board, "blue") * 2_000
    + strategicStructureCount(state.board, "blue") * 1_500
    + defeatedEnemies * 1_200
    + strategicRoadCount(state.board, "blue") * 120
    + damagedEnemies * 30
    + seenMechanics * 500
    - state.round * 12
    - state.path.length;
}

function appendCandidate(
  candidates: Candidate[],
  current: AcceptanceState,
  board: StrategicBoard,
  action: AcceptanceAction,
  description: string,
  actions: number,
  round = current.round,
): void {
  const state: AcceptanceState = {
    board,
    round,
    actions,
    mask: current.mask | ACTION_BITS[action],
    path: [...current.path, description],
  };
  candidates.push({ state, score: progressScore(state) });
}

function expandState(current: AcceptanceState): Candidate[] {
  if (strategicResult(current.board) !== "playing") return [];

  const candidates: Candidate[] = [];

  if (current.actions > 0) {
    for (const unitId of FRIENDLY_UNITS) {
      const unit = current.board.units.find((entry) => entry.id === unitId);
      if (!unit || unit.hp <= 0) continue;

      for (const cellId of strategicStructureTargets(current.board, unitId)) {
        appendCandidate(
          candidates,
          current,
          strategicBuildStructure(current.board, unitId, cellId, "bastion"),
          "structure",
          `${unitId}: construir Bastião em ${cellId}`,
          current.actions - 1,
        );
      }

      for (const targetId of strategicAttackTargets(current.board, unitId)) {
        appendCandidate(
          candidates,
          current,
          strategicAttack(current.board, unitId, targetId),
          "attack",
          `${unitId}: atacar ${targetId}`,
          current.actions - 1,
        );
      }

      for (const nodeId of strategicBuildTargets(current.board, unitId)) {
        appendCandidate(
          candidates,
          current,
          strategicClaimEdge(current.board, unitId, nodeId),
          "road",
          `${unitId}: construir estrada até ${nodeId}`,
          current.actions - 1,
        );
      }

      for (const nodeId of strategicMoveTargets(current.board, unitId)) {
        appendCandidate(
          candidates,
          current,
          strategicMoveUnit(current.board, unitId, nodeId),
          "move",
          `${unitId}: mover até ${nodeId}`,
          current.actions - 1,
        );
      }
    }
  }

  if (current.round < 14) {
    const enemy = strategicEnemyTurn(current.board);
    appendCandidate(
      candidates,
      current,
      enemy.board,
      "end-turn",
      `encerrar turno: ${enemy.message}`,
      strategicActionBudget(enemy.board, "blue"),
      current.round + 1,
    );
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function findWinningAcceptancePath(): AcceptanceState | null {
  const initialBoard = createStrategicBoard();
  const initial: AcceptanceState = {
    board: initialBoard,
    round: 1,
    actions: strategicActionBudget(initialBoard, "blue"),
    mask: 0,
    path: [],
  };
  const frontier: Candidate[] = [{ state: initial, score: progressScore(initial) }];
  const visited = new Map<string, number>();
  const maxExpandedStates = 40_000;
  let expanded = 0;

  while (frontier.length > 0 && expanded < maxExpandedStates) {
    frontier.sort((a, b) => b.score - a.score);
    const current = frontier.shift()!.state;
    expanded += 1;

    const currentResult = strategicResult(current.board);
    if (currentResult === "victory" && current.mask === REQUIRED_MASK) return current;
    if (currentResult !== "playing") continue;
    if (current.path.length >= 60 || current.round > 14) continue;

    const key = boardKey(current);
    const previousDepth = visited.get(key);
    if (previousDepth !== undefined && previousDepth <= current.path.length) continue;
    visited.set(key, current.path.length);

    for (const candidate of expandState(current)) frontier.push(candidate);

    if (frontier.length > 6_000) {
      frontier.sort((a, b) => b.score - a.score);
      frontier.length = 6_000;
    }
  }

  return null;
}

describe("META 08.9 playable acceptance", () => {
  it("finds a complete legal path through every strategic mechanic and reaches victory", () => {
    const solution = findWinningAcceptancePath();

    expect(solution, "the strategic mission must remain fully winnable").not.toBeNull();
    expect(strategicResult(solution!.board)).toBe("victory");
    expect(solution!.mask).toBe(REQUIRED_MASK);
    expect(solution!.round).toBeLessThanOrEqual(14);
    expect(solution!.path.length).toBeLessThanOrEqual(60);
    expect(strategicOwnedCellCount(solution!.board, "blue")).toBeGreaterThanOrEqual(2);
    expect(strategicStructureCount(solution!.board, "blue")).toBeGreaterThanOrEqual(1);
    expect(solution!.board.units.some((unit) => unit.faction === "red" && unit.hp <= 0)).toBe(true);
  });
});
