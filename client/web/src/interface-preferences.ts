export interface InterfacePreferences {
  reducedMotion: boolean;
  denseInterface: boolean;
  contextualTutorial: boolean;
  highContrast: boolean;
  largeText: boolean;
  lowEffects: boolean;
  experienceTelemetry: boolean;
}

export const INTERFACE_PREFERENCE_KEYS = {
  reducedMotion: "hexa.settings.reduced-motion",
  denseInterface: "hexa.settings.dense-interface",
  contextualTutorial: "hexa.settings.contextual-tutorial",
  highContrast: "hexa.settings.high-contrast",
  largeText: "hexa.settings.large-text",
  lowEffects: "hexa.settings.low-effects",
  experienceTelemetry: "hexa.settings.experience-telemetry",
} as const;

export const DEFAULT_INTERFACE_PREFERENCES: InterfacePreferences = {
  reducedMotion: false,
  denseInterface: false,
  contextualTutorial: true,
  highContrast: false,
  largeText: false,
  lowEffects: false,
  experienceTelemetry: true,
};

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

function readBoolean(storage: ReadableStorage, key: string, fallback: boolean): boolean {
  const value = storage.getItem(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function readInterfacePreferences(
  storage: ReadableStorage = window.localStorage,
): InterfacePreferences {
  return {
    reducedMotion: readBoolean(storage, INTERFACE_PREFERENCE_KEYS.reducedMotion, false),
    denseInterface: readBoolean(storage, INTERFACE_PREFERENCE_KEYS.denseInterface, false),
    contextualTutorial: readBoolean(storage, INTERFACE_PREFERENCE_KEYS.contextualTutorial, true),
    highContrast: readBoolean(storage, INTERFACE_PREFERENCE_KEYS.highContrast, false),
    largeText: readBoolean(storage, INTERFACE_PREFERENCE_KEYS.largeText, false),
    lowEffects: readBoolean(storage, INTERFACE_PREFERENCE_KEYS.lowEffects, false),
    experienceTelemetry: readBoolean(storage, INTERFACE_PREFERENCE_KEYS.experienceTelemetry, true),
  };
}

export function writeInterfacePreferences(
  preferences: InterfacePreferences,
  storage: WritableStorage = window.localStorage,
): void {
  storage.setItem(INTERFACE_PREFERENCE_KEYS.reducedMotion, String(preferences.reducedMotion));
  storage.setItem(INTERFACE_PREFERENCE_KEYS.denseInterface, String(preferences.denseInterface));
  storage.setItem(INTERFACE_PREFERENCE_KEYS.contextualTutorial, String(preferences.contextualTutorial));
  storage.setItem(INTERFACE_PREFERENCE_KEYS.highContrast, String(preferences.highContrast));
  storage.setItem(INTERFACE_PREFERENCE_KEYS.largeText, String(preferences.largeText));
  storage.setItem(INTERFACE_PREFERENCE_KEYS.lowEffects, String(preferences.lowEffects));
  storage.setItem(INTERFACE_PREFERENCE_KEYS.experienceTelemetry, String(preferences.experienceTelemetry));
}

export function interfacePreferenceClassNames(preferences: InterfacePreferences): string[] {
  const classes: string[] = [];
  if (preferences.reducedMotion) classes.push("hexa-reduced-motion");
  if (preferences.denseInterface) classes.push("hexa-dense-interface");
  if (preferences.highContrast) classes.push("hexa-high-contrast");
  if (preferences.largeText) classes.push("hexa-large-text");
  if (preferences.lowEffects) classes.push("hexa-low-effects");
  return classes;
}

export function applyInterfacePreferences(
  preferences: InterfacePreferences,
  root: Pick<HTMLElement, "classList"> = document.documentElement,
  storage: WritableStorage = window.localStorage,
): void {
  const managedClasses = [
    "hexa-reduced-motion",
    "hexa-dense-interface",
    "hexa-high-contrast",
    "hexa-large-text",
    "hexa-low-effects",
  ];
  root.classList.remove(...managedClasses);
  root.classList.add(...interfacePreferenceClassNames(preferences));
  writeInterfacePreferences(preferences, storage);
}

export function applyStoredInterfacePreferences(): InterfacePreferences {
  const preferences = readInterfacePreferences();
  applyInterfacePreferences(preferences);
  return preferences;
}
