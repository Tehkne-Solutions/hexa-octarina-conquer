import { describe, expect, it } from "vitest";

import { createBalancedStrategicBoard } from "./strategic-balanced-opening";
import { strategicBeginRound, strategicEndPlayerTurn } from "./strategic-turn-order";

function snapshot(board = createBalancedStrategicBoard()) {
  return {
    redRoads: board.edges.filter((edge) => edge.owner === "red" && edge.state === "road").length,
    blueRoads: board.edges.filter((edge) => edge.owner === "blue" && edge.state === "road").length,
    redHp: board.units.filter((unit) => unit.faction === "red").reduce((total, unit) => total + unit.hp, 0),
    blueHp: board.units.filter((unit) => unit.faction === "blue").reduce((total, unit) => total + unit.hp, 0),
  };
}

describe("META 10.26B strategic turn order", () => {
  it("lets Red act before the player on a red-start round", () => {
    const board = createBalancedStrategicBoard();
    const before = snapshot(board);
    const transition = strategicBeginRound(board, 1, "red");
    const after = snapshot(transition.board);

    expect(transition.nextRound).toBe(1);
    expect(transition.nextStarter).toBe("red");
    expect(transition.enemyMessage).not.toBeNull();
    expect(after).not.toEqual(before);
    expect(transition.playerActions).toBeGreaterThan(0);
  });

  it("keeps the board untouched before the player on a blue-start round", () => {
    const board = createBalancedStrategicBoard();
    const transition = strategicBeginRound(board, 1, "blue");

    expect(snapshot(transition.board)).toEqual(snapshot(board));
    expect(transition.enemyMessage).toBeNull();
    expect(transition.nextStarter).toBe("blue");
  });

  it("executes Red after a blue-start player turn and flips next-round priority", () => {
    const board = createBalancedStrategicBoard();
    const transition = strategicEndPlayerTurn(board, 1, "blue");

    expect(transition.nextRound).toBe(2);
    expect(transition.nextStarter).toBe("red");
    expect(transition.enemyMessage).not.toBeNull();
  });

  it("does not execute Red twice when Red already started the round", () => {
    const opened = strategicBeginRound(createBalancedStrategicBoard(), 1, "red");
    const afterPlayer = strategicEndPlayerTurn(opened.board, 1, "red");

    expect(afterPlayer.nextRound).toBe(2);
    expect(afterPlayer.nextStarter).toBe("blue");
    expect(afterPlayer.enemyMessage).toBeNull();
  });
});
