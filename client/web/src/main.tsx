import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { AccountOnboardingPortal } from "./AccountOnboardingPortal";
import { BoardThemeRuntime } from "./BoardThemeRuntime";
import { installExperienceTelemetry, trackExperience } from "./experience-telemetry";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { GameApp } from "./GameApp";
import { applyStoredInterfacePreferences } from "./interface-preferences";
import { installLoadoutClientBridge } from "./loadout-client-bridge";
import { LoadoutManagerPortal } from "./LoadoutManagerPortal";
import { LivingGameplayDirector } from "./LivingGameplayDirector";
import { PWA_APPLY_UPDATE_EVENT, PWA_CHECK_UPDATE_EVENT, emitPwaRuntimePatch } from "./pwa-lifecycle";
import { RuntimeAssetOverlay } from "./RuntimeAssetOverlay";
import { RuntimeEnhancements } from "./RuntimeEnhancements";
import { SpectatorReplayPortal } from "./SpectatorReplayPortal";
import "./styles.css";
import "./first-play.css";
import "./board-entities.css";
import "./living-board.css";
import "./living-board-playtest.css";
import "./go-dots-living-board.css";
import "./unified-game.css";
import "./sprint-ui-02.css";
import "./sprint-ui-03.css";
import "./sprint-ui-04.css";
import "./sprint-ui-05.css";
import "./sprint-ui-06-final.css";
import "./sprint-ui-07.css";
import "./sprint-ui-08.css";
import "./sprint-ui-08-qa.css";
import "./sprint-ui-08-qa-stable.css";
import "./sprint-ui-09.css";
import "./sprint-ui-09-compact.css";
import "./sprint-ui-10.css";
import "./sprint-ui-11.css";
import "./sprint-ui-12.css";
import "./sprint-ui-13.css";
import "./sprint-ui-13-interaction.css";
import "./sprint-ui-14.css";
import "./sprint-runtime-02.css";

const LegacyApp = lazy(() => import("./App").then((module) => ({ default: module.App })));
const SprintUi08VisualQa = lazy(() => import("./SprintUi08VisualQa").then((module) => ({ default: module.SprintUi08VisualQa })));
const SprintUi13BoardQa = lazy(() => import("./SprintUi13BoardQa").then((module) => ({ default: module.SprintUi13BoardQa })));
const SprintUi14GameplayQa = lazy(() => import("./SprintUi14GameplayQa").then((module) => ({ default: module.SprintUi14GameplayQa })));

applyStoredInterfacePreferences();
installExperienceTelemetry();
installLoadoutClientBridge();

let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => { emitPwaRuntimePatch({ updateAvailable: true }); trackExperience("pwa_state", { value: "update-available" }); },
  onOfflineReady: () => { emitPwaRuntimePatch({ offlineReady: true }); trackExperience("pwa_state", { value: "offline-ready" }); },
  onRegisteredSW: (_serviceWorkerUrl, registration) => { serviceWorkerRegistration = registration; emitPwaRuntimePatch({ registrationReady: true, registrationError: null }); trackExperience("pwa_state", { value: "registered" }); },
  onRegisterError: (error) => { emitPwaRuntimePatch({ registrationReady: false, registrationError: error instanceof Error ? error.message : String(error) }); trackExperience("client_error", { value: error instanceof Error ? error.name : "service-worker-registration" }); },
});
window.addEventListener(PWA_APPLY_UPDATE_EVENT, () => { emitPwaRuntimePatch({ updateAvailable: false }); trackExperience("pwa_state", { value: "update-applied" }); void updateSW(true); });
window.addEventListener(PWA_CHECK_UPDATE_EVENT, () => { emitPwaRuntimePatch({ lastCheckedAt: Date.now(), registrationError: null }); trackExperience("pwa_state", { value: "update-check" }); if (!serviceWorkerRegistration) return; void serviceWorkerRegistration.update().catch((error: unknown) => { emitPwaRuntimePatch({ registrationError: error instanceof Error ? error.message : String(error) }); }); });

function BootFallback() {
  return <main className="boot-fallback" role="status" aria-live="polite"><span aria-hidden="true">✦</span><strong>Preparando o Reino de Orun</strong><small>Tehkné Solutions</small></main>;
}

const root = document.getElementById("root");
if (!root) throw new Error("root element was not found");
const pageUrl = new URL(window.location.href);
const legacyRequested = pageUrl.searchParams.get("dev-client") === "legacy";
const legacyAllowed = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LEGACY_CLIENT === "true";
const requestedQaScene = pageUrl.searchParams.get("screen") ?? "";
const qaEnabled = pageUrl.searchParams.get("qa") === "1";
const ui08QaRequested = qaEnabled && requestedQaScene.startsWith("ui08-");
const ui13QaRequested = qaEnabled && requestedQaScene.startsWith("ui13-");
const ui14QaRequested = qaEnabled && requestedQaScene.startsWith("ui14-");
if (ui08QaRequested || ui13QaRequested || ui14QaRequested) {
  document.documentElement.dataset.visualQa = "true";
  document.documentElement.dataset.qaStable = pageUrl.searchParams.get("stable") === "1" ? "true" : "false";
  document.documentElement.dataset.qaScreen = requestedQaScene;
}

createRoot(root).render(
  <StrictMode><GameErrorBoundary><BoardThemeRuntime /><LivingGameplayDirector /><RuntimeAssetOverlay />
    {ui08QaRequested ? <Suspense fallback={<BootFallback />}><SprintUi08VisualQa scene={requestedQaScene} /></Suspense>
      : ui13QaRequested ? <Suspense fallback={<BootFallback />}><SprintUi13BoardQa scene={requestedQaScene} /></Suspense>
      : ui14QaRequested ? <Suspense fallback={<BootFallback />}><SprintUi14GameplayQa scene={requestedQaScene} /></Suspense>
      : <><RuntimeEnhancements /><SpectatorReplayPortal /><LoadoutManagerPortal /><AccountOnboardingPortal /><Suspense fallback={<BootFallback />}>{legacyRequested && legacyAllowed ? <LegacyApp /> : <GameApp />}</Suspense></>}
  </GameErrorBoundary></StrictMode>,
);
