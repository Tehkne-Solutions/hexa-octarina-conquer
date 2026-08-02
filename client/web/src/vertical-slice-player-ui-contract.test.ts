import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(new URL("./StrategicBoardSlice.tsx", import.meta.url), "utf8");

describe("vertical slice player-facing UI contract", () => {
  it("does not expose internal sprint or PACK 99 diagnostics to the player", () => {
    expect(SOURCE).not.toContain("META 08 · REDE E TERRITÓRIO");
    expect(SOURCE).not.toContain("PACK 99 ·");
    expect(SOURCE).not.toContain("strategic-board-status");
    expect(SOURCE).toContain("CAMPANHA · REDE E TERRITÓRIO");
  });

  it("uses resolved canonical combatant art in the roster", () => {
    expect(SOURCE).toContain("catalog[UNIT_ASSET_KEY[unit.id]]");
    expect(SOURCE).toContain("draggable={false}");
    expect(SOURCE).toContain("Tabuleiro estratégico da Fronteira da Convergência");
  });
});
