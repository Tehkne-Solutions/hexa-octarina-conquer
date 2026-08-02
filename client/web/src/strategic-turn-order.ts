import { strategicEnemyTurnGlobal } from "./strategic-ai-global-executor";
import { strategicActionBudget, strategicResult, strategicUnit, type StrategicBoard, type StrategicUnitId } from "./strategic-board-model";
import {
  strategicNextRoundStarter,
  type StrategicRoundStarter,
} from "./strategic-balanced-opening";

const FRIENDLY_UNITS: StrategicUnitId[] = ["kael", "lyra"];

export interface StrategicRoundTransition {
  board: StrategicBoard;
  nextRound: number;
  nextStarter: StrategicRoundStarter;
  playerActions: number;
  selectedUnitId: StrategicUnitId;
  enemyMessage: string | null;
}

export function strategicBeginRound(
  board: StrategicBoard,
  round: number,
  starter: StrategicRoundStarter,
): StrategicRoundTransition {
  let nextBoard = board;
  let enemyMessage: string | null = null;

  if (starter === "red" && strategicResult(nextBoard) === "playing") {
    const enemy = strategicEnemyTurnGlobal(nextBoard);
    nextBoard = enemy.board;
    enemyMessage = enemy.message;
  }

  const survivor = FRIENDLY_UNITS.find((id) => strategicUnit(nextBoard, id).hp > 0) ?? "kael";

  return {
    board: nextBoard,
    nextRound: round,
    nextStarter: starter,
    playerActions: strategicResult(nextBoard) === "playing" ? strategicActionBudget(nextBoard, "blue") : 0,
    selectedUnitId: survivor,
    enemyMessage,
  };
}

export function strategicEndPlayerTurn(
  board: StrategicBoard,
  round: number,
  starter: StrategicRoundStarter,
): StrategicRoundTransition {
  let nextBoard = board;
  let enemyMessage: string | null = null;

  if (starter === "blue" && strategicResult(nextBoard) === "playing") {
    const enemy = strategicEnemyTurnGlobal(nextBoard);
    nextBoard = enemy.board;
    enemyMessage = enemy.message;
  }

  const nextRound = round + 1;
  const nextStarter = strategicNextRoundStarter(starter);
  return strategicBeginRound(nextBoard, nextRound, nextStarter);
}
