import { useEffect } from "react";

const TECHNICAL_BADGE_PATTERN = /\bBUILD\b.*\bPACK\s*99\b.*\b\d+\s*\/\s*1037\b/i;

function isQaOrDevSurface(): boolean {
  const params = new URL(window.location.href).searchParams;
  return import.meta.env.DEV || params.get("qa") === "1" || params.get("debug") === "1";
}

function hideTechnicalBadges(): HTMLElement[] {
  if (isQaOrDevSurface()) return [];
  const hidden: HTMLElement[] = [];
  for (const node of Array.from(document.body.querySelectorAll<HTMLElement>("body *"))) {
    const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!text || text.length > 96 || !TECHNICAL_BADGE_PATTERN.test(text)) continue;
    if (node.children.length > 3) continue;
    node.dataset.playerSurfaceHidden = "pack99-build";
    node.style.setProperty("display", "none", "important");
    hidden.push(node);
  }
  return hidden;
}

export function Pack99PlayerSurfaceCleanup() {
  useEffect(() => {
    const touched = new Set<HTMLElement>();
    const apply = () => {
      for (const node of hideTechnicalBadges()) touched.add(node);
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      for (const node of touched) {
        if (node.dataset.playerSurfaceHidden === "pack99-build") {
          delete node.dataset.playerSurfaceHidden;
          node.style.removeProperty("display");
        }
      }
    };
  }, []);

  return null;
}
