import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicAttackTargets,
  strategicBuildTargets,
  strategicClaimEdge,
  strategicConfrontationTargets,
  strategicEnemyTurn,
  strategicMoveTargets,
  strategicUnit,
  type StrategicBoard,
} from "./strategic-board-model";

function withVargBesideKael(): StrategicBoard {
  const board = createStrategicBoard();
  return {
    ...board,
    units: board.units.map((unit) => unit.id === "varg"
      ? { ...unit, nodeId: "s-1-2" }
      : unit),
  };
}

describe("META 10.5 confrontation links", () => {
  it("lets the player build a combat route into an enemy-occupied adjacent node without moving into it", () => {
    let board = withVargBesideKael();

    expect(strategicConfrontationTargets(board, "kael")).toContain("s-1-2");
    expect(strategicBuildTargets(board, "kael")).toContain("s-1-2");

    board = strategicClaimEdge(board, "kael", "s-1-2");

    expect(strategicMoveTargets(board, "kael")).not.toContain("s-1-2");
    expect(strategicAttackTargets(board, "kael")).toContain("varg");
  });

  it("lets the AI open a confrontation route and attack within the same action budget", () => {
    const board = withVargBesideKael();
    const kaelHpBefore = strategicUnit(board, "kael").hp;
    const lyraHpBefore = strategicUnit(board, "lyra").hp;

    const turn = strategicEnemyTurn(board);
    const blueDamage = (kaelHpBefore - strategicUnit(turn.board, "kael").hp)
      + (lyraHpBefore - strategicUnit(turn.board, "lyra").hp);

    expect(turn.message).toContain("rota de confronto");
    expect(turn.message).toContain("atacou");
    expect(blueDamage).toBeGreaterThan(0);
  });
});
