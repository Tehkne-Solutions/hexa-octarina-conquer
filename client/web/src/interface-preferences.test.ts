import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTERFACE_PREFERENCES,
  interfacePreferenceClassNames,
  readInterfacePreferences,
  writeInterfacePreferences,
} from "./interface-preferences";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    snapshot: () => Object.fromEntries(values),
  };
}

describe("interface preferences", () => {
  it("uses safe defaults for a new player", () => {
    const storage = memoryStorage();
    expect(readInterfacePreferences(storage)).toEqual(DEFAULT_INTERFACE_PREFERENCES);
  });

  it("reads and persists accessibility settings", () => {
    const storage = memoryStorage({
      "hexa.settings.reduced-motion": "true",
      "hexa.settings.high-contrast": "true",
      "hexa.settings.large-text": "true",
    });
    const preferences = readInterfacePreferences(storage);
    expect(preferences.reducedMotion).toBe(true);
    expect(preferences.highContrast).toBe(true);
    expect(preferences.largeText).toBe(true);

    writeInterfacePreferences({ ...preferences, lowEffects: true }, storage);
    expect(storage.snapshot()["hexa.settings.low-effects"]).toBe("true");
  });

  it("returns only the classes enabled by the player", () => {
    expect(interfacePreferenceClassNames({
      ...DEFAULT_INTERFACE_PREFERENCES,
      highContrast: true,
      lowEffects: true,
    })).toEqual(["hexa-high-contrast", "hexa-low-effects"]);
  });
});
