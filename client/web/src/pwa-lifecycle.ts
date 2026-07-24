export interface PwaRuntimeSnapshot {
  updateAvailable: boolean;
  offlineReady: boolean;
  registrationReady: boolean;
  registrationError: string | null;
  lastCheckedAt: number | null;
}

export const PWA_STATE_EVENT = "hexa:pwa-state";
export const PWA_APPLY_UPDATE_EVENT = "hexa:pwa-apply-update";
export const PWA_CHECK_UPDATE_EVENT = "hexa:pwa-check-update";

export const INITIAL_PWA_RUNTIME_SNAPSHOT: PwaRuntimeSnapshot = {
  updateAvailable: false,
  offlineReady: false,
  registrationReady: false,
  registrationError: null,
  lastCheckedAt: null,
};

declare global {
  interface Window {
    __HEXA_PWA_RUNTIME__?: PwaRuntimeSnapshot;
  }
}

export function mergePwaRuntimeSnapshot(
  current: PwaRuntimeSnapshot,
  patch: Partial<PwaRuntimeSnapshot>,
): PwaRuntimeSnapshot {
  return { ...current, ...patch };
}

export function readPwaRuntimeSnapshot(): PwaRuntimeSnapshot {
  if (typeof window === "undefined") return { ...INITIAL_PWA_RUNTIME_SNAPSHOT };
  return window.__HEXA_PWA_RUNTIME__ ?? { ...INITIAL_PWA_RUNTIME_SNAPSHOT };
}

export function emitPwaRuntimePatch(patch: Partial<PwaRuntimeSnapshot>): PwaRuntimeSnapshot {
  const next = mergePwaRuntimeSnapshot(readPwaRuntimeSnapshot(), patch);
  window.__HEXA_PWA_RUNTIME__ = next;
  window.dispatchEvent(new CustomEvent<Partial<PwaRuntimeSnapshot>>(PWA_STATE_EVENT, { detail: patch }));
  return next;
}

export function requestPwaUpdate(): void {
  window.dispatchEvent(new Event(PWA_APPLY_UPDATE_EVENT));
}

export function requestPwaUpdateCheck(): void {
  window.dispatchEvent(new Event(PWA_CHECK_UPDATE_EVENT));
}

export function pwaPatchFromEvent(event: Event): Partial<PwaRuntimeSnapshot> {
  if (!(event instanceof CustomEvent)) return {};
  const detail = event.detail;
  return detail && typeof detail === "object" ? detail as Partial<PwaRuntimeSnapshot> : {};
}
