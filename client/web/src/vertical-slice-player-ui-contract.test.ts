import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(new URL("./StrategicBoardSlice.tsx", import.meta.url), "utf8");
const CANONICAL_UNIT_CSS = readFileSync(new URL("./strategic-board-canonical-units.css", import.meta.url), "utf8");

function sliceBetween(source: string, startToken: string, endToken: string): string {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0 || end <= start) return "";
  return source.slice(start, end);
}

const ROSTER_SOURCE = sliceBetween(
  SOURCE,
  '<aside className="strategic-roster">',
  '<div className="strategic-actions"',
);

describe("vertical slice player-facing UI contract", () => {
  it("does not expose internal sprint or PACK 99 diagnostics to the player", () => {
    expect(SOURCE).not.toContain("META 08 · REDE E TERRITÓRIO");
    expect(SOURCE).not.toContain("PACK 99 ·");
    expect(SOURCE).not.toContain("strategic-board-status");
    expect(SOURCE).toContain("CAMPANHA · REDE E TERRITÓRIO");
  });

  it("uses resolved canonical combatant art inside the roster markup", () => {
    expect(ROSTER_SOURCE).not.toBe("");
    expect(ROSTER_SOURCE).toContain("catalog[UNIT_ASSET_KEY[unit.id]]");
    expect(ROSTER_SOURCE).toContain("<img");
    expect(ROSTER_SOURCE).toContain("draggable={false}");
    expect(SOURCE).toContain("Tabuleiro estratégico da Fronteira da Convergência");
  });

  it("crops canonical 1024px canvases into recognizable roster portraits", () => {
    expect(CANONICAL_UNIT_CSS).toContain(".strategic-roster-icon img");
    expect(CANONICAL_UNIT_CSS).toContain("object-fit: cover !important");
    expect(CANONICAL_UNIT_CSS).toContain("transform: scale(1.5)");
  });
});
