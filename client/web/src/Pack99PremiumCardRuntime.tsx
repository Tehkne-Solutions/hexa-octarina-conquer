import { type RefObject, useEffect } from "react";

import { pack99PublicUrl, resolvePack99Asset } from "./pack99-runtime";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function cardTokens(card: HTMLElement): { required: string[]; preferred: string[] } {
  const title = card.querySelector(".living-card-header strong")?.textContent?.trim() ?? "";
  const meta = card.querySelector(".living-card-header small")?.textContent?.trim() ?? "";
  const keywords = [...card.querySelectorAll<HTMLElement>(".living-card-keywords span")].map((node) => node.textContent?.trim() ?? "");
  const role = [...card.classList].find((name) => name.startsWith("role-"))?.replace("role-", "") ?? "";
  const element = card.dataset.element ?? "";
  const roleToken = role === "guardian" ? "guardian" : role === "archer" ? "ranger" : "raider";
  return {
    required: ["card"],
    preferred: [roleToken, element, title, meta, ...keywords, "art", "illustration", "base"].filter(Boolean),
  };
}

async function decorateCard(card: HTMLElement): Promise<void> {
  if (card.dataset.pack99Decorated === "true") return;
  card.dataset.pack99Decorated = "loading";
  const { required, preferred } = cardTokens(card);
  try {
    const asset = await resolvePack99Asset(required, preferred);
    const source = pack99PublicUrl(asset);
    if (source) {
      const art = card.querySelector<HTMLElement>(".living-card-art");
      if (art && !art.querySelector(".pack99-runtime-card-image")) {
        const image = document.createElement("img");
        image.className = "pack99-runtime-card-image";
        image.src = source;
        image.alt = "";
        image.draggable = false;
        image.addEventListener("error", () => image.remove(), { once: true });
        art.prepend(image);
      }
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
