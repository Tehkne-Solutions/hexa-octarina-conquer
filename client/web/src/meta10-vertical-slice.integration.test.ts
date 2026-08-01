import { describe, expect, it } from "vitest";

import {
  createStrategicBoard,
  strategicAttack,
  strategicAttackTargets,
  strategicBuildStructure,
  strategicClaimEdge,
  strategicEnemyTurn,
  strategicMoveTargets,
  strategicMoveUnit,
  strategicOwnedCellCount,
  strategicResult,
  strategicStructureCount,
  strategicStructureTargets,
  strategicUnit,
} from "./strategic-board-model";

describe("META 10.4 complete strategic vertical slice", () => {
  it("completes the recommended conquest loop through territory, bastion, AI and combat", () => {
    let board = createStrategicBoard();

    // Rodada 1: segue exatamente a abertura recomendada pela UI.
    board = strategicClaimEdge(board, "kael", "s-1-2");
    expect(strategicMoveTargets(board, "kael")).toContain("s-1-2");
    board = strategicMoveUnit(board, "kael", "s-1-2");
    board = strategicClaimEdge(board, "kael", "s-0-2");

    expect(strategicOwnedCellCount(board, "blue")).toBe(1);
    expect(strategicStructureTargets(board, "kael")).toEqual(["sc-0-1"]);
    expect(strategicResult(board)).toBe("playing");

    // A Legião responde usando seu orçamento completo, sem encerrar artificialmente a campanha.
    board = strategicEnemyTurn(board).board;
    expect(strategicResult(board)).toBe("playing");

    // Rodada 2: transforma a região fechada em vantagem sistêmica real.
    board = strategicBuildStructure(board, "kael", "sc-0-1", "bastion");
    expect(strategicStructureCount(board, "blue")).toBe(1);
    expect(strategicResult(board)).toBe("playing");

    board = strategicEnemyTurn(board).board;
    expect(strategicResult(board)).toBe("playing");

    // Rodada 3: retorna pela rede azul e elimina o primeiro invasor por uma estrada existente.
    expect(strategicMoveTargets(board, "kael")).toContain("s-1-1");
    board = strategicMoveUnit(board, "kael", "s-1-1");
    expect(strategicMoveTargets(board, "kael")).toContain("s-0-1");
    board = strategicMoveUnit(board, "kael", "s-0-1");

    expect(strategicAttackTargets(board, "kael")).toContain("varg");
    board = strategicAttack(board, "kael", "varg");
    board = strategicAttack(board, "kael", "varg");
    expect(strategicUnit(board, "varg").hp).toBe(0);
    expect(strategicResult(board)).toBe("playing");

    board = strategicEnemyTurn(board).board;
    expect(strategicResult(board)).toBe("playing");

    // Rodada 4: o campeão final entra em alcance e a campanha chega a um resultado real.
    expect(strategicMoveTargets(board, "kael")).toContain("s-1-1");
    board = strategicMoveUnit(board, "kael", "s-1-1");
    expect(strategicAttackTargets(board, "kael")).toContain("brakk");

    board = strategicAttack(board, "kael", "brakk");
    board = strategicAttack(board, "kael", "brakk");
    board = strategicAttack(board, "kael", "brakk");

    expect(strategicUnit(board, "brakk").hp).toBe(0);
    expect(strategicOwnedCellCount(board, "blue")).toBeGreaterThanOrEqual(1);
    expect(strategicStructureCount(board, "blue")).toBeGreaterThanOrEqual(1);
    expect(strategicResult(board)).toBe("victory");
  });
});
