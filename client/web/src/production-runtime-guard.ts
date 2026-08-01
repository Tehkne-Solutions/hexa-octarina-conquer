const releaseVersion = import.meta.env.VITE_RELEASE_VERSION || "dev";
const releaseSha = import.meta.env.VITE_RELEASE_SHA || "local";
const publishedHost = "hexa-octarina-conquer.onrender.com";
const isPublishedProduction = import.meta.env.PROD && window.location.hostname === publishedHost;

function ensureBuildMarker(): HTMLElement {
  let marker = document.getElementById("hexa-build-marker");
  if (marker) return marker;

  marker = document.createElement("div");
  marker.id = "hexa-build-marker";
  marker.setAttribute("role", "status");
  marker.setAttribute("aria-label", "Identificação da versão publicada");
  marker.textContent = `BUILD ${releaseSha.slice(0, 8)} · v${releaseVersion}`;
  Object.assign(marker.style, {
    position: "fixed",
    right: "10px",
    bottom: "8px",
    zIndex: "10000",
    padding: "4px 8px",
    border: "1px solid rgba(213, 188, 111, .35)",
    borderRadius: "999px",
    background: "rgba(3, 10, 8, .82)",
    color: "#cdbb7a",
    font: "600 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace",
    pointerEvents: "none",
  });
  document.body.append(marker);
  return marker;
}

function ensureRuntimeFailureOverlay(reason: string): void {
  if (!isPublishedProduction || document.getElementById("pack99-production-block")) return;

  const overlay = document.createElement("section");
  overlay.id = "pack99-production-block";
  overlay.setAttribute("role", "alert");
  overlay.innerHTML = `
    <div>
      <small>GATE DE PRODUÇÃO</small>
      <h1>PACK 99 incompleto</h1>
      <p>Esta publicação foi bloqueada para impedir o uso de placeholders e assets parciais.</p>
      <code>${reason}</code>
      <strong>Tehkné Solutions</strong>
    </div>
  `;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9999",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background: "radial-gradient(circle at center, #13281e, #020706 72%)",
    color: "#f1e3b0",
    textAlign: "center",
  });
  const panel = overlay.firstElementChild as HTMLElement | null;
  if (panel) {
    Object.assign(panel.style, {
      maxWidth: "620px",
      padding: "30px",
      border: "1px solid rgba(222, 192, 100, .45)",
      borderRadius: "16px",
      background: "rgba(3, 11, 9, .9)",
      boxShadow: "0 30px 90px rgba(0, 0, 0, .62)",
    });
  }
  document.documentElement.dataset.productionBlocked = "true";
  document.body.append(overlay);
}

function inspectRuntime(): void {
  const root = document.documentElement;
  const full = root.dataset.pack99Full;
  const runtime = root.dataset.pack99Runtime;
  const canonical = root.dataset.pack99CanonicalCount;
  const materialized = root.dataset.pack99AssetCount;
  const fallbacks = root.dataset.pack99Fallbacks;

  if (!full) return;

  const marker = ensureBuildMarker();
  marker.textContent = `BUILD ${releaseSha.slice(0, 8)} · PACK 99 ${canonical ?? "0"}/1037`;
  marker.dataset.runtime = runtime ?? "unknown";
  marker.dataset.full = full;

  const valid = full === "true"
    && runtime === "full"
    && canonical === "1037"
    && Number(materialized ?? "0") === 1037
    && fallbacks === "false";

  if (!valid) {
    ensureRuntimeFailureOverlay(
      `mode=${runtime ?? "unknown"}; canonical=${canonical ?? "0"}; materialized=${materialized ?? "0"}; fallbacks=${fallbacks ?? "unknown"}`,
    );
  }
}

ensureBuildMarker();
const observer = new MutationObserver(inspectRuntime);
observer.observe(document.documentElement, { attributes: true, attributeFilter: [
  "data-pack99-runtime",
  "data-pack99-asset-count",
  "data-pack99-canonical-count",
  "data-pack99-fallbacks",
  "data-pack99-full",
] });
inspectRuntime();
