import { type RefObject, useEffect, useRef } from "react";

type MotionName = "attack" | "defend" | "dodge" | "recoil" | "summon" | "victory" | "defeat" | "move";

interface MotionTarget {
  selector: string;
  motion: MotionName;
  delay?: number;
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function latestEventText(root: HTMLElement): string {
  return root.querySelector<HTMLElement>(".event-timeline p")?.textContent?.trim()
    ?? root.querySelector<HTMLElement>(".living-notice p")?.textContent?.trim()
    ?? root.querySelector<HTMLElement>(".battle-resolution-panel")?.textContent?.trim()
    ?? "";
}

function activePlayerSelector(root: HTMLElement): string {
  const selected = root.querySelector<HTMLElement>(".pack99-unit-sprite.state-selected");
  const id = selected?.dataset.pack99Unit;
  return id ? `[data-pack99-unit="${CSS.escape(id)}"]` : ".pack99-unit-sprite.faction-player";
}

function classifyMotions(root: HTMLElement, text: string): MotionTarget[] {
  const value = normalized(text);
  const player = activePlayerSelector(root);
  const enemy = ".pack99-unit-sprite.faction-enemy";

  if (root.querySelector(".outcome-screen.victory")) {
    return [
      { selector: ".pack99-unit-sprite.faction-player", motion: "victory" },
      { selector: enemy, motion: "defeat", delay: 100 },
    ];
  }
  if (root.querySelector(".outcome-screen.defeat")) {
    return [
      { selector: player, motion: "defeat" },
      { selector: enemy, motion: "victory", delay: 100 },
    ];
  }
  if (/invoc|entrou no campo|despertou|libertou/.test(value)) return [{ selector: player, motion: "summon" }];
  if (/esquiv|evas|passo lunar|desviou/.test(value)) return [{ selector: player, motion: "dodge" }];
  if (/bloque|defendeu|muralha|guardiao celeste|escudo/.test(value)) return [{ selector: player, motion: "defend" }];
  if (/moveu|avancou|atravessou|reposicion/.test(value)) return [{ selector: player, motion: "move" }];
  if (/dano|golpe|ataque|flecha|machado|atingiu|combate|confronto/.test(value)) {
    return [
      { selector: player, motion: "attack" },
      { selector: enemy, motion: "recoil", delay: 210 },
      { selector: enemy, motion: "attack", delay: 520 },
      { selector: player, motion: "recoil", delay: 730 },
    ];
  }
  return [];
}

function triggerMotion(root: HTMLElement, target: MotionTarget, timers: Set<number>): void {
  const timer = window.setTimeout(() => {
    root.querySelectorAll<HTMLElement>(target.selector).forEach((node) => {
      const className = `unit-motion-${target.motion}`;
      node.classList.remove(
        "unit-motion-attack", "unit-motion-defend", "unit-motion-dodge", "unit-motion-recoil",
        "unit-motion-summon", "unit-motion-victory", "unit-motion-defeat", "unit-motion-move",
      );
      void node.offsetWidth;
      node.classList.add(className);
      node.dataset.physicalMotion = target.motion;
      const duration = target.motion === "victory" || target.motion === "defeat" ? 1500 : 880;
      const clearTimer = window.setTimeout(() => {
        node.classList.remove(className);
        delete node.dataset.physicalMotion;
      }, duration);
      timers.add(clearTimer);
    });
  }, target.delay ?? 0);
  timers.add(timer);
}

export function Pack99UnitPhysicalMotion({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const lastSignature = useRef("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const timers = new Set<number>();
    let frame = 0;

    const synchronize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const text = latestEventText(root);
        const outcome = root.querySelector<HTMLElement>(".outcome-screen")?.className ?? "";
        const battle = root.querySelector<HTMLElement>(".battle-resolution-panel")?.textContent?.trim() ?? "";
        const signature = `${text}|${battle}|${outcome}`;
        if (!signature.trim() || signature === lastSignature.current) return;
        lastSignature.current = signature;
        classifyMotions(root, `${text} ${battle}`).forEach((target) => triggerMotion(root, target, timers));
      });
    };

    const observer = new MutationObserver(synchronize);
    observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true });
    synchronize();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [rootRef]);

  return null;
}
