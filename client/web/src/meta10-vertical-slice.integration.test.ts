import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicBuildStructure,
  strategicClaimEdge,
  strategicEnemyTurn,
  strategicMoveTargets,
  strategicMoveUnit,
  strategicOwnedCellCount,
  strategicResult,
  strategicStructureCount,
  strategicStructureTargets,
} from "./strategic-board-model";

describe("META 10.4 strategic vertical slice foundation", () => {
  it("keeps the recommended opening, territory, bastion and live AI response playable", () => {
    let board = createStrategicBoard();

    // Rodada 1: segue exatamente a abertura recomendada pela UI.
    board = strategicClaimEdge(board, "kael", "s-1-2");
    expect(strategicMoveTargets(board, "kael")).toContain("s-1-2");
    board = strategicMoveUnit(board, "kael", "s-1-2");
    board = strategicClaimEdge(board, "kael", "s-0-2");

    expect(strategicOwnedCellCount(board, "blue")).toBe(1);
    expect(strategicStructureTargets(board, "kael")).toEqual(["sc-0-1"]);
    expect(strategicResult(board)).toBe("playing");

    // A Legião responde usando seu orçamento completo e pode abrir uma frente de confronto.
    const firstEnemyTurn = strategicEnemyTurn(board);
    board = firstEnemyTurn.board;
    expect(firstEnemyTurn.message.length).toBeGreaterThan(0);
    expect(strategicResult(board)).toBe("playing");

    // Rodada 2: a região dominada se transforma em vantagem sistêmica real.
    board = strategicBuildStructure(board, "kael", "sc-0-1", "bastion");
    expect(strategicStructureCount(board, "blue")).toBe(1);
    expect(strategicResult(board)).toBe("playing");

    // A segunda resposta da IA pode mudar posições e alvos; o contrato é que a campanha
    // continue válida. A rota completa até vitória é protegida pelo playable acceptance.
    const secondEnemyTurn = strategicEnemyTurn(board);
    board = secondEnemyTurn.board;
    expect(secondEnemyTurn.message.length).toBeGreaterThan(0);
    expect(board.units.some((unit) => unit.faction === "blue" && unit.hp > 0)).toBe(true);
    expect(strategicResult(board)).toBe("playing");
  });
});
