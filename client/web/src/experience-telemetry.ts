import { readInterfacePreferences } from "./interface-preferences";
import { readPwaRuntimeSnapshot } from "./pwa-lifecycle";

export type ExperienceEventName =
  | "app_boot"
  | "screen_view"
  | "realm_status"
  | "pwa_state"
  | "client_error"
  | "performance"
  | "battle_session";

export type ExperienceScreen =
  | "home"
  | "campaign-map"
  | "campaign-living"
  | "campaign-server"
  | "multiplayer"
  | "collection"
  | "profile"
  | "settings"
  | "unknown";

export interface ExperienceEvent {
  event: ExperienceEventName;
  screen: ExperienceScreen;
  device: "mobile" | "tablet" | "notebook" | "desktop" | "unknown";
  realm: "loading" | "online" | "offline" | "unknown";
  release: string;
  value: string;
  durationMs?: number;
  occurredAt: number;
}

export interface ExperienceEventDetails {
  screen?: ExperienceScreen;
  realm?: "loading" | "online" | "offline" | "unknown";
  value?: string;
  durationMs?: number;
}

export const EXPERIENCE_TELEMETRY_KEY = "hexa.settings.experience-telemetry";
export const CLIENT_RELEASE_VERSION = import.meta.env.VITE_RELEASE_VERSION ?? "0.12.0";
export const CLIENT_RELEASE_SHA = import.meta.env.VITE_RELEASE_SHA ?? "unknown";
export const CLIENT_RELEASE = `${CLIENT_RELEASE_VERSION}+${CLIENT_RELEASE_SHA}`;

const queue: ExperienceEvent[] = [];
let flushTimer: number | null = null;
let installed = false;

function safeToken(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.trim().replace(/[^a-zA-Z0-9._:-]/g, "-").slice(0, 48) || fallback;
}

function currentDevice(): ExperienceEvent["device"] {
  const value = document.documentElement.dataset.widthClass;
  return value === "mobile" || value === "tablet" || value === "notebook" || value === "desktop"
    ? value
    : "unknown";
}

export function telemetryEnabled(storage: Pick<Storage, "getItem"> = window.localStorage): boolean {
  return storage.getItem(EXPERIENCE_TELEMETRY_KEY) !== "false";
}

export function setTelemetryEnabled(enabled: boolean, storage: Pick<Storage, "setItem"> = window.localStorage): void {
  storage.setItem(EXPERIENCE_TELEMETRY_KEY, String(enabled));
  if (!enabled) queue.splice(0, queue.length);
}

export function buildExperienceEvent(
  event: ExperienceEventName,
  details: ExperienceEventDetails = {},
  context: { device?: ExperienceEvent["device"]; release?: string; occurredAt?: number } = {},
): ExperienceEvent {
  return {
    event,
    screen: details.screen ?? "unknown",
    device: context.device ?? "unknown",
    realm: details.realm ?? "unknown",
    release: safeToken(context.release, CLIENT_RELEASE),
    value: safeToken(details.value, "none"),
    ...(Number.isFinite(details.durationMs) ? { durationMs: Math.max(0, Math.min(3_600_000, Number(details.durationMs))) } : {}),
    occurredAt: context.occurredAt ?? Date.now(),
  };
}

async function sendQueuedEvents(events: ExperienceEvent[]): Promise<void> {
  if (events.length === 0) return;
  const body = JSON.stringify({ events });
  if (typeof navigator.sendBeacon === "function") {
    const accepted = navigator.sendBeacon("/experience/events", new Blob([body], { type: "application/json" }));
    if (accepted) return;
  }
  await fetch("/experience/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  });
}

export function flushExperienceTelemetry(): void {
  if (flushTimer !== null) window.clearTimeout(flushTimer);
  flushTimer = null;
  if (!telemetryEnabled() || queue.length === 0) return;
  const events = queue.splice(0, 50);
  void sendQueuedEvents(events).catch(() => {
    // Operational telemetry must never interrupt the game or create user-facing errors.
  });
}

export function trackExperience(event: ExperienceEventName, details: ExperienceEventDetails = {}): void {
  if (!telemetryEnabled()) return;
  queue.push(buildExperienceEvent(event, details, { device: currentDevice(), release: CLIENT_RELEASE }));
  if (queue.length >= 8) {
    flushExperienceTelemetry();
    return;
  }
  if (flushTimer !== null) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(flushExperienceTelemetry, 2_000);
}

function performanceDuration(name: string): number | null {
  const entry = performance.getEntriesByName(name)[0];
  return entry ? Math.round(entry.startTime) : null;
}

function recordNavigationPerformance(): void {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation) {
    trackExperience("performance", { screen: "home", value: "dom-content-loaded", durationMs: navigation.domContentLoadedEventEnd });
    trackExperience("performance", { screen: "home", value: "window-load", durationMs: navigation.loadEventEnd });
  }
  const firstContentfulPaint = performanceDuration("first-contentful-paint");
  if (firstContentfulPaint !== null) {
    trackExperience("performance", { screen: "home", value: "first-contentful-paint", durationMs: firstContentfulPaint });
  }
}

export function installExperienceTelemetry(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  trackExperience("app_boot", {
    screen: "home",
    realm: navigator.onLine ? "loading" : "offline",
    value: "started",
  });

  const onLoad = () => window.setTimeout(recordNavigationPerformance, 0);
  const onOnline = () => trackExperience("realm_status", { value: "browser-online", realm: "loading" });
  const onOffline = () => trackExperience("realm_status", { value: "browser-offline", realm: "offline" });
  const onError = (event: ErrorEvent) => trackExperience("client_error", {
    value: event.error instanceof Error ? event.error.name : "window-error",
  });
  const onUnhandled = (event: PromiseRejectionEvent) => trackExperience("client_error", {
    value: event.reason instanceof Error ? event.reason.name : "unhandled-rejection",
  });
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flushExperienceTelemetry();
  };

  if (document.readyState === "complete") onLoad();
  else window.addEventListener("load", onLoad, { once: true });
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandled);
  document.addEventListener("visibilitychange", onVisibility);
}

export interface SupportBundle {
  generatedAt: string;
  signature: "Tehkné Solutions";
  release: { clientVersion: string; clientSha: string; server: unknown };
  connection: { online: boolean; realmStatus: string; origin: string };
  viewport: { width: number; height: number; pixelRatio: number; widthClass: string; heightClass: string };
  pwa: ReturnType<typeof readPwaRuntimeSnapshot>;
  storage: { usage: number | null; quota: number | null; caches: string[] };
  preferences: ReturnType<typeof readInterfacePreferences>;
  health: unknown;
  browser: { language: string; platform: string; userAgent: string };
}

async function readJsonEndpoint(path: string): Promise<unknown> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return { ok: false, status: response.status };
    return await response.json();
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function collectSupportBundle(realmStatus: string): Promise<SupportBundle> {
  const estimate = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => ({})) : {};
  const cacheNames = typeof caches !== "undefined" ? await caches.keys().catch(() => []) : [];
  const [health, serverRelease] = await Promise.all([readJsonEndpoint("/health"), readJsonEndpoint("/release")]);
  return {
    generatedAt: new Date().toISOString(),
    signature: "Tehkné Solutions",
    release: {
      clientVersion: CLIENT_RELEASE_VERSION,
      clientSha: CLIENT_RELEASE_SHA,
      server: serverRelease,
    },
    connection: {
      online: navigator.onLine,
      realmStatus,
      origin: window.location.origin,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio,
      widthClass: document.documentElement.dataset.widthClass ?? "unknown",
      heightClass: document.documentElement.dataset.heightClass ?? "unknown",
    },
    pwa: readPwaRuntimeSnapshot(),
    storage: {
      usage: typeof estimate.usage === "number" ? estimate.usage : null,
      quota: typeof estimate.quota === "number" ? estimate.quota : null,
      caches: cacheNames,
    },
    preferences: readInterfacePreferences(),
    health,
    browser: {
      language: navigator.language,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
    },
  };
}
