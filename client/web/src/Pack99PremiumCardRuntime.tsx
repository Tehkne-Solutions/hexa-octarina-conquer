import { type RefObject, useEffect } from "react";

import {
  loadPack99RuntimeState,
  pack99PublicUrl,
  resolvePack99MissionAsset,
  type Pack99MissionAssetReference,
} from "./pack99-runtime";

const CARD_CANONICAL_ART: Record<string, string | undefined> = {
  "golpe runico": "CARD_ART_HERO_GUARDIAN_01",
  "guardiao celeste": "CARD_ART_HERO_GUARDIAN_01",
  "contra-selo": "CARD_ART_HERO_GUARDIAN_01",
  "muralha astral": "CARD_ART_HERO_GUARDIAN_01",
  "flecha do eter": "CARD_ART_HERO_RANGER_01",
  "passo lunar": "CARD_ART_HERO_RANGER_01",
  "marca da cacada": "CARD_ART_HERO_RANGER_01",
  "chuva prismatica": "CARD_ART_HERO_RANGER_01",
  "machado das cinzas": undefined,
  "couro remendado": undefined,
  "salto saqueador": undefined,
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cardReference(card: HTMLElement): Pack99MissionAssetReference {
  const title = card.querySelector(".living-card-header strong")?.textContent?.trim() ?? "";
  const meta = card.querySelector(".living-card-header small")?.textContent?.trim() ?? "";
  const keywords = [...card.querySelectorAll<HTMLElement>(".living-card-keywords span")].map((node) => node.textContent?.trim() ?? "");
  const role = [...card.classList].find((name) => name.startsWith("role-"))?.replace("role-", "") ?? "";
  const element = card.dataset.element ?? "";
  const roleToken = role === "guardian" ? "guardian" : role === "archer" ? "ranger" : "raider";
  const canonicalId = CARD_CANONICAL_ART[normalize(title)];
  return {
    canonicalId,
    sourceSuffixes: canonicalId ? [`${canonicalId}.png`] : [],
    required: ["card", "art"],
    preferred: [roleToken, element, title, meta, ...keywords, "illustration", "base"].filter(Boolean),
  };
}

async function decorateCard(card: HTMLElement): Promise<void> {
  if (card.dataset.pack99Decorated === "true" || card.dataset.pack99Decorated === "loading") return;
  card.dataset.pack99Decorated = "loading";
  const reference = cardReference(card);
  const art = card.querySelector<HTMLElement>(".living-card-art");
  try {
    const [runtime, asset] = await Promise.all([
      loadPack99RuntimeState(),
      resolvePack99MissionAsset(reference),
    ]);
    const source = pack99PublicUrl(asset);
    card.dataset.pack99CanonicalId = reference.canonicalId ?? "missing-from-pack99";
    card.dataset.pack99Fallback = String(!runtime.isFullRuntime);

    if (!source) {
      if (runtime.isFullRuntime) {
        card.dataset.pack99AssetError = "canonical-card-art-missing";
        art?.querySelector(".pack99-runtime-card-image")?.remove();
      }
      return;
    }

    delete card.dataset.pack99AssetError;
    if (art && !art.querySelector(".pack99-runtime-card-image")) {
      const image = document.createElement("img");
      image.className = "pack99-runtime-card-image";
      image.src = source;
      image.alt = "";
      image.draggable = false;
      image.addEventListener("error", () => {
        image.remove();
        if (runtime.isFullRuntime) card.dataset.pack99AssetError = "canonical-card-art-load-failed";
      }, { once: true });
      art.prepend(image);
    }
  } finally {
    card.dataset.pack99Decorated = "true";
  }
}

export function Pack99PremiumCardRuntime({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;

    const synchronize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const cards = [...root.querySelectorAll<HTMLElement>(".living-card")];
        cards.forEach((card) => void decorateCard(card));
        root.classList.toggle("pack99-card-combat-active", cards.length > 0);
      });
    };

    const observer = new MutationObserver(synchronize);
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    synchronize();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      root.classList.remove("pack99-card-combat-active");
    };
  }, [rootRef]);

  return null;
}
