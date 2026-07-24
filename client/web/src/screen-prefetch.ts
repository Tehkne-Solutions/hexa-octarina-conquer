export type PrefetchTarget = "campaign" | "multiplayer" | "collection" | "profile";

const warmedTargets = new Set<PrefetchTarget>();

const LOADERS: Record<PrefetchTarget, () => Promise<unknown>> = {
  campaign: () => Promise.all([
    import("./CampaignJourneyScreen"),
    import("./CampaignExperience"),
  ]),
  multiplayer: () => import("./App"),
  collection: () => import("./CollectionScreen"),
  profile: () => import("./ProfileScreen"),
};

export function prefetchTargetFromIntent(label: string): PrefetchTarget | null {
  const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (normalized.includes("campanha")) return "campaign";
  if (normalized.includes("multiplayer") || normalized === "jogar") return "multiplayer";
  if (normalized.includes("colecao") || normalized.includes("cartas")) return "collection";
  if (normalized.includes("perfil") || normalized.includes("progresso")) return "profile";
  return null;
}

export async function prefetchGameScreen(target: PrefetchTarget): Promise<void> {
  if (warmedTargets.has(target)) return;
  warmedTargets.add(target);
  try {
    await LOADERS[target]();
  } catch {
    warmedTargets.delete(target);
  }
}

export function installIntentPrefetch(root: Document = document): () => void {
  const inspect = (event: Event) => {
    const element = event.target instanceof Element ? event.target.closest("button, a") : null;
    if (!element) return;
    const label = element.getAttribute("aria-label") || element.textContent || "";
    const target = prefetchTargetFromIntent(label);
    if (target) void prefetchGameScreen(target);
  };

  root.addEventListener("pointerover", inspect, { passive: true });
  root.addEventListener("focusin", inspect);
  root.addEventListener("touchstart", inspect, { passive: true });

  return () => {
    root.removeEventListener("pointerover", inspect);
    root.removeEventListener("focusin", inspect);
    root.removeEventListener("touchstart", inspect);
  };
}
