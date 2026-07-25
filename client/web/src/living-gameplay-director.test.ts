import { describe, expect, it } from "vitest";

import { buildCombatScript, speakerForMessage } from "./LivingGameplayDirector";

describe("living gameplay director", () => {
  it("maps gameplay messages to RPG speakers", () => {
    expect(speakerForMessage("Kael avançou para a ponte.").name).toBe("KAEL");
    expect(speakerForMessage("Lyra ativou o recurso do nó.").tone).toBe("ally");
    expect(speakerForMessage("Brakk invadiu o nó central.").tone).toBe("enemy");
    expect(speakerForMessage("A trilha foi criada.").name).toBe("ORÁCULO DE CAMPO");
  });

  it("builds a sequential combat script instead of a text-only result", () => {
    const script = buildCombatScript({
      playerName: "Kael",
      enemyName: "Brakk",
      playerCard: "Golpe Rúnico",
      enemyCard: "Machado das Cinzas",
      playerDamage: 7,
      enemyDamage: 3,
      playerDefeated: false,
      enemyDefeated: false,
    });

    expect(script.playerSpeech).toContain("Golpe Rúnico");
    expect(script.playerAction).toContain("7");
    expect(script.enemySpeech).toContain("Machado das Cinzas");
    expect(script.enemyAction).toContain("3");
    expect(script.aftermath).toContain("nova combinação");
  });

  it("changes the narrative when a combatant is defeated", () => {
    const victory = buildCombatScript({
      playerName: "Lyra",
      enemyName: "Varg",
      playerCard: "Chuva Prismática",
      enemyCard: "Couro Remendado",
      playerDamage: 9,
      enemyDamage: 1,
      playerDefeated: false,
      enemyDefeated: true,
    });

    expect(victory.playerSpeech).toContain("Varg");
    expect(victory.aftermath).toContain("caiu");
  });
});
