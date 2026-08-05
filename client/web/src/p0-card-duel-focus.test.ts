import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./pack99-combat-cinematics.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

describe("P0 direct card combat focus", () => {
  it("keeps the authoritative duel panel connected to player card selection", () => {
    expect(app).toContain("DUELO DE CÉLULA");
    expect(app).toContain("toggleDuelCard(card)");
    expect(app).toContain("client.resolveDuelRound(activeDuel.id, duelCards)");
  });

  it("promotes an active duel above the board instead of rendering it as a passive tray", () => {
    expect(css).toContain(".game-screen:has(.duel-panel) .battlefield");
    expect(css).toContain('content:"COMBATE DIRETO"');
    expect(css).toContain("position:fixed");
    expect(css).toContain("z-index:93");
  });

  it("makes selected combat cards and the confirmation action explicit", () => {
    expect(css).toContain('content:"SELECIONADA"');
    expect(css).toContain(".duel-heading .primary-button");
    expect(css).toContain(".duel-cards .card.selected");
  });
});
