import { useEffect } from "react";

import { runtimeAssetUrl } from "./runtime-assets";

const HOME_HERO_ART = [
  { selector: ".campaign-hero-art .hero-kael", assetId: "HERO_GUARDIAN_01_IDLE_BASE_SW_01", label: "Kael" },
  { selector: ".campaign-hero-art .hero-lyra", assetId: "HERO_RANGER_01_IDLE_BASE_NE_01", label: "Lyra" },
] as const;

export function Pack99HomeHeroArt() {
  useEffect(() => {
    let cancelled = false;
    const touched: HTMLElement[] = [];

    const apply = async () => {
      for (const item of HOME_HERO_ART) {
        const node = document.querySelector<HTMLElement>(item.selector);
        if (!node) continue;
        const url = await runtimeAssetUrl(item.assetId);
        if (cancelled || !url) continue;

        node.dataset.pack99HeroArt = item.label.toLowerCase();
        node.setAttribute("aria-label", item.label);
        node.textContent = "";
        node.style.backgroundImage = `url("${url}")`;
        node.style.backgroundRepeat = "no-repeat";
        node.style.backgroundPosition = "50% 36%";
        node.style.backgroundSize = "155% auto";
        node.style.filter = "saturate(1.15) contrast(1.08) drop-shadow(0 14px 12px rgba(0, 0, 0, .45))";
        touched.push(node);
      }
    };

    void apply();
    const observer = new MutationObserver(() => void apply());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      for (const node of touched) {
        delete node.dataset.pack99HeroArt;
        node.removeAttribute("aria-label");
        node.removeAttribute("style");
      }
    };
  }, []);

  return null;
}
