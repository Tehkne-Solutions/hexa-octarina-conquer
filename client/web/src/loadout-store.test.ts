import { afterEach, describe, expect, it } from "vitest";

import { INITIAL_LIVING_UNITS } from "./living-board-data";
import {
  FIXED_TACTIC_IDS,
  activeLoadout,
  applyActiveLoadoutToLivingUnits,
  authoritativeHandPreview,
  cardOrigin,
  readLoadoutCollection,
  saveLoadoutCollection,
  validateLoadout,
  type LoadoutCollection,
} from "./loadout-store";

const VALID_LOADOUT = [
  "kael-golpe-runico",
  "kael-golpe-runico",
  "kael-guardiao-celeste",
  "lyra-flecha-eter",
  "lyra-flecha-eter",
];

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

const originalDecks = new Map(INITIAL_LIVING_UNITS.map((unit) => [unit.id, [...unit.deck]]));

afterEach(() => {
  for (const unit of INITIAL_LIVING_UNITS) unit.deck = [...(originalDecks.get(unit.id) ?? [])];
});

describe("loadout store", () => {
  it("validates a balanced five-card combat loadout", () => {
    expect(validateLoadout(VALID_LOADOUT)).toMatchObject({
      valid: true,
      totalEnergy: 5,
      guardianCards: 3,
      archerCards: 2,
      uniqueCards: 3,
    });
  });

  it("rejects excessive copies, missing roles and excessive energy", () => {
    expect(validateLoadout([
      "kael-golpe-runico",
      "kael-golpe-runico",
      "kael-golpe-runico",
      "lyra-flecha-eter",
      "lyra-flecha-eter",
    ]).errors).toContain("Use no máximo 2 cópias da mesma carta.");

    expect(validateLoadout([
      "kael-golpe-runico",
      "kael-guardiao-celeste",
      "kael-contra-selo",
      "kael-muralha-astral",
      "lyra-flecha-eter",
    ]).errors).toContain("Inclua ao menos 2 cartas de Lyra.");

    expect(validateLoadout([
      "kael-contra-selo",
      "kael-muralha-astral",
      "lyra-marca-cacada",
      "lyra-chuva-prismatica",
      "lyra-chuva-prismatica",
    ]).errors).toContain("O custo total deve ser de até 9 de energia.");
  });

  it("persists the active deck and previews fixed authoritative tactics", () => {
    const storage = new MemoryStorage();
    const initial = readLoadoutCollection(storage);
    const deck = activeLoadout(initial);
    const collection: LoadoutCollection = {
      ...initial,
      decks: [{ ...deck, cardIds: VALID_LOADOUT, name: "Linha Prismática", updatedAt: Date.now() }],
    };
    saveLoadoutCollection(collection, storage);
    const restored = readLoadoutCollection(storage);
    expect(activeLoadout(restored).name).toBe("Linha Prismática");
    expect(activeLoadout(restored).cardIds).toEqual(VALID_LOADOUT);
    expect(authoritativeHandPreview(VALID_LOADOUT)).toEqual([...FIXED_TACTIC_IDS, ...VALID_LOADOUT]);
  });

  it("applies the active deck to Kael and Lyra in the living campaign", () => {
    const initial = readLoadoutCollection(null);
    const deck = activeLoadout(initial);
    const collection: LoadoutCollection = {
      ...initial,
      decks: [{ ...deck, cardIds: VALID_LOADOUT, updatedAt: Date.now() }],
    };
    applyActiveLoadoutToLivingUnits(collection);
    expect(INITIAL_LIVING_UNITS.find((unit) => unit.id === "kael")?.deck).toEqual([
      "kael-golpe-runico",
      "kael-golpe-runico",
      "kael-guardiao-celeste",
    ]);
    expect(INITIAL_LIVING_UNITS.find((unit) => unit.id === "lyra")?.deck).toEqual([
      "lyra-flecha-eter",
      "lyra-flecha-eter",
    ]);
  });

  it("records the campaign origin of progression cards", () => {
    expect(cardOrigin("lyra-passo-lunar")).toMatchObject({
      mission: "A Ponte das Cinzas",
      requirement: "Concluir o objetivo 1",
    });
    expect(cardOrigin("kael-muralha-astral").requirement).toBe("Concluir a missão");
  });
});
